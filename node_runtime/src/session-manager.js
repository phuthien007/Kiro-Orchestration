import { MessageType } from './event-router.js';
import { SessionState, SessionStatus } from './models.js';

export class SessionManager {
  constructor({ sessionFactory, router, idleTimeoutMs = 24 * 60 * 60 * 1000 }) {
    this.sessionFactory = sessionFactory;
    this.router = router;
    this.idleTimeoutMs = idleTimeoutMs;
    this.sessions = new Map();
    this.processedEventIds = new Set();
  }

  handleEvent(event) {
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
      };
      this.sessions.set(event.taskId, record);
    }

    const outbound = this.router.toAgentMessage(msgType, event);
    record.process.send(outbound);
    record.state.lastMessage = outbound;
    record.state.lastEventAt = new Date();
    record.state.status = SessionStatus.ACTIVE;
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
}
