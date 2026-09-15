from __future__ import annotations

from datetime import UTC, datetime

import pytest

from core.events.schema import Actor, AgentEvent, NodeRef
from core.events.types import EventType, SCHEMA_VERSION
from core.projection import ProjectionEngine
from sdk import agent, node, run, tool
from tests.conftest import RecordingTransport


def _evt(
    *,
    event_id: str,
    run_id: str,
    sequence: int,
    type: str,
    parent_event_id: str | None = None,
    node: NodeRef | None = None,
    execution_instance_id: str | None = None,
    status: str | None = None,
) -> AgentEvent:
    return AgentEvent(
        schema_version=SCHEMA_VERSION,
        event_id=event_id,
        run_id=run_id,
        sequence=sequence,
        timestamp=datetime(2026, 9, 15, tzinfo=UTC),
        type=type,
        parent_event_id=parent_event_id,
        actor=Actor(type="test", id="t") if node is None else Actor(type=node.type, id=node.id),
        node=node,
        execution_instance_id=execution_instance_id,
        status=status,
    )


def test_basic_run_projection() -> None:
    events = [
        _evt(event_id="e1", run_id="r1", sequence=1, type=EventType.RUN_STARTED, status="started"),
        _evt(event_id="e2", run_id="r1", sequence=2, type=EventType.RUN_COMPLETED, status="completed"),
    ]
    state = ProjectionEngine().rebuild(events)
    assert state.run.run_id == "r1"
    assert state.run.status == "completed"
    assert state.run.started_event_id == "e1"
    assert [e.type for e in state.timeline.entries] == [
        EventType.RUN_STARTED,
        EventType.RUN_COMPLETED,
    ]


def test_nested_run_agent_node_tool(recording_transport: RecordingTransport) -> None:
    @tool(name="fetch")
    def fetch() -> str:
        return "ok"

    @node(name="search")
    def search() -> str:
        return fetch()

    @agent(name="research")
    def research() -> str:
        return search()

    with run(run_id="run_nest"):
        research()

    state = ProjectionEngine().rebuild(recording_transport.events)
    types = [e.type for e in state.timeline.entries]
    assert types[:4] == [
        EventType.RUN_STARTED,
        EventType.AGENT_STARTED,
        EventType.NODE_STARTED,
        EventType.TOOL_STARTED,
    ]
    by_type = {e.type: e for e in state.timeline.entries}
    assert by_type[EventType.AGENT_STARTED].parent_event_id == by_type[EventType.RUN_STARTED].event_id
    assert by_type[EventType.NODE_STARTED].parent_event_id == by_type[EventType.AGENT_STARTED].event_id
    assert by_type[EventType.TOOL_STARTED].parent_event_id == by_type[EventType.NODE_STARTED].event_id

    edge_pairs = {(e.parent_event_id, e.child_event_id) for e in state.graph.edges}
    assert (
        by_type[EventType.AGENT_STARTED].event_id,
        by_type[EventType.NODE_STARTED].event_id,
    ) in edge_pairs
    assert (
        by_type[EventType.NODE_STARTED].event_id,
        by_type[EventType.TOOL_STARTED].event_id,
    ) in edge_pairs
    completed_ids = {
        e.event_id
        for e in state.timeline.entries
        if str(e.type).endswith(".completed") or str(e.type).endswith(".failed")
    }
    assert completed_ids
    assert not any(edge.child_event_id in completed_ids for edge in state.graph.edges)
    assert EventType.TOOL_COMPLETED in types
    assert state.graph.instance_ids == ("research#1", "search#1", "fetch#1")
    ids = {n.logical_node_id: n.execution_instance_id for n in state.nodes}
    assert ids["research"] == "research#1"
    assert ids["search"] == "search#1"
    assert ids["fetch"] == "fetch#1"


