# ADR-006: File-Based JSONL Persistence for v1

- **Status:** Accepted
- **Date:** 2026-09-11

## Context

v1 is a local developer tool. Introducing PostgreSQL, SQLite, Redis, or a message broker would add ops cost and imply a production data plane Tselora does not yet have (auth, multi-tenancy, backups).

Replay and projection already require an ordered log. A database is not required to have a log.

## Decision

**v1 does not require a database.**

Persist runs as append-only **JSONL** under:

```text
.agent-devtools/runs/run_<id>/events.jsonl
```

JSONL is **authoritative**. Optional `metadata.json` and later `snapshot.json` are not the source of truth.

Introduce an **EventStore** abstraction so JSONL can be replaced by SQLite or Postgres later **without** changing the event protocol or projection architecture.

Do **not** introduce SQLite, PostgreSQL, Redis, Kafka, RabbitMQ, or another database/message broker in v1.

## Consequences

**Positive**

- Debuggable with `cat` and `jq`
- Trivial backup (copy a run folder)
- Matches “event log is truth”
- Zero extra daemons

**Negative**

- Weak concurrent multi-process writers
- Naive full-file reads for large runs
- No rich ad-hoc query until a later store

These are accepted for v1. Do not “just add a database because it is convenient” (Rule 4).

## Alternatives considered

1. **SQLite in v1** — Reasonable technically, but not required; adds a second truth format risk. Deferred behind EventStore.
2. **PostgreSQL / cloud stores** — Ops and security model Tselora does not have. Rejected for v1.
3. **Kafka / Redis streams** — Brokers for a local shadow. Rejected.
4. **Only in-memory** — Cannot restart or replay. Rejected.
