export const SessionStatus = Object.freeze({
  CREATE: 'create',
  ACTIVE: 'active',
  IDLE: 'idle',
  TERMINATE: 'terminate',
});

export class NormalizedEvent {
  constructor({ eventId, source, type, taskId, payload, createdAt = new Date() }) {
    this.eventId = eventId;
    this.source = source;
    this.type = type;
    this.taskId = taskId;
    this.payload = payload;
    this.createdAt = createdAt;
  }
}

export class SessionState {
  constructor(taskId) {
    this.taskId = taskId;
    this.status = SessionStatus.CREATE;
    this.lastMessage = '';
    this.lastEventAt = new Date();
  }
}