def test_lifecycle_started_completed() -> None:
    node = NodeRef(id="search_web", type="tool")
    events = [
        _evt(event_id="r", run_id="r1", sequence=1, type=EventType.RUN_STARTED, status="started"),
        _evt(
            event_id="s",
            run_id="r1",
            sequence=2,
            type=EventType.TOOL_STARTED,
            parent_event_id="r",
            node=node,
            execution_instance_id="search_web#1",
            status="started",
        ),
        _evt(
            event_id="c",
            run_id="r1",
            sequence=3,
            type=EventType.TOOL_COMPLETED,
            parent_event_id="s",
            node=node,
            execution_instance_id="search_web#1",
            status="completed",
        ),
    ]
    state = ProjectionEngine().rebuild(events)
    inst = {n.execution_instance_id: n for n in state.nodes}
    assert inst["search_web#1"].status == "completed"
    assert inst["search_web#1"].started_event_id == "s"
    assert any(e.type == EventType.TOOL_COMPLETED for e in state.timeline.entries)
    assert all(e.child_event_id != "c" for e in state.graph.edges)


def test_lifecycle_started_failed() -> None:
    node = NodeRef(id="boom", type="tool")
    events = [
        _evt(event_id="r", run_id="r1", sequence=1, type=EventType.RUN_STARTED, status="started"),
        _evt(
            event_id="s",
            run_id="r1",
            sequence=2,
            type=EventType.TOOL_STARTED,
            parent_event_id="r",
            node=node,
            execution_instance_id="boom#1",
            status="started",
        ),
        _evt(
            event_id="f",
            run_id="r1",
            sequence=3,
            type=EventType.TOOL_FAILED,
            parent_event_id="s",
            node=node,
            execution_instance_id="boom#1",
            status="failed",
        ),
        _evt(event_id="rf", run_id="r1", sequence=4, type=EventType.RUN_FAILED, status="failed"),
    ]
    state = ProjectionEngine().rebuild(events)
    inst = {n.execution_instance_id: n for n in state.nodes}
    assert inst["boom#1"].status == "failed"
    assert state.run.status == "failed"
    assert any(e.type == EventType.TOOL_FAILED for e in state.timeline.entries)
    assert all(e.child_event_id != "f" for e in state.graph.edges)


def test_repeated_logical_node_distinct_instances() -> None:
    node = NodeRef(id="search_web", type="node")
    events = [
        _evt(event_id="r", run_id="r1", sequence=1, type=EventType.RUN_STARTED, status="started"),
        _evt(
            event_id="s1",
            run_id="r1",
            sequence=2,
            type=EventType.NODE_STARTED,
            parent_event_id="r",
            node=node,
            execution_instance_id="search_web#1",
            status="started",
        ),
        _evt(
            event_id="c1",
            run_id="r1",
            sequence=3,
            type=EventType.NODE_COMPLETED,
            parent_event_id="s1",
            node=node,
            execution_instance_id="search_web#1",
            status="completed",
        ),
        _evt(
            event_id="s2",
            run_id="r1",
            sequence=4,
            type=EventType.NODE_STARTED,
            parent_event_id="r",
            node=node,
            execution_instance_id="search_web#2",
            status="started",
        ),
        _evt(
            event_id="c2",
            run_id="r1",
            sequence=5,
            type=EventType.NODE_COMPLETED,
            parent_event_id="s2",
            node=node,
            execution_instance_id="search_web#2",
            status="completed",
        ),
    ]
    state = ProjectionEngine().rebuild(events)
    instances = [n.execution_instance_id for n in state.nodes]
    assert instances == ["search_web#1", "search_web#2"]
    assert {n.logical_node_id for n in state.nodes} == {"search_web"}
    assert state.graph.logical_node_ids == ("search_web",)


