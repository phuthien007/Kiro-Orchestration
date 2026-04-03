from __future__ import annotations

from enum import Enum

from .models import NormalizedEvent


class MessageType(str, Enum):
    NEW_TASK = "NEW_TASK"
    USER_REPLY = "USER_REPLY"
    CODE_REVIEW = "CODE_REVIEW"
    IGNORE = "IGNORE"


class EventRouter:
    def route(self, event: NormalizedEvent) -> MessageType:
        if event.type == "issue_created":
            return MessageType.NEW_TASK
        if event.type == "comment":
            return MessageType.USER_REPLY
        if event.type == "pr_comment":
            return MessageType.CODE_REVIEW
        return MessageType.IGNORE

    def to_agent_message(self, message_type: MessageType, event: NormalizedEvent) -> str:
        if message_type == MessageType.NEW_TASK:
            title = event.payload.get("issue", {}).get("fields", {}).get("summary", "")
            description = event.payload.get("issue", {}).get("fields", {}).get("description", "")
            return (
                "[TASK START]\n"
                f"Task ID: {event.task_id}\n\n"
                f"Title: {title}\n"
                f"Description: {description}\n\n"
                "Start working on this task."
            )

        if message_type == MessageType.USER_REPLY:
            body = event.payload.get("comment", {}).get("body", "")
            return (
                "[TASK UPDATE]\n"
                f"Task ID: {event.task_id}\n\n"
                "User replied:\n"
                f"{body}\n\n"
                "Continue the task."
            )

        if message_type == MessageType.CODE_REVIEW:
            body = event.payload.get("comment", {}).get("body", "")
            return (
                "[CODE REVIEW]\n"
                f"Task ID: {event.task_id}\n\n"
                "PR feedback:\n"
                f"{body}\n\n"
                "Fix accordingly."
            )

        return ""
