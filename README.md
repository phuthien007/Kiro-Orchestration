# Kiro Orchestration (Node.js runtime)

Node.js implementation of event-driven, session-based orchestration for Jira + GitBucket webhook events.

## Run

```bash
npm start
```

Default endpoint:
- `POST /webhook/jira`
- `POST /webhook/gitbucket`

## Mock Kiro CLI

This runtime uses `cat` as the mock Kiro CLI process in `node_runtime/src/app.js`.

## Test

```bash
npm test
```
