"""OTEL tracer → Tselora SpanProcessor → collector SQLite.

Requires: pip install "tselora[otel]"

Terminal 1:
    tselora serve

Terminal 2:
    TSELOA_COLLECTOR_URL=http://127.0.0.1:8000 python examples/otel_spans.py

Maps to run.* / node.*. Child span attributes may carry allowlisted Why? keys; error status sets failure_category.
"""

from __future__ import annotations

import os

from opentelemetry import trace
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.trace import Status, StatusCode

from tselora import CollectorTransport, DEFAULT_COLLECTOR_URL, EventBatcher, EventEmitter
from tselora.adapters.otel.processor import TseloraSpanProcessor


def main() -> None:
    base = os.environ.get("TSELOA_COLLECTOR_URL", DEFAULT_COLLECTOR_URL)
    emitter = EventEmitter(EventBatcher(CollectorTransport(base_url=base)))
    processor = TseloraSpanProcessor(emitter)
    provider = TracerProvider(resource=Resource.create({"service.name": "otel-example"}))
    provider.add_span_processor(processor)
    tracer = trace.get_tracer("tselora.example", tracer_provider=provider)
    with tracer.start_as_current_span("research") as root:
        run_id = f"run_{format(root.get_span_context().trace_id, '032x')}"
        print(f"run_id={run_id}")
        with tracer.start_as_current_span("search_web") as ok:
            ok.set_attribute("decision", "continue")
            ok.set_attribute("action", "search")
        with tracer.start_as_current_span("search_web") as failed:
            failed.set_status(Status(StatusCode.ERROR))
            failed.set_attribute("failure_category", "error")
            failed.set_attribute("decision", "stop")
    print(f"explorer: http://127.0.0.1:5173/runs/{run_id}")
    emitter.flush()
    emitter.close()


if __name__ == "__main__":
    main()
