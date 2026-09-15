"""Execution-topology edges from started invocations, not the lifecycle event DAG."""

from __future__ import annotations

from core.events.schema import AgentEvent
from core.projection.models import GraphEdge, GraphState

_LIFECYCLE_NON_START = (".completed", ".failed", ".cancelled")


def is_topology_event(event: AgentEvent) -> bool:
    """Topology edges come from ``*.started`` (invocation begin), not complete/fail."""
    return event.type.endswith(".started")


def edge_from_started(
    event: AgentEvent,
    *,
    parent_instance_id: str | None,
    parent_logical_id: str | None,
    child_instance_id: str | None,
) -> GraphEdge | None:
    """Edge from ``parent_event_id`` on a started event. Never uses time or adjacency."""
    if not is_topology_event(event) or not event.parent_event_id:
        return None
    if any(event.type.endswith(suffix) for suffix in _LIFECYCLE_NON_START):
        return None
    child_logical = event.node.id if event.node is not None else None
    return GraphEdge(
        parent_event_id=event.parent_event_id,
        child_event_id=event.event_id,
        parent_instance_id=parent_instance_id,
        child_instance_id=child_instance_id,
        parent_logical_id=parent_logical_id,
        child_logical_id=child_logical,
        child_sequence=event.sequence,
    )


def freeze_graph(
    logical_first_seq: dict[str, int],
    instance_first_seq: dict[str, int],
    edges_by_child: dict[str, GraphEdge],
) -> GraphState:
    logical_node_ids = tuple(
        sorted(logical_first_seq, key=lambda nid: (logical_first_seq[nid], nid))
    )
    instance_ids = tuple(
        sorted(instance_first_seq, key=lambda iid: (instance_first_seq[iid], iid))
    )
    edges = tuple(
        sorted(edges_by_child.values(), key=lambda e: (e.child_sequence, e.child_event_id))
    )
    return GraphState(
        logical_node_ids=logical_node_ids,
        instance_ids=instance_ids,
        edges=edges,
    )
