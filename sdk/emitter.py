"""Construct protocol events and hand them to transport (not storage)."""

from __future__ import annotations

from typing import Any

from core.context import ExecutionContext, require_context
from core.events.ids import new_event_id
from core.events.schema import Actor, AgentEvent, NodeRef
from core.events.types import SCHEMA_VERSION


class EventEmitter:
    """Assign event_id and sequence once, then send via transport/batcher."""

    def __init__(self, transport: Any) -> None:
        self._transport = transport

    def emit(
        self,
        type: str,
        *,
        status: str | None = None,
        payload: dict[str, Any] | None = None,
        metadata: dict[str, Any] | None = None,
        actor: Actor | None = None,
        node: NodeRef | None = None,
        execution_instance_id: str | None = None,
        parent_event_id: str | None = None,
        ctx: ExecutionContext | None = None,
    ) -> AgentEvent:
        """Build one event and hand it off. Retries must reuse this object."""
        context = ctx or require_context()
        if parent_event_id is None:
            parent_event_id = context.current_parent_event_id()
        if node is None:
            node = context.current_node()

        event = AgentEvent(
            schema_version=SCHEMA_VERSION,
            event_id=new_event_id(),
            run_id=context.run_id,
            sequence=context.sequence.next(),
            timestamp=AgentEvent.utcnow(),
            type=type,
            parent_event_id=parent_event_id,
            actor=actor,
            node=node,
            execution_instance_id=execution_instance_id,
            status=status,
            payload=payload,
            metadata=metadata,
        )
        self._transport.send(event)
        return event

    def flush(self, timeout: float = 30.0) -> None:
        """Wait for a batcher to drain. No-op for synchronous transports."""
        flush = getattr(self._transport, "flush", None)
        if callable(flush):
            flush(timeout=timeout)

    def close(self) -> None:
        """Close a batcher if present. Does not close HTTP clients by default."""
        closer = getattr(self._transport, "close", None)
        if callable(closer):
            closer()
