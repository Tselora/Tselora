from __future__ import annotations

from pathlib import Path

from fastapi.testclient import TestClient

from core.events.schema import AgentEvent
from core.events.types import EventType
from core.projection.engine import ProjectionEngine
from core.projection.live import LiveProjectionSession
from server.collector.app import create_app
from server.storage.jsonl import JsonlEventStore
from tests.test_projection import _evt


def _client(tmp_path: Path, live: LiveProjectionSession | None = None) -> TestClient:
    store = JsonlEventStore(tmp_path)
    return TestClient(create_app(store=store, live=live or LiveProjectionSession()))


def _post(client: TestClient, event: AgentEvent):
    return client.post("/v1/events", json=event.model_dump(mode="json"))


def test_post_persists_and_live_matches_rebuild(tmp_path: Path) -> None:
    live = LiveProjectionSession()
    client = _client(tmp_path, live)
    event = _evt(event_id="e1", run_id="r1", sequence=1, type=EventType.RUN_STARTED)
    response = _post(client, event)
    assert response.status_code == 200
    assert response.json()["duplicate"] is False
    store = JsonlEventStore(tmp_path)
    assert [e.event_id for e in store.read("r1")] == ["e1"]
    rebuilt = ProjectionEngine(run_id="r1").rebuild(store.read("r1"))
    assert live.snapshot("r1") == rebuilt
    assert live.patches("r1")


def test_out_of_order_seq_3_persisted_and_buffered(tmp_path: Path) -> None:
    live = LiveProjectionSession()
    client = _client(tmp_path, live)
    e1 = _evt(event_id="e1", run_id="r1", sequence=1, type=EventType.RUN_STARTED)
    e3 = _evt(event_id="e3", run_id="r1", sequence=3, type=EventType.RUN_COMPLETED)
    assert _post(client, e1).status_code == 200
    before_patches = len(live.patches("r1"))
    assert _post(client, e3).status_code == 200
    store = JsonlEventStore(tmp_path)
    assert [e.sequence for e in store.read("r1")] == [1, 3]
    assert live.next_seq("r1") == 2
    assert len(live.patches("r1")) == before_patches
    assert all(e.event_id != "e3" for e in live.snapshot("r1").timeline.entries)


def test_hole_fill_applies_2_then_3_and_matches_rebuild(tmp_path: Path) -> None:
    live = LiveProjectionSession()
    client = _client(tmp_path, live)
    events = [
        _evt(event_id="e1", run_id="r1", sequence=1, type=EventType.RUN_STARTED),
        _evt(event_id="e3", run_id="r1", sequence=3, type=EventType.TOOL_COMPLETED),
        _evt(event_id="e2", run_id="r1", sequence=2, type=EventType.TOOL_STARTED),
    ]
    for event in events:
        assert _post(client, event).status_code == 200
    store = JsonlEventStore(tmp_path)
    rebuilt = ProjectionEngine(run_id="r1").rebuild(store.read("r1"))
    assert live.snapshot("r1") == rebuilt
    tips = [
        p.timeline.entries[-1].event_id
        for p in live.patches("r1")
        if p.timeline is not None
    ]
    assert tips == ["e1", "e2", "e3"]


def test_duplicate_post_does_not_reingest(tmp_path: Path) -> None:
    live = LiveProjectionSession()
    client = _client(tmp_path, live)
    event = _evt(event_id="dup", run_id="r1", sequence=1, type=EventType.RUN_STARTED)
    first = _post(client, event)
    n_patches = len(live.patches("r1"))
    second = _post(client, event)
    assert first.json()["duplicate"] is False
    assert second.status_code == 200
    assert second.json()["duplicate"] is True
    text = (tmp_path / "runs" / "r1" / "events.jsonl").read_text(encoding="utf-8")
    assert text.count("dup") == 1
    assert len(live.patches("r1")) == n_patches


class _RecordingLive(LiveProjectionSession):
    def __init__(self) -> None:
        super().__init__()
        self.ingested: list[str] = []

    def ingest(self, event: AgentEvent) -> list:
        self.ingested.append(event.event_id)
        return super().ingest(event)


class _FailingLive(LiveProjectionSession):
    def ingest(self, event: AgentEvent) -> list:
        raise RuntimeError("live failed")


class _FailingStore(JsonlEventStore):
    def append(self, event: AgentEvent) -> bool:
        raise OSError("disk full")


def test_persistence_failure_does_not_notify_live(tmp_path: Path) -> None:
    live = _RecordingLive()
    client = TestClient(
        create_app(store=_FailingStore(tmp_path), live=live),
        raise_server_exceptions=False,
    )
    event = _evt(event_id="e1", run_id="r1", sequence=1, type=EventType.RUN_STARTED)
    response = _post(client, event)
    assert response.status_code == 500
    assert live.ingested == []
    assert not (tmp_path / "runs" / "r1" / "events.jsonl").exists()


def test_live_failure_after_persist_does_not_rollback(tmp_path: Path) -> None:
    client = TestClient(
        create_app(store=JsonlEventStore(tmp_path), live=_FailingLive()),
        raise_server_exceptions=False,
    )
    event = _evt(event_id="e1", run_id="r1", sequence=1, type=EventType.RUN_STARTED)
    response = _post(client, event)
    assert response.status_code == 500
    store = JsonlEventStore(tmp_path)
    assert [e.event_id for e in store.read("r1")] == ["e1"]
