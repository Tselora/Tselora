from __future__ import annotations

import pytest

from core.events.schema import NodeRef
from core.events.types import EventType
from core.projection.engine import ProjectionEngine
from core.projection.models import GraphState, ProjectionState, RunState, TimelineState
from core.projection.patches import (
    PATCH_SCHEMA_VERSION,
    PatchApplyError,
    StatePatch,
    apply_patch,
    cursor,
    diff,
)
from sdk import agent, node, run, tool
from tests.conftest import RecordingTransport
from tests.test_projection import _evt


def test_diff_same_state_is_noop() -> None:
    state = ProjectionState()
    patch = diff(state, state)
    assert patch.schema_version == PATCH_SCHEMA_VERSION
    assert patch.from_cursor == patch.to_cursor == cursor(state)
    assert patch.run is None
    assert patch.nodes is None
    assert patch.graph is None
    assert patch.timeline is None
    assert apply_patch(state, patch) == state


def test_changed_run_replaces_run() -> None:
    before = ProjectionState()
    after = ProjectionState(run=RunState(run_id="r1", status="started", last_sequence=1))
    patch = diff(before, after)
    assert patch.run == after.run
    assert patch.nodes is None
    assert apply_patch(before, patch) == after


def test_changed_nodes_replaces_complete_tuple() -> None:
    engine = ProjectionEngine(run_id="r1")
    before = engine.snapshot()
    engine.apply(
        _evt(
            event_id="s",
            run_id="r1",
            sequence=1,
            type=EventType.TOOL_STARTED,
            node=NodeRef(id="t", type="tool"),
            execution_instance_id="t#1",
            status="started",
        )
    )
    after = engine.snapshot()
    patch = diff(before, after)
    assert patch.nodes == after.nodes
    assert apply_patch(before, patch).nodes == after.nodes


def test_changed_graph_replaces_complete_graph() -> None:
    engine = ProjectionEngine(run_id="r1")
    before = engine.snapshot()
    engine.apply(
        _evt(
            event_id="s",
            run_id="r1",
            sequence=1,
            type=EventType.TOOL_STARTED,
            parent_event_id="r",
            node=NodeRef(id="t", type="tool"),
            execution_instance_id="t#1",
            status="started",
        )
    )
    after = engine.snapshot()
    patch = diff(before, after)
    assert patch.graph == after.graph
    assert patch.graph is not None
    assert apply_patch(before, patch).graph == after.graph


def test_changed_timeline_replaces_complete_timeline() -> None:
    before = ProjectionState()
    after = ProjectionEngine(run_id="r1").rebuild(
        [
            _evt(
                event_id="e1",
                run_id="r1",
                sequence=1,
                type=EventType.RUN_STARTED,
                status="started",
            )
        ]
    )
    patch = diff(before, after)
    assert patch.timeline == after.timeline
    assert apply_patch(before, patch).timeline == after.timeline


def test_field_sparse_preserves_unchanged_views() -> None:
    started = ProjectionEngine(run_id="r1").rebuild(
        [
            _evt(
                event_id="e1",
                run_id="r1",
                sequence=1,
                type=EventType.RUN_STARTED,
                status="started",
            )
        ]
    )
    completed = ProjectionEngine(run_id="r1").rebuild(
        [
            _evt(
                event_id="e1",
                run_id="r1",
                sequence=1,
                type=EventType.RUN_STARTED,
                status="started",
            ),
            _evt(
                event_id="e2",
                run_id="r1",
                sequence=2,
                type=EventType.RUN_COMPLETED,
                status="completed",
            ),
        ]
    )
    patch = diff(started, completed)
    assert patch.graph is None
    assert patch.run == completed.run
    assert patch.timeline == completed.timeline
    merged = apply_patch(started, patch)
    assert merged.graph == started.graph == completed.graph
    assert merged == completed


def test_wrong_from_cursor_rejected() -> None:
    empty = ProjectionState()
    after = ProjectionState(run=RunState(run_id="r1", last_sequence=1))
    patch = diff(empty, after)
    with pytest.raises(PatchApplyError, match="from_cursor"):
        apply_patch(after, patch)


def test_wrong_run_id_rejected() -> None:
    state = ProjectionState(run=RunState(run_id="r1", last_sequence=0))
    patch = StatePatch(
        run_id="r2",
        from_cursor=cursor(state),
        to_cursor=cursor(state),
    )
    with pytest.raises(PatchApplyError, match="run_id"):
        apply_patch(state, patch)


