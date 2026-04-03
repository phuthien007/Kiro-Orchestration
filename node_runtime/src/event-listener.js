import { NormalizedEvent } from './models.js';

export class EventListener {
  normalize(source, payload) {
    if (source === 'jira') return this.#normalizeJira(payload);
    if (source === 'gitbucket') return this.#normalizeGitbucket(payload);
    throw new Error(`Unsupported source: ${source}`);
  }

  #normalizeJira(payload) {
    const webhookType = payload.webhookEvent ?? 'unknown';
    const issue = payload.issue ?? {};
    const issueId = issue.key ?? 'UNKNOWN';
    const eventId = String(payload.timestamp ?? `jira-${webhookType}`);

    const mappedType = webhookType.endsWith('created') ? 'issue_created' : 'comment';

    return new NormalizedEvent({
      eventId,
      source: 'jira',
      type: mappedType,
      taskId: issueId,
      payload,
    });
  }

  #normalizeGitbucket(payload) {
    const action = payload.action ?? 'unknown';
    const issue = payload.issue ?? payload.pull_request ?? {};
    const taskId = issue.title ?? 'UNKNOWN-TASK';
    const eventId = String(payload.id ?? `gitbucket-${action}`);

    let mappedType = action;
    if (payload.comment) mappedType = 'pr_comment';
    else if (payload.pull_request) mappedType = 'pr';

    return new NormalizedEvent({
      eventId,
      source: 'gitbucket',
      type: mappedType,
      taskId,
      payload,
    });
  }
}
