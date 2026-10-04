# Architecture (public)

Tselora observes existing agents. It does not schedule tools or replace your orchestrator.

```text
Agent / framework
        ↓
Protocol events
        ↓
Collector (POST /v1/events)
        ↓
EventStore (SQLite)
        ↓
ProjectionEngine
        ↓
REST / WebSocket patches
        ↓
Explorer (`ui/`, not in the PyPI wheel)
```

**Event log.** The event stream is the source of truth for a run. The default store is local SQLite (`tselora.sqlite`). JSONL remains a compatibility log; `tselora import-jsonl` copies existing files into SQLite and does not rewrite them. The SDK assigns `event_id` and per-run `sequence` at emit time. Delivery is at-least-once; the collector deduplicates by `event_id`. Causal edges come from `parent_event_id`, not arrival order.

**Projection.** `ProjectionEngine` folds events into run, node, graph, and timeline state. Replay of visualization means projecting a prefix of the log, not re-executing Python.

**Experience.** After a run is terminal, the collector may derive an Experience document. The log remains authoritative.

**Comparison / Learn.** Comparison rebuilds two projections. Learn queries Experiences by exact `structure_fingerprint` (Explorer: `/learn?run_id=`). Both are derived read models; neither is a second event log.

Local-first: no database server or message broker is required. The collector uses SQLite in the data directory.
