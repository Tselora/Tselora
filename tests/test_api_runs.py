from __future__ import annotations

from pathlib import Path

from fastapi.testclient import TestClient

from core.events.ids import new_event_id, new_run_id
from core.events.schema import AgentEvent
from core.events.types import EventType
from core.projection.engine import ProjectionEngine
from sdk import agent, node, run, tool
from server.collector.app import create_app
from server.storage.jsonl import JsonlEventStore
from tests.conftest import RecordingTransport


def _client(tmp_path: Path) -> tuple[TestClient, JsonlEventStore]:
    store = JsonlEventStore(tmp_path)
    return TestClient(create_app(store=store)), store


def _persist(store: JsonlEventStore, events: list[AgentEvent]) -> None:
    for event in events:
        store.append(event)


def test_get_run_equals_projection_rebuild(
    tmp_path: Path, recording_transport: RecordingTransport
) -> None:
    @tool(name="fetch")
    def fetch() -> str:
        return "ok"

    @node(name="search")
    def search() -> str:
        return fetch()

    @agent(name="research")
    def research() -> str:
        return search()

    run_id = "run_rest_nest"
    with run(run_id=run_id):
        research()

    client, store = _client(tmp_path)
    _persist(store, recording_transport.events)

    response = client.get(f"/v1/runs/{run_id}")
    assert response.status_code == 200
    expected = ProjectionEngine(run_id=run_id).rebuild(store.read(run_id))
    assert response.json() == expected.model_dump(mode="json")


def test_get_graph_is_execution_topology(
    tmp_path: Path, recording_transport: RecordingTransport
) -> None:
    @tool(name="fetch")
    def fetch() -> str:
        return "ok"

    @node(name="search")
    def search() -> str:
        return fetch()

    @agent(name="research")
    def research() -> str:
        return search()

    run_id = "run_rest_graph"
    with run(run_id=run_id):
        research()

    client, store = _client(tmp_path)
    _persist(store, recording_transport.events)

    response = client.get(f"/v1/runs/{run_id}/graph")
    assert response.status_code == 200
    body = response.json()
    expected = ProjectionEngine(run_id=run_id).rebuild(store.read(run_id)).graph
    assert body == expected.model_dump(mode="json")

    child_ids = {edge["child_event_id"] for edge in body["edges"]}
    by_id = {e.event_id: e for e in store.read(run_id)}
    for child_id in child_ids:
        assert by_id[child_id].type.endswith(".started")
        assert not by_id[child_id].type.endswith(".completed")
        assert not by_id[child_id].type.endswith(".failed")

    completed = [e for e in store.read(run_id) if e.type.endswith(".completed")]
    assert completed
    assert not any(e.event_id in child_ids for e in completed)


def test_get_timeline_sequence_order(
    tmp_path: Path, recording_transport: RecordingTransport
) -> None:
    @tool(name="fetch")
    def fetch() -> str:
        return "ok"

    @agent(name="research")
    def research() -> str:
        return fetch()

    run_id = "run_rest_timeline"
    with run(run_id=run_id):
        research()

    client, store = _client(tmp_path)
    _persist(store, recording_transport.events)

    response = client.get(f"/v1/runs/{run_id}/timeline")
    assert response.status_code == 200
    expected = ProjectionEngine(run_id=run_id).rebuild(store.read(run_id)).timeline
    assert response.json() == expected.model_dump(mode="json")
    sequences = [entry["sequence"] for entry in response.json()["entries"]]
    assert sequences == sorted(sequences)


def test_get_events_round_trips_store(
    tmp_path: Path, recording_transport: RecordingTransport
) -> None:
    @tool(name="fetch")
    def fetch() -> str:
        return "ok"

    run_id = "run_rest_events"
    with run(run_id=run_id):
        fetch()

    client, store = _client(tmp_path)
    _persist(store, recording_transport.events)

    response = client.get(f"/v1/runs/{run_id}/events")
    assert response.status_code == 200
    persisted = [e.model_dump(mode="json") for e in store.read(run_id)]
    assert response.json() == persisted


def test_missing_run_404(tmp_path: Path) -> None:
    client, _ = _client(tmp_path)
    response = client.get("/v1/runs/run_missing")
    assert response.status_code == 404


def test_unsafe_run_id_400(tmp_path: Path) -> None:
    client, _ = _client(tmp_path)
    response = client.get("/v1/runs/run@unsafe")
    assert response.status_code == 400


