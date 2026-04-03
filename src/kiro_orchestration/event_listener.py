from __future__ import annotations

from typing import Any

from .models import NormalizedEvent


class EventListener:
    """Normalize Jira/GitBucket webhook payloads into a shared event shape."""

    def normalize(self, source: str, payload: dict[str, Any]) -> NormalizedEvent:
        if source == "jira":
            return self._normalize_jira(payload)
        if source == "gitbucket":
            return self._normalize_gitbucket(payload)
        raise ValueError(f"Unsupported source: {source}")

    def _normalize_jira(self, payload: dict[str, Any]) -> NormalizedEvent:
        webhook_type = payload.get("webhookEvent", "unknown")
        issue = payload.get("issue", {})
        issue_id = issue.get("key", "UNKNOWN")
        event_id = str(payload.get("timestamp", "jira-unknown"))

        mapped_type = "issue_created" if webhook_type.endswith("created") else "comment"

        return NormalizedEvent(
            event_id=event_id,
            source="jira",
            type=mapped_type,
            task_id=issue_id,
            payload=payload,
        )

    def _normalize_gitbucket(self, payload: dict[str, Any]) -> NormalizedEvent:
        action = payload.get("action", "unknown")
        issue = payload.get("issue") or payload.get("pull_request") or {}
        task_id = issue.get("title", "UNKNOWN-TASK")
        event_id = str(payload.get("id", f"gitbucket-{action}"))

        if payload.get("comment"):
            mapped_type = "pr_comment"
        elif "pull_request" in payload:
            mapped_type = "pr"
        else:
            mapped_type = action

        return NormalizedEvent(
            event_id=event_id,
            source="gitbucket",
            type=mapped_type,
            task_id=task_id,
            payload=payload,
        )
