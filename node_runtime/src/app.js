import { createServer } from 'node:http';
import { EventListener } from './event-listener.js';
import { EventRouter } from './event-router.js';
import { KiroSession } from './kiro-session.js';
import { SessionManager } from './session-manager.js';

export function buildManager() {
  const router = new EventRouter();
  const sessionFactory = () => new KiroSession({ command: 'cat' });
  return new SessionManager({ sessionFactory, router });
}

export function createWebhookServer({ listener = new EventListener(), manager = buildManager() } = {}) {
  return createServer(async (req, res) => {
    if (req.method !== 'POST' || !['/webhook/jira', '/webhook/gitbucket'].includes(req.url)) {
      res.statusCode = 404;
      res.end();
      return;
    }

    const source = req.url.endsWith('jira') ? 'jira' : 'gitbucket';

    try {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const body = Buffer.concat(chunks).toString('utf8');
      const payload = body ? JSON.parse(body) : {};

      const event = listener.normalize(source, payload);
      const messageType = manager.handleEvent(event);

      const response = JSON.stringify({ ok: true, message_type: messageType, task_id: event.taskId });
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(response);
    } catch (error) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ ok: false, error: error.message }));
    }
  });
}

if (process.argv[1] && process.argv[1].endsWith('app.js')) {
  const host = process.env.HOST ?? '0.0.0.0';
  const port = Number(process.env.PORT ?? 8080);
  const server = createWebhookServer();
  server.listen(port, host, () => {
    // eslint-disable-next-line no-console
    console.log(`Listening on http://${host}:${port}`);
  });
}