def test_empty_jsonl_200(tmp_path: Path) -> None:
    run_id = "run_empty"
    path = tmp_path / "runs" / run_id / "events.jsonl"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("", encoding="utf-8")
    client, store = _client(tmp_path)
    response = client.get(f"/v1/runs/{run_id}")
    assert response.status_code == 200
    expected = ProjectionEngine(run_id=run_id).rebuild(store.read(run_id))
    assert response.json() == expected.model_dump(mode="json")
    assert response.json()["graph"]["edges"] == []
    assert response.json()["timeline"]["entries"] == []


def test_malformed_jsonl_not_200(tmp_path: Path) -> None:
    run_id = "run_corrupt"
    path = tmp_path / "runs" / run_id / "events.jsonl"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("{not-json\n", encoding="utf-8")
    client, _ = _client(tmp_path)
    response = client.get(f"/v1/runs/{run_id}")
    assert response.status_code != 200
    assert response.status_code in (422, 500)
    body = response.json()
    assert body.get("graph") is None or "edges" not in body


def test_wrong_run_id_in_file(tmp_path: Path) -> None:
    run_id = "run_bound"
    event = AgentEvent(
        event_id=new_event_id(),
        run_id="run_other",
        sequence=1,
        timestamp=AgentEvent.utcnow(),
        type=EventType.RUN_STARTED,
    )
    path = tmp_path / "runs" / run_id / "events.jsonl"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(event.model_dump_json() + "\n", encoding="utf-8")
    client, _ = _client(tmp_path)
    response = client.get(f"/v1/runs/{run_id}")
    assert response.status_code == 422


def test_duplicate_event_id_idempotent(tmp_path: Path) -> None:
    run_id = new_run_id()
    event = AgentEvent(
        event_id="evt_dup_rest",
        run_id=run_id,
        sequence=1,
        timestamp=AgentEvent.utcnow(),
        type=EventType.RUN_STARTED,
    )
    store = JsonlEventStore(tmp_path)
    assert store.append(event) is True
    assert store.append(event) is False
    client = TestClient(create_app(store=store))
    once = ProjectionEngine(run_id=run_id).rebuild([event]).model_dump(mode="json")
    response = client.get(f"/v1/runs/{run_id}")
    assert response.status_code == 200
    assert response.json() == once


def test_repeated_get_identical(tmp_path: Path) -> None:
    run_id = new_run_id()
    event = AgentEvent(
        event_id=new_event_id(),
        run_id=run_id,
        sequence=1,
        timestamp=AgentEvent.utcnow(),
        type=EventType.RUN_STARTED,
    )
    client, store = _client(tmp_path)
    store.append(event)
    first = client.get(f"/v1/runs/{run_id}")
    second = client.get(f"/v1/runs/{run_id}")
    assert first.status_code == 200
    assert first.json() == second.json()


def test_shuffled_jsonl_projected_deterministically(tmp_path: Path) -> None:
    run_id = "run_shuffle"
    events = [
        AgentEvent(
            event_id="e3",
            run_id=run_id,
            sequence=3,
            timestamp=AgentEvent.utcnow(),
            type=EventType.RUN_COMPLETED,
        ),
        AgentEvent(
            event_id="e1",
            run_id=run_id,
            sequence=1,
            timestamp=AgentEvent.utcnow(),
            type=EventType.RUN_STARTED,
        ),
        AgentEvent(
            event_id="e2",
            run_id=run_id,
            sequence=2,
            timestamp=AgentEvent.utcnow(),
            type=EventType.TOOL_STARTED,
        ),
    ]
    path = tmp_path / "runs" / run_id / "events.jsonl"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("".join(e.model_dump_json() + "\n" for e in events), encoding="utf-8")
    client, store = _client(tmp_path)
    raw = client.get(f"/v1/runs/{run_id}/events")
    assert [e["sequence"] for e in raw.json()] == [3, 1, 2]
    projected = client.get(f"/v1/runs/{run_id}")
    expected = ProjectionEngine(run_id=run_id).rebuild(store.read(run_id))
    assert projected.json() == expected.model_dump(mode="json")
    assert [e["sequence"] for e in projected.json()["timeline"]["entries"]] == [1, 2, 3]


def test_health_and_ingest_still_work(tmp_path: Path) -> None:
    client, _ = _client(tmp_path)
    assert client.get("/health").json() == {"ok": True}
    run_id = new_run_id()
    event = AgentEvent(
        event_id=new_event_id(),
        run_id=run_id,
        sequence=1,
        timestamp=AgentEvent.utcnow(),
        type=EventType.RUN_STARTED,
    )
    response = client.post("/v1/events", json=event.model_dump(mode="json"))
    assert response.status_code == 200
    assert response.json()["duplicate"] is False
