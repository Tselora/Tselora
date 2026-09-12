from pathlib import Path

from fastapi.testclient import TestClient

from core.events.ids import new_event_id, new_run_id
from core.events.schema import AgentEvent
from core.events.types import EventType
from server.collector.app import create_app
from server.storage.jsonl import JsonlEventStore


def _payload(run_id: str, seq: int, event_id: str | None = None, type_: str = EventType.RUN_STARTED) -> dict:
    event = AgentEvent(
        event_id=event_id or new_event_id(),
        run_id=run_id,
        sequence=seq,
        timestamp=AgentEvent.utcnow(),
        type=type_,
    )
    return event.model_dump(mode="json")


def test_valid_event_accepted(tmp_path: Path) -> None:
    client = TestClient(create_app(store=JsonlEventStore(tmp_path)))
    run_id = new_run_id()
    body = _payload(run_id, 1)
    response = client.post("/v1/events", json=body)
    assert response.status_code == 200
    assert response.json()["duplicate"] is False
    assert (tmp_path / "runs" / run_id / "events.jsonl").is_file()


def test_duplicate_event_id_idempotent(tmp_path: Path) -> None:
    client = TestClient(create_app(store=JsonlEventStore(tmp_path)))
    run_id = new_run_id()
    body = _payload(run_id, 1, event_id="evt_same")
    first = client.post("/v1/events", json=body)
    second = client.post("/v1/events", json=body)
    assert first.json()["duplicate"] is False
    assert second.status_code == 200
    assert second.json()["duplicate"] is True
    text = (tmp_path / "runs" / run_id / "events.jsonl").read_text(encoding="utf-8")
    assert text.strip().count("\n") == 0
    assert text.count("evt_same") == 1


def test_out_of_order_sequences_accepted(tmp_path: Path) -> None:
    client = TestClient(create_app(store=JsonlEventStore(tmp_path)))
    run_id = new_run_id()
    later = _payload(run_id, 5, type_=EventType.TOOL_COMPLETED)
    earlier = _payload(run_id, 2, type_=EventType.TOOL_STARTED)
    assert client.post("/v1/events", json=later).status_code == 200
    assert client.post("/v1/events", json=earlier).status_code == 200
    store = JsonlEventStore(tmp_path)
    seqs = [e.sequence for e in store.read(run_id)]
    assert seqs == [5, 2]
