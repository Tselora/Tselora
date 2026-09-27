# Architecture (public)

Tselora observes existing agents. It does not schedule tools or replace your orchestrator.

```text
Agent / framework
        ↓
Protocol events
        ↓
Collector (POST /v1/events)
        ↓
JSONL EventStore
        ↓
ProjectionEngine
        ↓
REST / WebSocket patches
        ↓
Explorer (`ui/`, not in the PyPI wheel)
```

**Event log.** Append-only JSONL is the source of truth for a run. The SDK assigns `event_id` and per-run `sequence` at emit time. Delivery is at-least-once; the collector deduplicates by `event_id`. Causal edges come from `parent_event_id`, not arrival order.

**Projection.** `ProjectionEngine` folds events into run, node, graph, and timeline state. Replay of visualization means projecting a prefix of the log, not re-executing Python.

**Experience.** After a run is terminal, the collector may derive an Experience document. The log remains authoritative.

**Comparison / Learn.** Comparison rebuilds two projections. Learn queries Experiences by exact `structure_fingerprint` and optional exact filters.

Local-first: no database or message broker is required for this release.
