export const MessageType = Object.freeze({
  NEW_TASK: 'NEW_TASK',
  USER_REPLY: 'USER_REPLY',
  CODE_REVIEW: 'CODE_REVIEW',
  IGNORE: 'IGNORE',
});

export class EventRouter {
  route(event) {
    if (event.type === 'issue_created') return MessageType.NEW_TASK;
    if (event.type === 'comment') return MessageType.USER_REPLY;
    if (event.type === 'pr_comment') return MessageType.CODE_REVIEW;
    return MessageType.IGNORE;
  }

  toAgentMessage(messageType, event) {
    if (messageType === MessageType.NEW_TASK) {
      const title = event.payload.issue?.fields?.summary ?? '';
      const description = event.payload.issue?.fields?.description ?? '';
      return [
        '[TASK START]',
        `Task ID: ${event.taskId}`,
        '',
        `Title: ${title}`,
        `Description: ${description}`,
        '',
        'Start working on this task.',
      ].join('\n');
    }

    if (messageType === MessageType.USER_REPLY) {
      const body = event.payload.comment?.body ?? '';
      return [
        '[TASK UPDATE]',
        `Task ID: ${event.taskId}`,
        '',
        'User replied:',
        body,
        '',
        'Continue the task.',
      ].join('\n');
    }

    if (messageType === MessageType.CODE_REVIEW) {
      const body = event.payload.comment?.body ?? '';
      return [
        '[CODE REVIEW]',
        `Task ID: ${event.taskId}`,
        '',
        'PR feedback:',
        body,
        '',
        'Fix accordingly.',
      ].join('\n');
    }

    return '';
  }
}