def test_wrong_to_cursor_rejected() -> None:
    before = ProjectionState()
    after = ProjectionState(run=RunState(run_id="r1", last_sequence=1))
    good = diff(before, after)
    bad = good.model_copy(
        update={"to_cursor": good.to_cursor.model_copy(update={"last_sequence": 99})}
    )
    with pytest.raises(PatchApplyError, match="to_cursor"):
        apply_patch(before, bad)


def test_nested_sdk_round_trip_diff_apply(recording_transport: RecordingTransport) -> None:
    @tool(name="fetch")
    def fetch() -> str:
        return "ok"

    @node(name="search")
    def search() -> str:
        return fetch()

    @agent(name="research")
    def research() -> str:
        return search()

    with run(run_id="run_patch_nest"):
        research()

    events = sorted(
        recording_transport.events, key=lambda e: (e.run_id, e.sequence, e.event_id)
    )
    rebuilt = ProjectionEngine(run_id="run_patch_nest").rebuild(events)
    state = ProjectionState()
    engine = ProjectionEngine(run_id="run_patch_nest")
    for event in events:
        before = engine.snapshot()
        engine.apply(event)
        state = apply_patch(state, diff(before, engine.snapshot()))
    assert state == rebuilt == engine.snapshot()


def test_child_before_parent_is_graph_replacement() -> None:
    a = NodeRef(id="a", type="node")
    b = NodeRef(id="b", type="tool")
    child = _evt(
        event_id="bs",
        run_id="r1",
        sequence=3,
        type=EventType.TOOL_STARTED,
        parent_event_id="as",
        node=b,
        execution_instance_id="b#1",
        status="started",
    )
    parent = _evt(
        event_id="as",
        run_id="r1",
        sequence=2,
        type=EventType.NODE_STARTED,
        parent_event_id="r",
        node=a,
        execution_instance_id="a#1",
        status="started",
    )
    engine = ProjectionEngine(run_id="r1")
    engine.apply(child)
    before = engine.snapshot()
    engine.apply(parent)
    after = engine.snapshot()
    patch = diff(before, after)
    assert patch.graph == after.graph
    assert patch.graph is not None
    edges = {e.child_event_id: e for e in patch.graph.edges}
    assert edges["bs"].parent_instance_id == "a#1"
    assert apply_patch(before, patch) == after


def test_completed_does_not_invent_graph_in_patch() -> None:
    node = NodeRef(id="t", type="tool")
    started_events = [
        _evt(event_id="r", run_id="r1", sequence=1, type=EventType.RUN_STARTED, status="started"),
        _evt(
            event_id="s",
            run_id="r1",
            sequence=2,
            type=EventType.TOOL_STARTED,
            parent_event_id="r",
            node=node,
            execution_instance_id="t#1",
            status="started",
        ),
    ]
    completed_events = [
        *started_events,
        _evt(
            event_id="c",
            run_id="r1",
            sequence=3,
            type=EventType.TOOL_COMPLETED,
            parent_event_id="s",
            node=node,
            execution_instance_id="t#1",
            status="completed",
        ),
        _evt(
            event_id="f",
            run_id="r1",
            sequence=4,
            type=EventType.TOOL_FAILED,
            parent_event_id="s",
            node=node,
            execution_instance_id="t#1",
            status="failed",
        ),
    ]
    started = ProjectionEngine(run_id="r1").rebuild(started_events)
    after = ProjectionEngine(run_id="r1").rebuild(completed_events)
    patch = diff(started, after)
    assert patch.graph is None
    assert apply_patch(started, patch).graph == started.graph


def test_json_round_trip() -> None:
    after = ProjectionEngine(run_id="r1").rebuild(
        [
            _evt(
                event_id="e1",
                run_id="r1",
                sequence=1,
                type=EventType.RUN_STARTED,
                status="started",
            )
        ]
    )
    patch = diff(ProjectionState(), after)
    loaded = StatePatch.model_validate(patch.model_dump(mode="json"))
    assert loaded == patch
    assert loaded.model_dump(mode="json") == patch.model_dump(mode="json")
    assert loaded.run == after.run
    assert loaded.timeline == after.timeline


def test_diff_is_deterministic() -> None:
    before = ProjectionState()
    after = ProjectionState(
        run=RunState(run_id="r1", status="started", last_sequence=1),
        graph=GraphState(logical_node_ids=()),
        timeline=TimelineState(),
    )
    assert diff(before, after) == diff(before, after)


def test_unsupported_schema_version_rejected() -> None:
    state = ProjectionState()
    patch = diff(state, state).model_copy(update={"schema_version": "other"})
    with pytest.raises(PatchApplyError, match="schema_version"):
        apply_patch(state, patch)
