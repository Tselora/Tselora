import pytest

from core.context import get_context
from core.events.types import EventType
from sdk import agent, llm, node, run, tool
from tests.conftest import RecordingTransport


@tool(name="search_web")
def search_web(query: str) -> str:
    return f"results for {query}"


@tool(name="boom")
def boom() -> None:
    raise ValueError("nope")


@agent(name="research")
def research() -> str:
    return search_step()


@node(name="search")
def search_step() -> str:
    return fetch("Tselora")


@tool(name="fetch")
def fetch(query: str) -> str:
    return f"fetched {query}"


@llm(name="summarize")
def summarize(text: str) -> str:
    return f"summary:{text}"


@agent(name="agent_ok")
def agent_ok() -> str:
    return "agented"


@node(name="node_ok")
def node_ok() -> str:
    return "noded"


@llm(name="llm_ok")
def llm_ok() -> str:
    return "llmed"


@agent(name="agent_boom")
def agent_boom() -> None:
    raise RuntimeError("agent down")


@node(name="node_boom")
def node_boom() -> None:
    raise RuntimeError("node down")


@llm(name="llm_boom")
def llm_boom() -> None:
    raise RuntimeError("llm down")


@node(name="search_web")
def search_web_node(query: str) -> str:
    return f"hit {query}"


@node(name="outer")
def outer_then_inner() -> str:
    ctx = get_context()
    assert ctx is not None
    assert ctx.current_node() is not None
    assert ctx.current_node().id == "outer"
    result = inner()
    ctx_after = get_context()
    assert ctx_after is not None
    assert ctx_after.current_node() is not None
    assert ctx_after.current_node().id == "outer"
    return result


@tool(name="inner")
def inner() -> str:
    ctx = get_context()
    assert ctx is not None
    assert ctx.current_node() is not None
    assert ctx.current_node().id == "inner"
    return "ok"


def test_tool_started_and_completed(recording_transport: RecordingTransport) -> None:
    with run(run_id="run_fixed") as rid:
        assert search_web("Tselora") == "results for Tselora"
        assert rid == "run_fixed"

    types = [e.type for e in recording_transport.events]
    assert types == [
        EventType.RUN_STARTED,
        EventType.TOOL_STARTED,
        EventType.TOOL_COMPLETED,
        EventType.RUN_COMPLETED,
    ]
    started = recording_transport.events[1]
    completed = recording_transport.events[2]
    assert completed.parent_event_id == started.event_id
    assert started.node is not None
    assert started.node.id == "search_web"
    assert started.node.type == "tool"
    assert started.execution_instance_id == "search_web#1"
    assert all(e.run_id == "run_fixed" for e in recording_transport.events)
    seq = [e.sequence for e in recording_transport.events]
    assert seq == [1, 2, 3, 4]


def test_tool_failed_reraises(recording_transport: RecordingTransport) -> None:
    with pytest.raises(ValueError, match="nope"):
        with run():
            boom()

    types = [e.type for e in recording_transport.events]
    assert EventType.TOOL_STARTED in types
    assert EventType.TOOL_FAILED in types
    assert types[-1] == EventType.RUN_FAILED
    failed = next(e for e in recording_transport.events if e.type == EventType.TOOL_FAILED)
    started = next(e for e in recording_transport.events if e.type == EventType.TOOL_STARTED)
    assert failed.parent_event_id == started.event_id


def test_agent_started_and_completed(recording_transport: RecordingTransport) -> None:
    with run(run_id="run_agent"):
        assert agent_ok() == "agented"

    types = [e.type for e in recording_transport.events]
    assert types == [
        EventType.RUN_STARTED,
        EventType.AGENT_STARTED,
        EventType.AGENT_COMPLETED,
        EventType.RUN_COMPLETED,
    ]
    started = recording_transport.events[1]
    completed = recording_transport.events[2]
    assert completed.parent_event_id == started.event_id
    assert started.node is not None
    assert started.node.id == "agent_ok"
    assert started.node.type == "agent"
    assert started.execution_instance_id == "agent_ok#1"
    assert started.parent_event_id == recording_transport.events[0].event_id


def test_node_started_and_completed(recording_transport: RecordingTransport) -> None:
    with run():
        assert node_ok() == "noded"

    types = [e.type for e in recording_transport.events]
    assert types == [
        EventType.RUN_STARTED,
        EventType.NODE_STARTED,
        EventType.NODE_COMPLETED,
        EventType.RUN_COMPLETED,
    ]
    started = recording_transport.events[1]
    completed = recording_transport.events[2]
    assert completed.parent_event_id == started.event_id
    assert started.node is not None
    assert started.node.id == "node_ok"
    assert started.node.type == "node"
    assert started.execution_instance_id == "node_ok#1"


