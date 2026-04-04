from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Callable

from .event_router import EventRouter, MessageType
from .kiro_session import KiroSession
from .models import NormalizedEvent, SessionState, SessionStatus


@dataclass(slots=True)
class SessionRecord:
    state: SessionState
    process: KiroSession


class SessionManager:
    def __init__(
        self,
        session_factory: Callable[[], KiroSession],
        router: EventRouter,
        idle_timeout: timedelta = timedelta(hours=24),
    ) -> None:
        self._session_factory = session_factory
        self._router = router
        self._idle_timeout = idle_timeout
        self._sessions: dict[str, SessionRecord] = {}
        self._processed_event_ids: set[str] = set()

    def handle_event(self, event: NormalizedEvent) -> MessageType:
        if event.event_id in self._processed_event_ids:
            return MessageType.IGNORE
        self._processed_event_ids.add(event.event_id)

        msg_type = self._router.route(event)
        if msg_type == MessageType.IGNORE:
            return msg_type

        record = self._sessions.get(event.task_id)
        if record is None:
            record = SessionRecord(
                state=SessionState(task_id=event.task_id, status=SessionStatus.CREATE),
                process=self._session_factory(),
            )
            self._sessions[event.task_id] = record

        outbound = self._router.to_agent_message(msg_type, event)
        record.process.send(outbound)
        record.state.last_message = outbound
        record.state.last_event_at = datetime.now(timezone.utc)
        record.state.status = SessionStatus.ACTIVE
        return msg_type

    def mark_idle(self, task_id: str) -> None:
        record = self._sessions.get(task_id)
        if not record:
            return
        record.state.status = SessionStatus.IDLE

    def terminate_if_expired(self, now: datetime | None = None) -> list[str]:
        now = now or datetime.now(timezone.utc)
        terminated: list[str] = []

        for task_id, record in list(self._sessions.items()):
            if record.state.status == SessionStatus.TERMINATE:
                continue

            if now - record.state.last_event_at > self._idle_timeout:
                record.process.stop()
                record.state.status = SessionStatus.TERMINATE
                terminated.append(task_id)

        return terminated

    def terminate_task(self, task_id: str) -> bool:
        record = self._sessions.get(task_id)
        if not record:
            return False

        record.process.stop()
        record.state.status = SessionStatus.TERMINATE
        return True