def test_causal_edges_use_parent_event_id() -> None:
    a = NodeRef(id="a", type="node")
    b = NodeRef(id="b", type="tool")
    events = [
        _evt(event_id="r", run_id="r1", sequence=1, type=EventType.RUN_STARTED, status="started"),
        _evt(
            event_id="as",
            run_id="r1",
            sequence=2,
            type=EventType.NODE_STARTED,
            parent_event_id="r",
            node=a,
            execution_instance_id="a#1",
            status="started",
        ),
        _evt(
            event_id="bs",
            run_id="r1",
            sequence=3,
            type=EventType.TOOL_STARTED,
            parent_event_id="as",
            node=b,
            execution_instance_id="b#1",
            status="started",
        ),
    ]
    edges = ProjectionEngine().rebuild(events).graph.edges
    child_to_parent = {e.child_event_id: e.parent_event_id for e in edges}
    assert child_to_parent["as"] == "r"
    assert child_to_parent["bs"] == "as"


def test_shuffled_arrival_rebuilds_by_sequence() -> None:
    node = NodeRef(id="n", type="node")
    events = [
        _evt(event_id="r", run_id="r1", sequence=1, type=EventType.RUN_STARTED, status="started"),
        _evt(
            event_id="s",
            run_id="r1",
            sequence=2,
            type=EventType.NODE_STARTED,
            parent_event_id="r",
            node=node,
            execution_instance_id="n#1",
            status="started",
        ),
        _evt(
            event_id="c",
            run_id="r1",
            sequence=3,
            type=EventType.NODE_COMPLETED,
            parent_event_id="s",
            node=node,
            execution_instance_id="n#1",
            status="completed",
        ),
    ]
    shuffled = [events[2], events[0], events[1]]
    a = ProjectionEngine().rebuild(events)
    b = ProjectionEngine().rebuild(shuffled)
    assert a == b
    assert [e.sequence for e in b.timeline.entries] == [1, 2, 3]


def test_duplicate_event_id_does_not_duplicate_state() -> None:
    events = [
        _evt(event_id="e1", run_id="r1", sequence=1, type=EventType.RUN_STARTED, status="started"),
        _evt(event_id="e1", run_id="r1", sequence=1, type=EventType.RUN_STARTED, status="started"),
    ]
    engine = ProjectionEngine()
    engine.apply(events[0])
    first = engine.snapshot()
    engine.apply(events[1])
    assert engine.snapshot() == first
    rebuilt = ProjectionEngine().rebuild(events)
    assert rebuilt == first
    assert len(rebuilt.timeline.entries) == 1


def test_unknown_event_type_does_not_crash() -> None:
    events = [
        _evt(event_id="e1", run_id="r1", sequence=1, type=EventType.RUN_STARTED, status="started"),
        _evt(
            event_id="e2",
            run_id="r1",
            sequence=2,
            type="custom.mystery",
            parent_event_id="e1",
            status="started",
        ),
    ]
    state = ProjectionEngine().rebuild(events)
    assert state.timeline.entries[1].type == "custom.mystery"
    assert state.run.status == "started"
    assert all(e.child_event_id != "e2" for e in state.graph.edges)


def test_incremental_apply_equals_rebuild() -> None:
    node = NodeRef(id="n", type="node")
    events = [
        _evt(event_id="r", run_id="r1", sequence=1, type=EventType.RUN_STARTED, status="started"),
        _evt(
            event_id="s",
            run_id="r1",
            sequence=2,
            type=EventType.NODE_STARTED,
            parent_event_id="r",
            node=node,
            execution_instance_id="n#1",
            status="started",
        ),
        _evt(
            event_id="c",
            run_id="r1",
            sequence=3,
            type=EventType.NODE_COMPLETED,
            parent_event_id="s",
            node=node,
            execution_instance_id="n#1",
            status="completed",
        ),
        _evt(event_id="d", run_id="r1", sequence=4, type=EventType.RUN_COMPLETED, status="completed"),
    ]
    incremental = ProjectionEngine()
    for event in events:
        incremental.apply(event)
    rebuilt = ProjectionEngine().rebuild(events)
    assert incremental.snapshot() == rebuilt


