from __future__ import annotations

import asyncio
import inspect
import threading
import time
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from starlette.websockets import WebSocketDisconnect

from core.events.types import EventType
from core.projection.engine import ProjectionEngine
from core.projection.live import FakeClock, GAP_TIMEOUT_SECONDS, LiveProjectionSession
from core.projection.models import ProjectionState
from core.projection.patches import PATCH_SCHEMA_VERSION, diff
from server.collector.app import create_app
from server.storage.jsonl import JsonlEventStore
from server.ws import PATCH_QUEUE_MAXSIZE, WS_CLOSE_SLOW_CLIENT, PatchHub, _send_patches
from tests.test_projection import _evt


def _client(
    tmp_path: Path,
    live: LiveProjectionSession | None = None,
    *,
    maxsize: int | None = None,
) -> tuple[TestClient, LiveProjectionSession]:
    session = live or LiveProjectionSession()
    app = create_app(store=JsonlEventStore(tmp_path), live=session)
    if maxsize is not None:
        app.state.hub.maxsize = maxsize
    return TestClient(app), session


def test_ws_receives_state_patch_after_persist(tmp_path: Path) -> None:
    client, live = _client(tmp_path)
    event = _evt(event_id="e1", run_id="r1", sequence=1, type=EventType.RUN_STARTED)
    with client.websocket_connect("/v1/runs/r1/ws") as ws:
        response = client.post("/v1/events", json=event.model_dump(mode="json"))
        assert response.status_code == 200
        message = ws.receive_json()
    assert message["schema_version"] == PATCH_SCHEMA_VERSION
    assert message["run_id"] == "r1"
    assert message["from_cursor"] is not None
    assert message.get("type") != EventType.RUN_STARTED
    assert live.patches("r1")[0].model_dump(mode="json") == message


def test_multiple_clients_receive_same_patch(tmp_path: Path) -> None:
    client, _ = _client(tmp_path)
    event = _evt(event_id="e1", run_id="r1", sequence=1, type=EventType.RUN_STARTED)
    with (
        client.websocket_connect("/v1/runs/r1/ws") as first,
        client.websocket_connect("/v1/runs/r1/ws") as second,
    ):
        client.post("/v1/events", json=event.model_dump(mode="json"))
        ma, mb = first.receive_json(), second.receive_json()
    assert ma == mb
    assert ma["schema_version"] == PATCH_SCHEMA_VERSION


def test_ws_run_isolation(tmp_path: Path) -> None:
    client, _ = _client(tmp_path)
    with (
        client.websocket_connect("/v1/runs/ra/ws") as ws_a,
        client.websocket_connect("/v1/runs/rb/ws") as ws_b,
    ):
        client.post(
            "/v1/events",
            json=_evt(
                event_id="a1", run_id="ra", sequence=1, type=EventType.RUN_STARTED
            ).model_dump(mode="json"),
        )
        assert ws_a.receive_json()["run_id"] == "ra"
        client.post(
            "/v1/events",
            json=_evt(
                event_id="b1", run_id="rb", sequence=1, type=EventType.RUN_STARTED
            ).model_dump(mode="json"),
        )
        assert ws_b.receive_json()["run_id"] == "rb"


def test_disconnect_unregisters(tmp_path: Path) -> None:
    client, _ = _client(tmp_path)
    hub: PatchHub = client.app.state.hub
    with client.websocket_connect("/v1/runs/r1/ws"):
        assert hub.subscriber_count("r1") == 1
    assert hub.subscriber_count("r1") == 0
    with client.websocket_connect("/v1/runs/r1/ws") as remaining:
        assert hub.subscriber_count("r1") == 1
        client.post(
            "/v1/events",
            json=_evt(
                event_id="e1", run_id="r1", sequence=1, type=EventType.RUN_STARTED
            ).model_dump(mode="json"),
        )
        assert remaining.receive_json()["run_id"] == "r1"


def _flood(client: TestClient, run_id: str, n: int) -> None:
    for seq in range(1, n + 1):
        kind = EventType.RUN_STARTED if seq == 1 else EventType.TOOL_STARTED
        event = _evt(event_id=f"e{seq}", run_id=run_id, sequence=seq, type=kind)
        response = client.post("/v1/events", json=event.model_dump(mode="json"))
        assert response.status_code == 200


def _sample_patch():
    after = ProjectionEngine(run_id="r1").rebuild(
        [_evt(event_id="e1", run_id="r1", sequence=1, type=EventType.RUN_STARTED)]
    )
    return diff(ProjectionState(), after)


def test_post_and_live_continue_while_ws_open_and_unread(tmp_path: Path) -> None:
    client, live = _client(tmp_path, maxsize=2)
    with client.websocket_connect("/v1/runs/r1/ws"):
        _flood(client, "r1", 6)
    store = JsonlEventStore(tmp_path)
    assert live.snapshot("r1") == ProjectionEngine(run_id="r1").rebuild(store.read("r1"))


def test_patch_queue_maxsize_is_bounded() -> None:
    assert isinstance(PATCH_QUEUE_MAXSIZE, int)
    assert 1 <= PATCH_QUEUE_MAXSIZE <= 256
    hub = PatchHub()
    assert hub.maxsize == PATCH_QUEUE_MAXSIZE


def test_unregister_is_idempotent() -> None:
    async def body() -> None:
        hub = PatchHub(maxsize=2)
        loop = asyncio.get_running_loop()
        sub = hub.register("r1", loop)
        other = hub.register("r1", loop)
        assert hub.subscriber_count("r1") == 2
        hub.unregister("r1", sub)
        hub.unregister("r1", sub)
        assert hub.subscriber_count("r1") == 1
        hub.unregister("r1", other)
        hub.unregister("r1", other)
        assert hub.subscriber_count("r1") == 0
        hub.on_patch("r1", _sample_patch())
        await asyncio.sleep(0)

    asyncio.run(body())


