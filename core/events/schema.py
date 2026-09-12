"""Pydantic v2 envelope for the Universal Agent Event Protocol."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_serializer

from core.events.types import SCHEMA_VERSION


class Actor(BaseModel):
    """Who performed the step (agent, tool runtime, human, ...)."""

    model_config = ConfigDict(extra="allow")

    type: str
    id: str


class NodeRef(BaseModel):
    """Logical node identity. Distinct from ``execution_instance_id``."""

    model_config = ConfigDict(extra="allow")

    id: str
    type: str


class AgentEvent(BaseModel):
    """One protocol event. Framework objects must not appear here."""

    model_config = ConfigDict(extra="allow")

    schema_version: str = SCHEMA_VERSION
    event_id: str
    run_id: str
    sequence: int = Field(ge=1)
    timestamp: datetime
    type: str

    parent_event_id: str | None = None
    actor: Actor | None = None
    node: NodeRef | None = None
    execution_instance_id: str | None = None
    status: str | None = None
    payload: dict[str, Any] | None = None
    metadata: dict[str, Any] | None = None

    @field_serializer("timestamp")
    def _serialize_timestamp(self, value: datetime) -> str:
        ts = value.astimezone(UTC).replace(microsecond=0)
        return ts.strftime("%Y-%m-%dT%H:%M:%SZ")

    @classmethod
    def utcnow(cls) -> datetime:
        return datetime.now(UTC)