def test_timeline_is_sequence_ordered() -> None:
    events = [
        _evt(event_id="e3", run_id="r1", sequence=3, type=EventType.RUN_COMPLETED, status="completed"),
        _evt(event_id="e1", run_id="r1", sequence=1, type=EventType.RUN_STARTED, status="started"),
        _evt(event_id="e2", run_id="r1", sequence=2, type="note.recorded"),
    ]
    engine = ProjectionEngine()
    for event in events:
        engine.apply(event)
    assert [e.sequence for e in engine.snapshot().timeline.entries] == [1, 2, 3]


def test_graph_does_not_edge_from_sequence_adjacency() -> None:
    """Two events in sequence without parent_event_id must not grow a causal edge."""
    events = [
        _evt(event_id="e1", run_id="r1", sequence=1, type=EventType.RUN_STARTED, status="started"),
        _evt(event_id="e2", run_id="r1", sequence=2, type="note.recorded"),
    ]
    state = ProjectionEngine().rebuild(events)
    assert state.graph.edges == ()
    assert len(state.timeline.entries) == 2


def test_completed_failed_are_not_topology_edges() -> None:
    node = NodeRef(id="n", type="node")
    events = [
        _evt(event_id="r", run_id="r1", sequence=1, type=EventType.RUN_STARTED, status="started"),
        _evt(
            event_id="s",
            run_id="r1",
            sequence=2,
            type=EventType.NODE_STARTED,
            parent_event_id="r",
            node=node,
            execution_instance_id="n#1",
            status="started",
        ),
        _evt(
            event_id="c",
            run_id="r1",
            sequence=3,
            type=EventType.NODE_COMPLETED,
            parent_event_id="s",
            node=node,
            execution_instance_id="n#1",
            status="completed",
        ),
    ]
    state = ProjectionEngine().rebuild(events)
    assert [e.child_event_id for e in state.graph.edges] == ["s"]
    assert {e.type for e in state.timeline.entries} >= {
        EventType.NODE_STARTED,
        EventType.NODE_COMPLETED,
    }


def test_child_before_parent_repairs_topology() -> None:
    a = NodeRef(id="a", type="node")
    b = NodeRef(id="b", type="tool")
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
    run_started = _evt(
        event_id="r", run_id="r1", sequence=1, type=EventType.RUN_STARTED, status="started"
    )
    engine = ProjectionEngine()
    engine.apply(child)
    before = {e.child_event_id: e for e in engine.snapshot().graph.edges}
    assert before["bs"].parent_event_id == "as"
    assert before["bs"].parent_instance_id is None
    engine.apply(parent)
    engine.apply(run_started)
    after = {e.child_event_id: e for e in engine.snapshot().graph.edges}
    assert after["bs"].parent_instance_id == "a#1"
    assert after["bs"].parent_logical_id == "a"
    rebuilt = ProjectionEngine().rebuild([child, parent, run_started])
    assert engine.snapshot() == rebuilt


def test_out_of_order_lifecycle_respects_sequence() -> None:
    node = NodeRef(id="n", type="node")
    started = _evt(
        event_id="s",
        run_id="r1",
        sequence=2,
        type=EventType.NODE_STARTED,
        parent_event_id="r",
        node=node,
        execution_instance_id="n#1",
        status="started",
    )
    completed = _evt(
        event_id="c",
        run_id="r1",
        sequence=3,
        type=EventType.NODE_COMPLETED,
        parent_event_id="s",
        node=node,
        execution_instance_id="n#1",
        status="completed",
    )
    run_started = _evt(
        event_id="r", run_id="r1", sequence=1, type=EventType.RUN_STARTED, status="started"
    )
    run_completed = _evt(
        event_id="d", run_id="r1", sequence=4, type=EventType.RUN_COMPLETED, status="completed"
    )
    engine = ProjectionEngine()
    engine.apply(completed)
    engine.apply(run_completed)
    engine.apply(started)
    engine.apply(run_started)
    state = engine.snapshot()
    inst = {n.execution_instance_id: n for n in state.nodes}
    assert inst["n#1"].status == "completed"
    assert inst["n#1"].started_event_id == "s"
    assert state.run.status == "completed"
    assert state.run.started_event_id == "r"


