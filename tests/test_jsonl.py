from pathlib import Path

from core.events.ids import new_event_id, new_run_id
from core.events.schema import AgentEvent
from core.events.types import EventType
from server.storage.jsonl import JsonlEventStore


def _evt(run_id: str, seq: int, event_id: str | None = None) -> AgentEvent:
    return AgentEvent(
        event_id=event_id or new_event_id(),
        run_id=run_id,
        sequence=seq,
        timestamp=AgentEvent.utcnow(),
        type=EventType.TOOL_STARTED,
    )


def test_jsonl_persist_and_read_back(tmp_path: Path) -> None:
    store = JsonlEventStore(tmp_path)
    run_id = new_run_id()
    event = _evt(run_id, 1)
    assert store.append(event) is True
    path = tmp_path / "runs" / run_id / "events.jsonl"
    text = path.read_text(encoding="utf-8")
    assert text.count("\n") == 1
    lines = [line for line in text.splitlines() if line]
    assert len(lines) == 1
    back = store.read(run_id)
    assert len(back) == 1
    assert back[0].event_id == event.event_id


def test_jsonl_duplicate_event_id(tmp_path: Path) -> None:
    store = JsonlEventStore(tmp_path)
    run_id = new_run_id()
    event = _evt(run_id, 1, event_id="evt_dup")
    assert store.append(event) is True
    assert store.append(event) is False
    assert len(store.read(run_id)) == 1
