import pytest

from core.events.types import EventType
from sdk import run, tool
from tests.conftest import RecordingTransport


@tool(name="search_web")
def search_web(query: str) -> str:
    return f"results for {query}"


@tool(name="boom")
def boom() -> None:
    raise ValueError("nope")


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