def test_bounded_queue_overflow_does_not_block_on_patch() -> None:
    async def body() -> None:
        hub = PatchHub(maxsize=1)
        loop = asyncio.get_running_loop()
        slow = hub.register("r1", loop)
        patch = _sample_patch()
        hub.on_patch("r1", patch)
        await asyncio.sleep(0)
        started = time.monotonic()
        for _ in range(8):
            hub.on_patch("r1", patch)
        await asyncio.sleep(0)
        assert time.monotonic() - started < 1.0
        assert slow.overflowed is True
        assert hub.subscriber_count("r1") == 0

    asyncio.run(body())


class _FakeWebSocket:
    def __init__(self) -> None:
        self.closed: int | None = None
        self.sent: list[object] = []
        self.block = asyncio.Event()
        self.send_threads: list[int] = []
        self.close_threads: list[int] = []
        self.loop_thread: int | None = None

    async def send_json(self, payload: object) -> None:
        self.send_threads.append(threading.get_ident())
        self.sent.append(payload)
        await self.block.wait()

    async def close(self, code: int = 1000) -> None:
        self.close_threads.append(threading.get_ident())
        self.closed = code
        self.block.set()


def test_overflow_closes_slow_sender_only() -> None:
    async def body() -> None:
        hub = PatchHub(maxsize=1)
        loop = asyncio.get_running_loop()
        slow = hub.register("r1", loop)
        healthy = hub.register("r1", loop)

        async def consume() -> None:
            while True:
                item = await healthy.queue.get()
                drained.append(item)

        drained: list[object] = []
        consumer = asyncio.create_task(consume())
        ws = _FakeWebSocket()
        sender = asyncio.create_task(_send_patches(ws, slow))
        patch = _sample_patch()
        hub.on_patch("r1", patch)
        await asyncio.sleep(0)
        for _ in range(5):
            hub.on_patch("r1", patch)
            await asyncio.sleep(0)
        assert slow.overflowed is True
        assert healthy.overflowed is False
        assert drained
        assert hub.subscriber_count("r1") == 1
        ws.block.set()
        await asyncio.wait_for(sender, timeout=2)
        assert ws.closed == WS_CLOSE_SLOW_CLIENT
        loop_id = threading.get_ident()
        assert ws.send_threads
        assert all(t == loop_id for t in ws.send_threads)
        assert all(t == loop_id for t in ws.close_threads)
        hub.unregister("r1", slow)
        assert hub.subscriber_count("r1") == 1
        consumer.cancel()

    asyncio.run(body())


def test_gap_timeout_while_subscriber_slow(tmp_path: Path) -> None:
    clock = FakeClock()
    live = LiveProjectionSession(clock=clock)
    client, _ = _client(tmp_path, live, maxsize=2)
    with client.websocket_connect("/v1/runs/r1/ws"):
        client.post(
            "/v1/events",
            json=_evt(
                event_id="e1", run_id="r1", sequence=1, type=EventType.RUN_STARTED
            ).model_dump(mode="json"),
        )
        client.post(
            "/v1/events",
            json=_evt(
                event_id="e3", run_id="r1", sequence=3, type=EventType.RUN_COMPLETED
            ).model_dump(mode="json"),
        )
        clock.advance(GAP_TIMEOUT_SECONDS)
        store = JsonlEventStore(tmp_path)
        assert live.snapshot("r1") == ProjectionEngine(run_id="r1").rebuild(
            store.read("r1")
        )
        assert [e.event_id for e in live.snapshot("r1").timeline.entries] == ["e1", "e3"]


def test_on_patch_from_non_event_loop_thread(tmp_path: Path) -> None:
    live = LiveProjectionSession()
    client, _ = _client(tmp_path, live)
    event = _evt(event_id="e1", run_id="r1", sequence=1, type=EventType.RUN_STARTED)
    JsonlEventStore(tmp_path).append(event)
    with client.websocket_connect("/v1/runs/r1/ws") as ws:
        worker = threading.Thread(target=live.ingest, args=(event,))
        worker.start()
        worker.join(timeout=2)
        assert not worker.is_alive()
        message = ws.receive_json()
    assert message["schema_version"] == PATCH_SCHEMA_VERSION
    assert message["run_id"] == "r1"


def test_ws_module_uses_asyncio_queue_not_to_thread() -> None:
    import server.ws as ws_mod

    source = inspect.getsource(ws_mod)
    assert "to_thread" not in source
    assert "SimpleQueue" not in source
    assert "asyncio.Queue" in source
    assert "call_soon_threadsafe" in source
    assert PATCH_QUEUE_MAXSIZE >= 1


def test_unsafe_run_id_rejected(tmp_path: Path) -> None:
    client, _ = _client(tmp_path)
    with pytest.raises(WebSocketDisconnect) as exc:
        with client.websocket_connect("/v1/runs/run@bad/ws"):
            pass
    assert exc.value.code == 1008


def test_health_and_rest_still_work(tmp_path: Path) -> None:
    client, _ = _client(tmp_path)
    assert client.get("/health").json() == {"ok": True}
    event = _evt(event_id="e1", run_id="r1", sequence=1, type=EventType.RUN_STARTED)
    assert client.post("/v1/events", json=event.model_dump(mode="json")).status_code == 200
    assert client.get("/v1/runs/r1").status_code == 200
