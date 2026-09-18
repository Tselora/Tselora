"""Mechanical StatePatch over ProjectionState. Not a second semantic engine."""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict

from core.projection.models import (
    GraphState,
    NodeState,
    ProjectionState,
    RunState,
    TimelineState,
)

PATCH_SCHEMA_VERSION = "tselora.patch.v1"


class PatchApplyError(ValueError):
    """Patch does not apply to this projection snapshot; caller should resync."""


class ProjectionCursor(BaseModel):
    """Identity of a ProjectionState for in-sequence patching. Not causal truth."""

    model_config = ConfigDict(frozen=True)

    last_sequence: int
    event_count: int
    tip_event_id: str | None = None


class StatePatch(BaseModel):
    """Sparse replacement of ProjectionState fields. Absent views stay None."""

    model_config = ConfigDict(frozen=True)

    schema_version: str = PATCH_SCHEMA_VERSION
    run_id: str | None = None
    from_cursor: ProjectionCursor
    to_cursor: ProjectionCursor
    run: RunState | None = None
    nodes: tuple[NodeState, ...] | None = None
    graph: GraphState | None = None
    timeline: TimelineState | None = None


def cursor(state: ProjectionState) -> ProjectionCursor:
    entries = state.timeline.entries
    return ProjectionCursor(
        last_sequence=state.run.last_sequence,
        event_count=len(entries),
        tip_event_id=entries[-1].event_id if entries else None,
    )


def diff(before: ProjectionState, after: ProjectionState) -> StatePatch:
    return StatePatch(
        schema_version=PATCH_SCHEMA_VERSION,
        run_id=after.run.run_id,
        from_cursor=cursor(before),
        to_cursor=cursor(after),
        run=after.run if before.run != after.run else None,
        nodes=after.nodes if before.nodes != after.nodes else None,
        graph=after.graph if before.graph != after.graph else None,
        timeline=after.timeline if before.timeline != after.timeline else None,
    )


def apply_patch(state: ProjectionState, patch: StatePatch) -> ProjectionState:
    if patch.schema_version != PATCH_SCHEMA_VERSION:
        raise PatchApplyError(
            f"unsupported patch schema_version={patch.schema_version!r}"
        )
    state_run_id = state.run.run_id
    if (
        patch.run_id is not None
        and state_run_id is not None
        and patch.run_id != state_run_id
    ):
        raise PatchApplyError(
            f"patch run_id={patch.run_id!r} does not match state run_id={state_run_id!r}"
        )
    current = cursor(state)
    if current != patch.from_cursor:
        raise PatchApplyError("patch from_cursor does not match projection cursor")

    result = ProjectionState(
        run=patch.run if patch.run is not None else state.run,
        nodes=patch.nodes if patch.nodes is not None else state.nodes,
        graph=patch.graph if patch.graph is not None else state.graph,
        timeline=patch.timeline if patch.timeline is not None else state.timeline,
    )
    if cursor(result) != patch.to_cursor:
        raise PatchApplyError("patch to_cursor does not match resulting projection cursor")
    return result
