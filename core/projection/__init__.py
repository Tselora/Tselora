"""Canonical ProjectionEngine.

The event log is authoritative. This package only derives run, node, graph,
and timeline state. Patches, REST, and UI are later Week 3 slices.
"""

from core.projection.engine import ProjectionEngine, ProjectionRunMismatchError
from core.projection.models import (
    GraphEdge,
    GraphState,
    NodeState,
    ProjectionState,
    RunState,
    TimelineEntry,
    TimelineState,
)

__all__ = [
    "GraphEdge",
    "GraphState",
    "NodeState",
    "ProjectionEngine",
    "ProjectionRunMismatchError",
    "ProjectionState",
    "RunState",
    "TimelineEntry",
    "TimelineState",
]
