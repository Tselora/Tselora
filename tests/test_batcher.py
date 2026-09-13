from __future__ import annotations

import threading
import time
from pathlib import Path

import pytest
from fastapi.responses import JSONResponse
from fastapi.testclient import TestClient

from core.context import ExecutionContext, reset_context, set_context
from core.events.schema import AgentEvent
from core.events.sequence import SequenceCounter
from core.events.types import EventType
from sdk.batcher import EventBatcher
from sdk.decorators import configure_emitter
from sdk.emitter import EventEmitter
from sdk.transport import CollectorTransport
from sdk import run, tool
from server.collector.app import create_app
from server.storage.jsonl import JsonlEventStore


class FlakyTransport:
    def __init__(self, fail_times: int = 2) -> None:
        self.fail_times = fail_times
        self.attempts = 0
        self.events: list[AgentEvent] = []
        self.lock = threading.Lock()

    def send(self, event: AgentEvent) -> None:
        with self.lock:
            self.attempts += 1
            if self.attempts <= self.fail_times:
                raise ConnectionError("collector down")
            self.events.append(event)


class GateTransport:
    def __init__(self) -> None:
        self.hold = threading.Event()
        self.started = threading.Event()
        self.events: list[AgentEvent] = []

    def send(self, event: AgentEvent) -> None:
        self.started.set()
        self.hold.wait(timeout=5)
        self.events.append(event)


def _bind_run() -> tuple[ExecutionContext, object]:
    ctx = ExecutionContext(run_id="run_batch", sequence=SequenceCounter())
    token = set_context(ctx)
    return ctx, token


def test_retry_reuses_event_id_and_sequence() -> None:
    flaky = FlakyTransport(fail_times=2)
    batcher = EventBatcher(flaky, retry_backoff_s=0.01, max_retry_backoff_s=0.05)
    emitter = EventEmitter(batcher)
    ctx, token = _bind_run()
    try:
        event = emitter.emit(EventType.RUN_STARTED, status="started", ctx=ctx)
        emitter.flush(timeout=5)
    finally:
        reset_context(token)
        emitter.close()

    assert flaky.attempts == 3
    assert len(flaky.events) == 1
    assert flaky.events[0].event_id == event.event_id
    assert flaky.events[0].sequence == event.sequence


def test_flush_on_run_end() -> None:
    flaky = FlakyTransport(fail_times=1)
    batcher = EventBatcher(flaky, retry_backoff_s=0.01, max_retry_backoff_s=0.05)
    from sdk.decorators import configure_emitter

    configure_emitter(EventEmitter(batcher))

    @tool(name="ping")
    def ping() -> str:
        return "ok"

    try:
        with run(run_id="run_flush"):
            ping()
    finally:
        configure_emitter(None)

    types = [e.type for e in flaky.events]
    assert types == [
        EventType.RUN_STARTED,
        EventType.TOOL_STARTED,
        EventType.TOOL_COMPLETED,
        EventType.RUN_COMPLETED,
    ]
    ids = [e.event_id for e in flaky.events]
    assert len(ids) == len(set(ids))


def test_backpressure_blocks_when_queue_full() -> None:
    gate = GateTransport()
    batcher = EventBatcher(gate, maxsize=1, retry_backoff_s=0.01)
    emitter = EventEmitter(batcher)
    ctx, token = _bind_run()
    blocked = threading.Event()
    proceeded = threading.Event()

    def _third() -> None:
        blocked.set()
        emitter.emit(EventType.TOOL_COMPLETED, status="completed", ctx=ctx)
        proceeded.set()

    try:
        emitter.emit(EventType.RUN_STARTED, status="started", ctx=ctx)
        assert gate.started.wait(timeout=2)
        emitter.emit(EventType.TOOL_STARTED, status="started", ctx=ctx)
        worker = threading.Thread(target=_third, daemon=True)
        worker.start()
        assert blocked.wait(timeout=2)
        time.sleep(0.1)
        assert not proceeded.is_set()
        gate.hold.set()
        assert proceeded.wait(timeout=2)
        emitter.flush(timeout=5)
    finally:
        gate.hold.set()
        reset_context(token)
        emitter.close()

    assert len(gate.events) == 3


def test_http_outage_then_recovery_persists_one_jsonl_record(tmp_path: Path) -> None:
    store = JsonlEventStore(tmp_path)
    app = create_app(store=store)
    posts = {"n": 0}

    @app.middleware("http")
    async def fail_first_ingest(request, call_next):  # type: ignore[no-untyped-def]
        if request.url.path == "/v1/events" and request.method == "POST":
            posts["n"] += 1
            if posts["n"] == 1:
                return JSONResponse({"detail": "unavailable"}, status_code=503)
        return await call_next(request)

    ctx = ExecutionContext(run_id="run_http_retry", sequence=SequenceCounter())
    token = set_context(ctx)
    with TestClient(app) as client:
        batcher = EventBatcher(
            CollectorTransport(base_url="http://testserver", client=client),
            retry_backoff_s=0.01,
            max_retry_backoff_s=0.05,
        )
        emitter = EventEmitter(batcher)
        try:
            event = emitter.emit(EventType.RUN_STARTED, status="started", ctx=ctx)
            emitter.flush(timeout=5)
        finally:
            reset_context(token)
            emitter.close()

    assert posts["n"] == 2
    stored = store.read("run_http_retry")
    assert len(stored) == 1
    assert stored[0].event_id == event.event_id
    assert stored[0].sequence == event.sequence
    assert ctx.sequence.current == 1
    raw = (tmp_path / "runs" / "run_http_retry" / "events.jsonl").read_text(encoding="utf-8")
    assert raw.count("\n") == 1
    assert raw.count(event.event_id) == 1


def test_run_flushes_on_exception_path() -> None:
    flaky = FlakyTransport(fail_times=2)
    configure_emitter(
        EventEmitter(EventBatcher(flaky, retry_backoff_s=0.01, max_retry_backoff_s=0.05))
    )
    try:
        with pytest.raises(ValueError, match="explode"):
            with run(run_id="run_exc_flush"):
                raise ValueError("explode")
    finally:
        configure_emitter(None)

    types = [e.type for e in flaky.events]
    assert EventType.RUN_STARTED in types
    assert EventType.RUN_FAILED in types
    assert types[-1] == EventType.RUN_FAILED
    assert len(flaky.events) == 2
    assert flaky.attempts > 2
