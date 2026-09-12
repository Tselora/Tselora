from pathlib import Path

from fastapi.testclient import TestClient

from core.events.schema import AgentEvent
from core.events.types import EventType
from sdk.emitter import EventEmitter
from sdk.transport import CollectorTransport
from server.collector.app import create_app
from server.storage.jsonl import JsonlEventStore


def test_transport_reaches_collector(tmp_path: Path) -> None:
    app = create_app(store=JsonlEventStore(tmp_path))
    with TestClient(app) as client:
        transport = CollectorTransport(
            base_url="http://testserver",
            client=client,
        )
        emitter = EventEmitter(transport)
        from core.context import ExecutionContext, reset_context, set_context
        from core.events.sequence import SequenceCounter

        ctx = ExecutionContext(run_id="run_http", sequence=SequenceCounter())
        token = set_context(ctx)
        try:
            event = emitter.emit(EventType.RUN_STARTED, status="started", ctx=ctx)
        finally:
            reset_context(token)

        stored = JsonlEventStore(tmp_path).read("run_http")
        assert len(stored) == 1
        assert stored[0].event_id == event.event_id
        AgentEvent.model_validate(stored[0].model_dump())
