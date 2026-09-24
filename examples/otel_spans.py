"""OTEL tracer → Tselora SpanProcessor → collector JSONL.

Requires: pip install -e ".[otel]"

Terminal 1:
    tselora serve

Terminal 2:
    TSELOA_COLLECTOR_URL=http://127.0.0.1:8000 python examples/otel_spans.py
"""

from __future__ import annotations

import os

from opentelemetry import trace
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.trace import Status, StatusCode

from adapters.otel.processor import TseloraSpanProcessor
from sdk.batcher import EventBatcher
from sdk.emitter import EventEmitter
from sdk.transport import DEFAULT_COLLECTOR_URL, CollectorTransport


def main() -> None:
    base = os.environ.get("TSELOA_COLLECTOR_URL", DEFAULT_COLLECTOR_URL)
    emitter = EventEmitter(EventBatcher(CollectorTransport(base_url=base)))
    processor = TseloraSpanProcessor(emitter)
    provider = TracerProvider(resource=Resource.create({"service.name": "otel-example"}))
    provider.add_span_processor(processor)
    tracer = trace.get_tracer("tselora.example", tracer_provider=provider)
    with tracer.start_as_current_span("research") as root:
        print(f"run_id=run_{format(root.get_span_context().trace_id, '032x')}")
        with tracer.start_as_current_span("search_web"):
            pass
        with tracer.start_as_current_span("search_web") as failed:
            failed.set_status(Status(StatusCode.ERROR))
    emitter.flush()
    emitter.close()


if __name__ == "__main__":
    main()
