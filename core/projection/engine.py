"""Canonical fold of the event log. Derived state only; the log remains truth."""

from __future__ import annotations

from collections.abc import Iterable

from core.events.schema import AgentEvent
from core.projection.graph import edge_from_started, freeze_graph
from core.projection.models import (
    GraphEdge,
    NodeState,
    ProjectionState,
    RunState,
    TimelineEntry,
)
from core.projection.timeline import entry_from_event, freeze_timeline

_STARTED_SUFFIX = ".started"
_COMPLETED_SUFFIX = ".completed"
_FAILED_SUFFIX = ".failed"
_CANCELLED_SUFFIX = ".cancelled"


class ProjectionRunMismatchError(ValueError):
    """This engine is bound to a different ``run_id`` than the event."""


class ProjectionEngine:
    """Incrementally apply events or rebuild from a log.

    One instance projects exactly one run. Duplicate ``event_id`` is a no-op.
    ``rebuild`` sorts by ``(run_id, sequence)``.
    """

    def __init__(self, run_id: str | None = None) -> None:
        self._configured_run_id = run_id
        self._clear()

    def _clear(self) -> None:
        self._seen: set[str] = set()
        self._run_id: str | None = self._configured_run_id
        self._run_status: str | None = None
        self._run_started_event_id: str | None = None
        self._run_status_seq: int = 0
        self._run_last_sequence: int = 0
        self._nodes: dict[str, NodeState] = {}
        self._event_instance: dict[str, str] = {}
        self._event_logical: dict[str, str] = {}
        self._logical_first_seq: dict[str, int] = {}
        self._instance_first_seq: dict[str, int] = {}
        self._edges: dict[str, GraphEdge] = {}
        self._waiting_for_parent: dict[str, list[str]] = {}
        self._timeline: dict[str, TimelineEntry] = {}

    def snapshot(self) -> ProjectionState:
        nodes = tuple(
            sorted(
                self._nodes.values(),
                key=lambda n: (
                    self._instance_first_seq.get(n.execution_instance_id, n.last_sequence),
                    n.execution_instance_id,
                ),
            )
        )
        return ProjectionState(
            run=RunState(
                run_id=self._run_id,
                status=self._run_status,
                started_event_id=self._run_started_event_id,
                last_sequence=self._run_last_sequence,
            ),
            nodes=nodes,
            graph=freeze_graph(self._logical_first_seq, self._instance_first_seq, self._edges),
            timeline=freeze_timeline(self._timeline),
        )

    def apply(self, event: AgentEvent) -> None:
        if self._run_id is None:
            self._run_id = event.run_id
        elif event.run_id != self._run_id:
            raise ProjectionRunMismatchError(
                f"projection bound to run_id={self._run_id!r}, got {event.run_id!r}"
            )

        if event.event_id in self._seen:
            return
        self._seen.add(event.event_id)

        if event.sequence > self._run_last_sequence:
            self._run_last_sequence = event.sequence

        self._timeline[event.event_id] = entry_from_event(event)
        self._apply_run_lifecycle(event)

        instance_id = self._instance_key(event)
        if event.node is not None:
            first = self._logical_first_seq.get(event.node.id)
            if first is None or event.sequence < first:
                self._logical_first_seq[event.node.id] = event.sequence

        if instance_id is not None:
            self._event_instance[event.event_id] = instance_id
            if event.node is not None:
                self._event_logical[event.event_id] = event.node.id
            first_i = self._instance_first_seq.get(instance_id)
            if first_i is None or event.sequence < first_i:
                self._instance_first_seq[instance_id] = event.sequence
            self._upsert_instance(event, instance_id)

        self._maybe_add_topology_edge(event, instance_id)
        self._resolve_waiters(event.event_id)

    def rebuild(self, events: Iterable[AgentEvent]) -> ProjectionState:
        """Reset and fold ``events`` ordered by producer ``sequence``, not arrival."""
        self._clear()
        ordered = sorted(events, key=lambda e: (e.run_id, e.sequence, e.event_id))
        for event in ordered:
            self.apply(event)
        return self.snapshot()

    def _maybe_add_topology_edge(self, event: AgentEvent, instance_id: str | None) -> None:
        parent_id = event.parent_event_id
        parent_instance = self._event_instance.get(parent_id) if parent_id else None
        parent_logical = self._event_logical.get(parent_id) if parent_id else None
        edge = edge_from_started(
            event,
            parent_instance_id=parent_instance,
            parent_logical_id=parent_logical,
            child_instance_id=instance_id,
        )
        if edge is None:
            return
        self._edges[event.event_id] = edge
        if parent_id and parent_id not in self._seen:
            self._waiting_for_parent.setdefault(parent_id, []).append(event.event_id)

    def _resolve_waiters(self, arrived_event_id: str) -> None:
        inst = self._event_instance.get(arrived_event_id)
        logical = self._event_logical.get(arrived_event_id)
        waiting = self._waiting_for_parent.pop(arrived_event_id, [])
        if not waiting:
            return
        for child_eid in waiting:
            edge = self._edges.get(child_eid)
            if edge is None:
                continue
            self._edges[child_eid] = edge.model_copy(
                update={
                    "parent_instance_id": inst if inst is not None else edge.parent_instance_id,
                    "parent_logical_id": logical if logical is not None else edge.parent_logical_id,
                }
            )

    def _apply_run_lifecycle(self, event: AgentEvent) -> None:
        kind, _, phase = event.type.partition(".")
        if kind != "run" or not phase:
            return
        if phase == "started" and self._run_started_event_id is None:
            self._run_started_event_id = event.event_id
        if event.sequence < self._run_status_seq:
            return
        if phase == "started":
            status = event.status or "started"
        else:
            status = event.status or phase
        self._run_status = status
        self._run_status_seq = event.sequence

    def _instance_key(self, event: AgentEvent) -> str | None:
        if event.execution_instance_id:
            return event.execution_instance_id
        if event.node is not None:
            return event.node.id
        return None

    def _lifecycle_status(self, event: AgentEvent) -> str | None:
        if event.type.endswith(_STARTED_SUFFIX):
            return event.status or "started"
        if event.type.endswith(_COMPLETED_SUFFIX):
            return event.status or "completed"
        if event.type.endswith(_FAILED_SUFFIX):
            return event.status or "failed"
        if event.type.endswith(_CANCELLED_SUFFIX):
            return event.status or "cancelled"
        return event.status

    def _upsert_instance(self, event: AgentEvent, instance_id: str) -> None:
        logical = event.node.id if event.node is not None else instance_id
        node_type = event.node.type if event.node is not None else None
        existing = self._nodes.get(instance_id)
        status = self._lifecycle_status(event)

        if existing is None:
            parent = event.parent_event_id if event.type.endswith(_STARTED_SUFFIX) else None
            self._nodes[instance_id] = NodeState(
                logical_node_id=logical,
                node_type=node_type,
                execution_instance_id=instance_id,
                status=status,
                started_event_id=event.event_id if event.type.endswith(_STARTED_SUFFIX) else None,
                parent_event_id=parent,
                last_sequence=event.sequence,
            )
            return

        started_id = existing.started_event_id
        if event.type.endswith(_STARTED_SUFFIX):
            started_id = event.event_id
        parent = existing.parent_event_id
        if event.type.endswith(_STARTED_SUFFIX) and event.parent_event_id:
            parent = event.parent_event_id
        new_status = existing.status
        if event.sequence >= existing.last_sequence and status is not None:
            new_status = status
        self._nodes[instance_id] = existing.model_copy(
            update={
                "status": new_status,
                "started_event_id": started_id,
                "parent_event_id": parent,
                "last_sequence": max(existing.last_sequence, event.sequence),
                "logical_node_id": logical or existing.logical_node_id,
                "node_type": node_type or existing.node_type,
            }
        )
