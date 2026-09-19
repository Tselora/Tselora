# Development guide

Architecture-first implementation plan and **locked development rules**.

Week 1 (protocol, JSONL collector), Week 2 (SDK instrumentation, batching, context propagation), and the first Week 3 vertical slice (ProjectionEngine, REST, live `StatePatch` WebSocket, one-run UI) have landed. Remaining Week 3 items are inspector, Why? display, visualization replay, and the sample-agent acceptance path. Live sequence-gap policy is locked in [ADR-007](../adr/ADR-007-live-sequence-gap.md) (contiguous wait, 2.0s skip-hole; REST rebuild unchanged). Adapters beyond raw Python, runtime control, and inference correlation are **after** that sequence.

When documentation conflicts: (1) locked ADRs in `docs/adr/` win for implementation, (2) `docs/product/v1.md` wins for v1 scope, (3) the long-form Architecture & Execution Plan must be synchronized rather than left contradictory.

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

Live projection (when implemented) must follow [ADR-007](../adr/ADR-007-live-sequence-gap.md): persist JSONL immediately; buffer live `apply` until contiguous `sequence`; 2.0s skip-hole; no gap fields; REST stays `rebuild` only.

UI (landed: one-run live graph, node list, timeline; not yet: inspector, basic replay):

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

The first public milestone is the Week 3 local vertical slice (instrument → JSONL → project → inspect → visualization replay). **Do not** treat a later control-channel week as part of that milestone.

OpenTelemetry is an **inbound adapter after** the raw-Python slice, not an MVP dependency and not the core protocol. Missing `parent_event_id` is better than a fabricated causal edge. Unstable `gen_ai.*` conventions are not required core fields.

Adapters beyond raw Python, runtime control, real fork/re-execution, experience graph, hosted mode, and inference-server integration are **out of this three-week sequence**. Follow [roadmap.md](../product/roadmap.md) and [v1.md](../product/v1.md).
