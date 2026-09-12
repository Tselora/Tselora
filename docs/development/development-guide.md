# Development guide

Architecture-first implementation plan and **locked development rules**. Do not start this sequence until a later task explicitly begins Week 1. This repository’s initial commit is documentation and scaffolding only.

## Stack

- Python 3.12+
- Pydantic, FastAPI, WebSockets
- React, TypeScript, React Flow
- Typer (preferred CLI; Click is acceptable if already chosen)
- Modern typing; small modules; explicit interfaces; no premature abstraction
- Dependencies only when they satisfy a clear v1 requirement

## Ten rules

**Rule 1:** Never modify the Universal Event Protocol casually.

**Rule 2:** Never make the UI the source of truth.

**Rule 3:** Never derive causal relationships solely from arrival order.

**Rule 4:** Never introduce a database just because it is convenient.

**Rule 5:** Never put framework-specific objects into core.

**Rule 6:** Never expose private chain-of-thought.

**Rule 7:** Never claim generic replay/re-execution unless the application explicitly supports checkpoints/resume.

**Rule 8:** Event log is authoritative.

**Rule 9:** ProjectionEngine is canonical.

**Rule 10:** Prefer simple local-first architecture for v1.

Architectural changes require an ADR. See [CONTRIBUTING.md](../../CONTRIBUTING.md).

---

## WEEK 1 — Protocol + context + JSONL collector

Implement:

- `core/events/schema.py`
- `core/events/types.py`
- `core/events/ids.py`
- `core/events/sequence.py`
- `core/context.py`
- `core/redaction.py`
- `server/storage/jsonl.py`
- `server/collector/app.py`

Tests:

- Event schema validation
- Duplicate event idempotency
- Out-of-order events
- Sequence handling
- Context nesting
- Redaction
- Restart and read-back

---

## WEEK 2 — SDK + asynchronous transport

Implement:

- `sdk/emitter.py`
- `sdk/batcher.py`
- `sdk/transport.py`
- `sdk/decorators.py`
- `sdk/context.py`
- `cli/run.py`

Tests:

- Decorated sync lifecycle
- Exception/failure lifecycle
- Nested contexts
- Async parallel instances
- Thread/executor context propagation
- Backpressure
- Collector outage
- Retries without duplicate events (stable `event_id`)

---

## WEEK 3 — Projection + WebSocket + UI

Implement:

- `core/projection/engine.py`
- `core/projection/models.py`
- `core/projection/graph.py`
- `core/projection/timeline.py`
- `core/projection/patches.py`
- `server/api/runs.py`
- `server/ws.py`

UI:

- Graph
- Timeline
- Inspector
- Basic replay

Acceptance test:

Create a sample agent containing:

- sequential nodes
- fan-out
- retry
- loop

Tselora must show:

- live graph
- timeline
- node states
- repeated execution
- parallel branches
- retry
- loop iterations

Refreshing/reconnecting must restore state from JSONL.

Replaying the event stream through ProjectionEngine must produce the same resulting state.

---

## After Week 3

Adapters beyond raw Python, control plane, and cross-run features are **out of this three-week sequence**. Follow [roadmap.md](../product/roadmap.md).
