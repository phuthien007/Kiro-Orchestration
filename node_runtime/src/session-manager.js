import { MessageType } from './event-router.js';
import { SessionState, SessionStatus } from './models.js';

export class SessionManager {
  constructor({
    sessionFactory,
    router,
    idleTimeoutMs = 24 * 60 * 60 * 1000,
    debounceWindowMs = 300,
    mergeSeparator = '\n\n---\n\n',
  }) {
    this.sessionFactory = sessionFactory;
    this.router = router;
    this.idleTimeoutMs = idleTimeoutMs;
    this.debounceWindowMs = debounceWindowMs;
    this.mergeSeparator = mergeSeparator;

    this.sessions = new Map();
    this.processedEventIds = new Set();
  }

  async handleEvent(event) {
    if (this.processedEventIds.has(event.eventId)) {
      return MessageType.IGNORE;
    }
    this.processedEventIds.add(event.eventId);

    const msgType = this.router.route(event);
    if (msgType === MessageType.IGNORE) return msgType;

    let record = this.sessions.get(event.taskId);
    if (!record) {
      record = {
        state: new SessionState(event.taskId),
        process: this.sessionFactory(),
        pipeline: Promise.resolve(),
        pendingMessages: [],
        debounceTimer: null,
      };
      this.sessions.set(event.taskId, record);
    }

    const outbound = this.router.toAgentMessage(msgType, event);
    record.state.lastMessage = outbound;
    record.state.lastEventAt = new Date();
    record.state.status = SessionStatus.ACTIVE;

    await this.#enqueueBufferedSend(record, outbound);
    return msgType;
  }

  markIdle(taskId) {
    const record = this.sessions.get(taskId);
    if (!record) return;
    record.state.status = SessionStatus.IDLE;
  }

  terminateIfExpired(now = new Date()) {
    const terminated = [];

    for (const [taskId, record] of this.sessions.entries()) {
      if (record.state.status === SessionStatus.TERMINATE) continue;

      if (now - record.state.lastEventAt > this.idleTimeoutMs) {
        record.process.stop();
        record.state.status = SessionStatus.TERMINATE;
        terminated.push(taskId);
      }
    }

    return terminated;
  }

  terminateTask(taskId) {
    const record = this.sessions.get(taskId);
    if (!record) return false;

    record.process.stop();
    record.state.status = SessionStatus.TERMINATE;
    return true;
  }

  #enqueueBufferedSend(record, outbound) {
    return new Promise((resolve, reject) => {
      record.pendingMessages.push({ outbound, resolve, reject });

      if (record.debounceTimer) {
        clearTimeout(record.debounceTimer);
      }

      record.debounceTimer = setTimeout(() => {
        record.debounceTimer = null;
        this.#flushPending(record);
      }, this.debounceWindowMs);
    });
  }

  #flushPending(record) {
    if (record.pendingMessages.length === 0) return;

    const batch = record.pendingMessages.splice(0, record.pendingMessages.length);
    const mergedMessage = batch.map((item) => item.outbound).join(this.mergeSeparator);

    record.pipeline = record.pipeline
      .then(async () => {
        await record.process.send(mergedMessage);
      })
      .then(() => {
        for (const item of batch) item.resolve();
      })
      .catch((error) => {
        for (const item of batch) item.reject(error);
      });
  }
}