def test_logical_node_ids_are_sequence_deterministic() -> None:
    z = NodeRef(id="zeta", type="node")
    a = NodeRef(id="alpha", type="node")
    events = [
        _evt(event_id="r", run_id="r1", sequence=1, type=EventType.RUN_STARTED, status="started"),
        _evt(
            event_id="z",
            run_id="r1",
            sequence=3,
            type=EventType.NODE_STARTED,
            parent_event_id="r",
            node=z,
            execution_instance_id="zeta#1",
            status="started",
        ),
        _evt(
            event_id="a",
            run_id="r1",
            sequence=2,
            type=EventType.NODE_STARTED,
            parent_event_id="r",
            node=a,
            execution_instance_id="alpha#1",
            status="started",
        ),
    ]
    live = ProjectionEngine()
    for event in (events[2], events[1], events[0]):
        live.apply(event)
    rebuilt = ProjectionEngine().rebuild(events)
    assert live.snapshot().graph.logical_node_ids == ("alpha", "zeta")
    assert rebuilt.graph.logical_node_ids == ("alpha", "zeta")
    assert live.snapshot().graph.logical_node_ids == rebuilt.graph.logical_node_ids


def test_mismatched_run_id_is_rejected() -> None:
    from core.projection import ProjectionRunMismatchError

    engine = ProjectionEngine(run_id="r1")
    engine.apply(_evt(event_id="e1", run_id="r1", sequence=1, type=EventType.RUN_STARTED, status="started"))
    with pytest.raises(ProjectionRunMismatchError, match="r1"):
        engine.apply(
            _evt(event_id="e2", run_id="r2", sequence=1, type=EventType.RUN_STARTED, status="started")
        )
    unbound = ProjectionEngine()
    unbound.apply(_evt(event_id="a", run_id="ra", sequence=1, type=EventType.RUN_STARTED, status="started"))
    with pytest.raises(ProjectionRunMismatchError, match="ra"):
        unbound.apply(
            _evt(event_id="b", run_id="rb", sequence=1, type=EventType.RUN_STARTED, status="started")
        )


def test_arbitrary_apply_order_converges_with_rebuild() -> None:
    node = NodeRef(id="n", type="node")
    tool = NodeRef(id="t", type="tool")
    events = [
        _evt(event_id="r", run_id="r1", sequence=1, type=EventType.RUN_STARTED, status="started"),
        _evt(
            event_id="ns",
            run_id="r1",
            sequence=2,
            type=EventType.NODE_STARTED,
            parent_event_id="r",
            node=node,
            execution_instance_id="n#1",
            status="started",
        ),
        _evt(
            event_id="ts",
            run_id="r1",
            sequence=3,
            type=EventType.TOOL_STARTED,
            parent_event_id="ns",
            node=tool,
            execution_instance_id="t#1",
            status="started",
        ),
        _evt(
            event_id="tc",
            run_id="r1",
            sequence=4,
            type=EventType.TOOL_COMPLETED,
            parent_event_id="ts",
            node=tool,
            execution_instance_id="t#1",
            status="completed",
        ),
        _evt(
            event_id="nc",
            run_id="r1",
            sequence=5,
            type=EventType.NODE_COMPLETED,
            parent_event_id="ns",
            node=node,
            execution_instance_id="n#1",
            status="completed",
        ),
        _evt(event_id="d", run_id="r1", sequence=6, type=EventType.RUN_COMPLETED, status="completed"),
    ]
    live = ProjectionEngine()
    for event in reversed(events):
        live.apply(event)
    rebuilt = ProjectionEngine().rebuild(events)
    assert live.snapshot() == rebuilt
    assert [e.child_event_id for e in live.snapshot().graph.edges] == ["ns", "ts"]
