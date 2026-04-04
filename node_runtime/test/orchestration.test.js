import test from 'node:test';
import assert from 'node:assert/strict';
import { EventListener } from '../src/event-listener.js';
import { EventRouter, MessageType } from '../src/event-router.js';
import { SessionManager } from '../src/session-manager.js';
import { createWebhookServer } from '../src/app.js';

function createMockSession({ sendDelayMs = 0 } = {}) {
  const calls = [];
  return {
    sent: [],
    stopped: false,
    calls,
    async send(message) {
      const startedAt = Date.now();
      calls.push({ startedAt, endedAt: null });
      this.sent.push(message);
      await new Promise((resolve) => setTimeout(resolve, sendDelayMs));
      calls[calls.length - 1].endedAt = Date.now();
    },
    stop() {
      this.stopped = true;
    },
  };
}

test('routes jira issue_created to NEW_TASK and sends formatted message', async () => {
  const router = new EventRouter();
  const listener = new EventListener();
  const sessions = [];
  const manager = new SessionManager({
    router,
    debounceWindowMs: 5,
    sessionFactory: () => {
      const s = createMockSession();
      sessions.push(s);
      return s;
    },
  });

  const event = listener.normalize('jira', {
    webhookEvent: 'jira:issue_created',
    timestamp: 123,
    issue: {
      key: 'PROJ-123',
      fields: { summary: 'Build login API', description: 'Implement JWT login' },
    },
  });

  const type = await manager.handleEvent(event);
  assert.equal(type, MessageType.NEW_TASK);
  assert.equal(sessions.length, 1);
  assert.match(sessions[0].sent[0], /\[TASK START\]/);
  assert.match(sessions[0].sent[0], /Task ID: PROJ-123/);
});

test('deduplicates event_id and ignores second delivery', async () => {
  const router = new EventRouter();
  const listener = new EventListener();
  const session = createMockSession();
  const manager = new SessionManager({ router, debounceWindowMs: 5, sessionFactory: () => session });

  const payload = {
    webhookEvent: 'jira:issue_updated',
    timestamp: 999,
    issue: { key: 'PROJ-1' },
    comment: { body: 'update' },
  };

  const first = await manager.handleEvent(listener.normalize('jira', payload));
  const second = await manager.handleEvent(listener.normalize('jira', payload));

  assert.equal(first, MessageType.USER_REPLY);
  assert.equal(second, MessageType.IGNORE);
  assert.equal(session.sent.length, 1);
});

test('debounces near-simultaneous requests and merges message batch', async () => {
  const router = new EventRouter();
  const listener = new EventListener();
  const session = createMockSession();
  const manager = new SessionManager({
    router,
    debounceWindowMs: 40,
    mergeSeparator: '\n\n[BATCH]\n\n',
    sessionFactory: () => session,
  });

  const event1 = listener.normalize('jira', {
    webhookEvent: 'jira:issue_updated',
    timestamp: 1001,
    issue: { key: 'PROJ-BATCH' },
    comment: { body: 'first' },
  });

  const event2 = listener.normalize('jira', {
    webhookEvent: 'jira:issue_updated',
    timestamp: 1002,
    issue: { key: 'PROJ-BATCH' },
    comment: { body: 'second' },
  });

  await Promise.all([manager.handleEvent(event1), manager.handleEvent(event2)]);

  assert.equal(session.sent.length, 1);
  assert.match(session.sent[0], /first/);
  assert.match(session.sent[0], /second/);
  assert.match(session.sent[0], /\[BATCH\]/);
});

test('serializes sends while session is still interacting', async () => {
  const router = new EventRouter();
  const listener = new EventListener();
  const session = createMockSession({ sendDelayMs: 50 });
  const manager = new SessionManager({
    router,
    debounceWindowMs: 0,
    sessionFactory: () => session,
  });

  const event1 = listener.normalize('jira', {
    webhookEvent: 'jira:issue_updated',
    timestamp: 2001,
    issue: { key: 'PROJ-SERIAL' },
    comment: { body: 'one' },
  });

  const event2 = listener.normalize('jira', {
    webhookEvent: 'jira:issue_updated',
    timestamp: 2002,
    issue: { key: 'PROJ-SERIAL' },
    comment: { body: 'two' },
  });

  const firstPromise = manager.handleEvent(event1);
  await new Promise((resolve) => setTimeout(resolve, 10));
  const secondPromise = manager.handleEvent(event2);

  await Promise.all([firstPromise, secondPromise]);

  assert.equal(session.sent.length, 2);
  assert.ok(session.calls[1].startedAt >= session.calls[0].endedAt);
});

test('terminates idle sessions after timeout', async () => {
  const router = new EventRouter();
  const listener = new EventListener();
  const session = createMockSession();
  const manager = new SessionManager({
    router,
    debounceWindowMs: 5,
    sessionFactory: () => session,
    idleTimeoutMs: 10,
  });

  await manager.handleEvent(
    listener.normalize('jira', {
      webhookEvent: 'jira:issue_created',
      timestamp: 124,
      issue: { key: 'PROJ-2', fields: {} },
    }),
  );

  const terminated = manager.terminateIfExpired(new Date(Date.now() + 100));
  assert.deepEqual(terminated, ['PROJ-2']);
  assert.equal(session.stopped, true);
});

test('webhook server processes jira event with mock session', async () => {
  const listener = new EventListener();
  const router = new EventRouter();
  const manager = new SessionManager({ router, debounceWindowMs: 5, sessionFactory: () => createMockSession() });
  const server = createWebhookServer({ listener, manager });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();

  const response = await fetch(`http://127.0.0.1:${port}/webhook/jira`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      webhookEvent: 'jira:issue_created',
      timestamp: 125,
      issue: { key: 'PROJ-3', fields: { summary: 'x', description: 'y' } },
    }),
  });

  const json = await response.json();
  assert.equal(response.status, 200);
  assert.deepEqual(json, { ok: true, message_type: MessageType.NEW_TASK, task_id: 'PROJ-3' });

  await new Promise((resolve) => server.close(resolve));
});