def test_llm_started_and_completed(recording_transport: RecordingTransport) -> None:
    with run():
        assert llm_ok() == "llmed"

    types = [e.type for e in recording_transport.events]
    assert types == [
        EventType.RUN_STARTED,
        EventType.LLM_STARTED,
        EventType.LLM_COMPLETED,
        EventType.RUN_COMPLETED,
    ]
    started = recording_transport.events[1]
    completed = recording_transport.events[2]
    assert completed.parent_event_id == started.event_id
    assert started.node is not None
    assert started.node.id == "llm_ok"
    assert started.node.type == "llm"
    assert started.execution_instance_id == "llm_ok#1"


@pytest.mark.parametrize(
    ("fn", "started_type", "failed_type", "match"),
    [
        (agent_boom, EventType.AGENT_STARTED, EventType.AGENT_FAILED, "agent down"),
        (node_boom, EventType.NODE_STARTED, EventType.NODE_FAILED, "node down"),
        (llm_boom, EventType.LLM_STARTED, EventType.LLM_FAILED, "llm down"),
    ],
)
def test_decorator_failed_reraises(
    recording_transport: RecordingTransport,
    fn: object,
    started_type: EventType,
    failed_type: EventType,
    match: str,
) -> None:
    with pytest.raises(RuntimeError, match=match):
        with run():
            fn()  # type: ignore[operator]

    types = [e.type for e in recording_transport.events]
    assert started_type in types
    assert failed_type in types
    assert types[-1] == EventType.RUN_FAILED
    started = next(e for e in recording_transport.events if e.type == started_type)
    failed = next(e for e in recording_transport.events if e.type == failed_type)
    assert failed.parent_event_id == started.event_id
    assert started.execution_instance_id == failed.execution_instance_id


def test_nested_agent_node_tool_causal_hierarchy(
    recording_transport: RecordingTransport,
) -> None:
    with run(run_id="run_nest"):
        assert research() == "fetched Tselora"

    events = recording_transport.events
    types = [e.type for e in events]
    assert types == [
        EventType.RUN_STARTED,
        EventType.AGENT_STARTED,
        EventType.NODE_STARTED,
        EventType.TOOL_STARTED,
        EventType.TOOL_COMPLETED,
        EventType.NODE_COMPLETED,
        EventType.AGENT_COMPLETED,
        EventType.RUN_COMPLETED,
    ]
    run_started, agent_started, node_started, tool_started = events[0:4]
    tool_completed, node_completed, agent_completed, run_completed = events[4:8]

    assert agent_started.parent_event_id == run_started.event_id
    assert node_started.parent_event_id == agent_started.event_id
    assert tool_started.parent_event_id == node_started.event_id
    assert tool_completed.parent_event_id == tool_started.event_id
    assert node_completed.parent_event_id == node_started.event_id
    assert agent_completed.parent_event_id == agent_started.event_id
    assert run_completed.parent_event_id == run_started.event_id

    assert agent_started.node is not None and agent_started.node.id == "research"
    assert node_started.node is not None and node_started.node.id == "search"
    assert tool_started.node is not None and tool_started.node.id == "fetch"
    assert [e.sequence for e in events] == list(range(1, 9))


def test_nested_calls_restore_parent_context(
    recording_transport: RecordingTransport,
) -> None:
    with run():
        assert outer_then_inner() == "ok"

    events = recording_transport.events
    node_started = next(e for e in events if e.type == EventType.NODE_STARTED)
    tool_started = next(e for e in events if e.type == EventType.TOOL_STARTED)
    tool_completed = next(e for e in events if e.type == EventType.TOOL_COMPLETED)
    node_completed = next(e for e in events if e.type == EventType.NODE_COMPLETED)
    assert tool_started.parent_event_id == node_started.event_id
    assert tool_completed.parent_event_id == tool_started.event_id
    assert node_completed.parent_event_id == node_started.event_id


def test_repeated_invocation_stable_node_id_distinct_instances(
    recording_transport: RecordingTransport,
) -> None:
    with run():
        assert search_web_node("a") == "hit a"
        assert search_web_node("b") == "hit b"
        assert search_web_node("c") == "hit c"

    started = [e for e in recording_transport.events if e.type == EventType.NODE_STARTED]
    assert len(started) == 3
    assert [e.node.id if e.node else None for e in started] == ["search_web"] * 3
    instances = [e.execution_instance_id for e in started]
    assert instances == ["search_web#1", "search_web#2", "search_web#3"]
    assert len(set(instances)) == 3
    seq = [e.sequence for e in recording_transport.events]
    assert seq == list(range(1, len(recording_transport.events) + 1))


def test_llm_inside_node_uses_parent_event_id(
    recording_transport: RecordingTransport,
) -> None:
    @node(name="writer")
    def writer() -> str:
        return summarize("draft")

    with run():
        writer()

    node_started = next(e for e in recording_transport.events if e.type == EventType.NODE_STARTED)
    llm_started = next(e for e in recording_transport.events if e.type == EventType.LLM_STARTED)
    llm_completed = next(e for e in recording_transport.events if e.type == EventType.LLM_COMPLETED)
    assert llm_started.parent_event_id == node_started.event_id
    assert llm_completed.parent_event_id == llm_started.event_id
    assert llm_started.node is not None
    assert llm_started.node.id == "summarize"
    assert llm_started.execution_instance_id == "summarize#1"
