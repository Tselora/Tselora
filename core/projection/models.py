"""Derived projection state. Not a second source of truth."""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


class RunState(BaseModel):
    """Aggregate status for one run."""

    model_config = ConfigDict(frozen=True)

    run_id: str | None = None
    status: str | None = None
    started_event_id: str | None = None
    last_sequence: int = 0


class NodeState(BaseModel):
    """One execution instance of a logical node."""

    model_config = ConfigDict(frozen=True)

    logical_node_id: str
    node_type: str | None = None
    execution_instance_id: str
    status: str | None = None
    started_event_id: str | None = None
    parent_event_id: str | None = None
    last_sequence: int = 0


class GraphEdge(BaseModel):
    """Causal edge taken from ``parent_event_id`` on the child event."""

    model_config = ConfigDict(frozen=True)

    parent_event_id: str
    child_event_id: str
    parent_instance_id: str | None = None
    child_instance_id: str | None = None
    parent_logical_id: str | None = None
    child_logical_id: str | None = None
    child_sequence: int


class GraphState(BaseModel):
    """Execution topology: logical nodes, instances, invocation-to-invocation edges.

    Lifecycle ``*.completed`` / ``*.failed`` are not topology edges.
    """

    model_config = ConfigDict(frozen=True)

    logical_node_ids: tuple[str, ...] = ()
    instance_ids: tuple[str, ...] = ()
    edges: tuple[GraphEdge, ...] = ()


class TimelineEntry(BaseModel):
    """One event on the sequence-ordered timeline."""

    model_config = ConfigDict(frozen=True)

    event_id: str
    sequence: int
    type: str
    status: str | None = None
    node_id: str | None = None
    execution_instance_id: str | None = None
    parent_event_id: str | None = None


class TimelineState(BaseModel):
    model_config = ConfigDict(frozen=True)

    entries: tuple[TimelineEntry, ...] = ()


class ProjectionState(BaseModel):
    """Comparable snapshot of all derived views for one run."""

    model_config = ConfigDict(frozen=True)

    run: RunState = Field(default_factory=RunState)
    nodes: tuple[NodeState, ...] = ()
    graph: GraphState = Field(default_factory=GraphState)
    timeline: TimelineState = Field(default_factory=TimelineState)
