# Persistence

## Purpose

Durably record the event log that is the **source of truth** for a run.

## v1 decision

**v1 does not require a database.**

Use append-only **JSONL** files. JSONL is authoritative. Future SQL is an `EventStore` implementation detail and must not change the event protocol or projection architecture.

See [ADR-006](../adr/ADR-006-file-based-persistence.md).

## Layout

```text
.agent-devtools/
    runs/
        run_<id>/
            events.jsonl
            metadata.json
            snapshot.json   # optional optimization later
```

- `events.jsonl`: one protocol event per line, append-only.
- `metadata.json`: run-level non-authoritative helpers (display name, start time cache). If it disagrees with the log, **the log wins**.
- `snapshot.json`: optional; never source of truth.

Directory `.agent-devtools/` is local runtime data. It is gitignored.

## EventStore abstraction

Conceptual interface (to be implemented in Week 1):

- `append(event) -> None` (idempotent on `event_id`)
- `read(run_id) -> Iterable[event]`
- `has_event(run_id, event_id) -> bool` (or equivalent index)

JSONL is the first backend. SQLite/Postgres may appear **later** behind the same interface.

## Responsibilities

- Durable append
- Dedup by `event_id` at persist time
- Read-back after process restart
- Isolation per `run_id`

Not responsible for: graph semantics, multi-region replication, Kafka-like fan-out.

## Inputs / outputs

**In:** validated, redacted events.  
**Out:** bytes on disk; iterators of events for rebuild.

## Invariants

- Append-only for `events.jsonl` (no silent rewrite of history)
- Redaction already applied
- Restart + read-back yields the same events
- No SQLite, PostgreSQL, Redis, Kafka, or RabbitMQ in v1

## Failure cases

- Disk full: fail the append; SDK retries; duplicates possible later
- Partial line crash: reader skips/quarantines corrupt line; do not treat as success
- Path traversal in `run_id`: reject unsafe ids
- Concurrent writers: v1 assumes one local collector process per data dir

## Future extension points

- Compaction / snapshot + sealed segments
- SQL EventStore
- Export/import of a run directory
