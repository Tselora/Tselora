from pathlib import Path

from fastapi.testclient import TestClient

from core.events.ids import new_event_id, new_run_id
from core.events.schema import AgentEvent
from core.events.types import EventType
from core.redaction import KeyRedactor
from server.collector.app import create_app
from server.storage.jsonl import JsonlEventStore


def test_redactor_strips_payload_before_jsonl(tmp_path: Path) -> None:
    store = JsonlEventStore(tmp_path)
    app = create_app(store=store, redactor=KeyRedactor({"secret"}))
    client = TestClient(app)
    run_id = new_run_id()
    event = AgentEvent(
        event_id=new_event_id(),
        run_id=run_id,
        sequence=1,
        timestamp=AgentEvent.utcnow(),
        type=EventType.TOOL_STARTED,
        payload={"secret": "do-not-store", "ok": "visible"},
    )
    response = client.post("/v1/events", json=event.model_dump(mode="json"))
    assert response.status_code == 200
    stored = store.read(run_id)
    assert len(stored) == 1
    assert stored[0].payload == {"ok": "visible"}
    raw = (tmp_path / "runs" / run_id / "events.jsonl").read_text(encoding="utf-8")
    assert "do-not-store" not in raw
