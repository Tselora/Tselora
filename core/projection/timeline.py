"""Sequence-ordered timeline. Arrival order is ignored."""

from __future__ import annotations

from core.events.schema import AgentEvent
from core.projection.models import TimelineEntry, TimelineState


def entry_from_event(event: AgentEvent) -> TimelineEntry:
    return TimelineEntry(
        event_id=event.event_id,
        sequence=event.sequence,
        type=event.type,
        status=event.status,
        node_id=event.node.id if event.node is not None else None,
        execution_instance_id=event.execution_instance_id,
        parent_event_id=event.parent_event_id,
    )


def freeze_timeline(entries_by_id: dict[str, TimelineEntry]) -> TimelineState:
    ordered = tuple(
        sorted(entries_by_id.values(), key=lambda e: (e.sequence, e.event_id))
    )
    return TimelineState(entries=ordered)
