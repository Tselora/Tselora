"""Local collector: validate, redact, dedupe, persist. No projection."""

from __future__ import annotations

import os
from pathlib import Path

from fastapi import FastAPI
from pydantic import BaseModel

from core.events.schema import AgentEvent
from core.redaction import IdentityRedactor, Redactor
from server.api.runs import router as runs_router
from server.storage.jsonl import JsonlEventStore

DEFAULT_DATA_DIR = ".agent-devtools"


class IngestResponse(BaseModel):
    accepted: bool
    duplicate: bool
    event_id: str
    run_id: str


def create_app(
    store: JsonlEventStore | None = None,
    redactor: Redactor | None = None,
) -> FastAPI:
    """Build the collector app. Data dir: ``TSELOA_DATA_DIR`` or ``.agent-devtools``."""
    data_dir = Path(os.environ.get("TSELOA_DATA_DIR", DEFAULT_DATA_DIR))
    event_store = store or JsonlEventStore(data_dir)
    event_redactor: Redactor = redactor or IdentityRedactor()

    app = FastAPI(title="Tselora collector", version="0.1.0")
    app.state.store = event_store
    app.state.redactor = event_redactor
    app.include_router(runs_router)

    @app.get("/health")
    def health() -> dict[str, bool]:
        return {"ok": True}

    @app.post("/v1/events", response_model=IngestResponse)
    def ingest_event(event: AgentEvent) -> IngestResponse:
        redacted = event_redactor.redact(event)
        duplicate = not event_store.append(redacted)
        return IngestResponse(
            accepted=True,
            duplicate=duplicate,
            event_id=redacted.event_id,
            run_id=redacted.run_id,
        )

    return app


app = create_app()
