from concurrent.futures import ThreadPoolExecutor

import pytest

from core.context import ExecutionContext, get_context, require_context
from core.events.sequence import SequenceCounter
from core.events.types import EventType
from sdk import bind_context, node, propagate_context, run, tool
from tests.conftest import RecordingTransport


def test_bind_context_makes_context_available() -> None:
    origin = ExecutionContext(run_id="run_bind", sequence=SequenceCounter())
    origin.push(parent_event_id="evt_origin", node=None, execution_instance_id=None)
    assert get_context() is None

    with bind_context(origin) as bound:
        active = require_context()
        assert active is bound
        assert active is not origin
        assert active.run_id == "run_bind"
        assert active.current_parent_event_id() == "evt_origin"
        assert active.sequence is origin.sequence

    assert get_context() is None


def test_propagate_context_runs_callable_with_originating_context() -> None:
    origin = ExecutionContext(run_id="run_prop", sequence=SequenceCounter())
    origin.push(parent_event_id="evt_parent", node=None, execution_instance_id=None)
    seen: list[str | None] = []

    def worker() -> str:
        ctx = require_context()
        seen.append(ctx.current_parent_event_id())
        return ctx.run_id

    wrapped = propagate_context(worker, ctx=origin)
    assert wrapped() == "run_prop"
    assert seen == ["evt_parent"]
    assert get_context() is None


@tool(name="fetch")
def fetch(query: str) -> str:
    return f"fetched {query}"


@node(name="search")
def search_via_executor() -> str:
    ctx = require_context()
    parent_before = ctx.current_parent_event_id()
    node_before = ctx.current_node()
    assert node_before is not None
    wrapped = propagate_context(fetch)
    with ThreadPoolExecutor(max_workers=1) as pool:
        result = pool.submit(wrapped, "Tselora").result(timeout=5)
    assert require_context() is ctx
    assert ctx.current_parent_event_id() == parent_before
    assert ctx.current_node() is not None
    assert ctx.current_node().id == "search"
    return result


def test_thread_pool_executor_preserves_causal_parent(
    recording_transport: RecordingTransport,
) -> None:
    with run(run_id="run_exec"):
        assert search_via_executor() == "fetched Tselora"

    events = recording_transport.events
    types = [e.type for e in events]
    assert EventType.NODE_STARTED in types
    assert EventType.TOOL_STARTED in types
    node_started = next(e for e in events if e.type == EventType.NODE_STARTED)
    tool_started = next(e for e in events if e.type == EventType.TOOL_STARTED)
    tool_completed = next(e for e in events if e.type == EventType.TOOL_COMPLETED)
    assert tool_started.parent_event_id == node_started.event_id
    assert tool_completed.parent_event_id == tool_started.event_id
    assert tool_started.node is not None
    assert tool_started.node.id == "fetch"
    assert tool_started.execution_instance_id == "fetch#1"
    seq = [e.sequence for e in events]
    assert seq == sorted(seq)
    assert seq == list(range(1, len(events) + 1))


def test_propagated_worker_does_not_mutate_caller_stack() -> None:
    origin = ExecutionContext(run_id="run_iso", sequence=SequenceCounter())
    origin.push(parent_event_id="evt_run", node=None, execution_instance_id=None)

    def worker() -> int:
        ctx = require_context()
        ctx.push(parent_event_id="evt_worker", node=None, execution_instance_id=None)
        assert ctx.current_parent_event_id() == "evt_worker"
        return len(ctx._stack)

    depth = propagate_context(worker, ctx=origin)()
    assert depth == 2
    assert origin.current_parent_event_id() == "evt_run"
    assert len(origin._stack) == 1


def test_separate_executions_do_not_share_context() -> None:
    a = ExecutionContext(run_id="run_a", sequence=SequenceCounter())
    b = ExecutionContext(run_id="run_b", sequence=SequenceCounter())
    a.push(parent_event_id="evt_a", node=None, execution_instance_id=None)
    b.push(parent_event_id="evt_b", node=None, execution_instance_id=None)
    seen: list[str] = []

    def worker() -> str:
        return require_context().run_id

    with ThreadPoolExecutor(max_workers=2) as pool:
        fa = pool.submit(propagate_context(worker, ctx=a))
        fb = pool.submit(propagate_context(worker, ctx=b))
        seen = [fa.result(timeout=5), fb.result(timeout=5)]
    assert set(seen) == {"run_a", "run_b"}
    assert get_context() is None


@tool(name="inner_after_prop")
def inner_after_prop() -> str:
    ctx = require_context()
    assert ctx.current_node() is not None
    assert ctx.current_node().id == "inner_after_prop"
    return "inner"


@node(name="outer_after_prop")
def outer_after_prop() -> str:
    result = inner_after_prop()
    ctx = require_context()
    assert ctx.current_node() is not None
    assert ctx.current_node().id == "outer_after_prop"
    return result


def test_nested_context_still_works_after_propagation(
    recording_transport: RecordingTransport,
) -> None:
    with run():
        wrapped = propagate_context(outer_after_prop)
        with ThreadPoolExecutor(max_workers=1) as pool:
            assert pool.submit(wrapped).result(timeout=5) == "inner"

    events = recording_transport.events
    node_started = next(e for e in events if e.type == EventType.NODE_STARTED)
    tool_started = next(e for e in events if e.type == EventType.TOOL_STARTED)
    tool_completed = next(e for e in events if e.type == EventType.TOOL_COMPLETED)
    node_completed = next(e for e in events if e.type == EventType.NODE_COMPLETED)
    run_started = next(e for e in events if e.type == EventType.RUN_STARTED)
    assert node_started.parent_event_id == run_started.event_id
    assert tool_started.parent_event_id == node_started.event_id
    assert tool_completed.parent_event_id == tool_started.event_id
    assert node_completed.parent_event_id == node_started.event_id


def test_exception_does_not_leave_corrupted_context() -> None:
    origin = ExecutionContext(run_id="run_exc", sequence=SequenceCounter())
    origin.push(parent_event_id="evt_run", node=None, execution_instance_id=None)

    def boom() -> None:
        ctx = require_context()
        ctx.push(parent_event_id="evt_boom", node=None, execution_instance_id=None)
        raise RuntimeError("worker failed")

    with pytest.raises(RuntimeError, match="worker failed"):
        propagate_context(boom, ctx=origin)()

    assert get_context() is None
    assert origin.current_parent_event_id() == "evt_run"
    assert len(origin._stack) == 1

    with ThreadPoolExecutor(max_workers=1) as pool:
        future = pool.submit(propagate_context(boom, ctx=origin))
        with pytest.raises(RuntimeError, match="worker failed"):
            future.result(timeout=5)

    assert origin.current_parent_event_id() == "evt_run"
    assert get_context() is None
