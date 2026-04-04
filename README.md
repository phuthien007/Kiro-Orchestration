# Kiro Orchestration (Node.js runtime)

Node.js implementation of event-driven, session-based orchestration for Jira + GitBucket webhook events.

## Run

```bash
npm start
```

Default endpoint:
- `POST /webhook/jira`
- `POST /webhook/gitbucket`

## Concurrency handling per Jira task/session

`SessionManager` now enforces per-task safety:
- **Debounce window** (`debounceWindowMs`, default `300ms`): events arriving close together for the same task are buffered and merged before sending to the existing chat session.
- **Serialized delivery**: while a session is still processing one message, the next buffered message waits in queue and is only sent after the previous interaction is completed.

## Mock Kiro CLI

This runtime uses `cat` as the mock Kiro CLI process in `node_runtime/src/app.js`.

## Test

```bash
npm test
```
