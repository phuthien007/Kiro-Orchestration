from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any


class SessionStatus(str, Enum):
    CREATE = "create"
    ACTIVE = "active"
    IDLE = "idle"
    TERMINATE = "terminate"


@dataclass(slots=True)
class NormalizedEvent:
    event_id: str
    source: str
    type: str
    task_id: str
    payload: dict[str, Any]
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))


@dataclass(slots=True)
class SessionState:
    task_id: str
    status: SessionStatus = SessionStatus.CREATE
    last_message: str = ""
    last_event_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
