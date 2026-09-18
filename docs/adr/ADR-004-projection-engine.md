# ADR-004: Canonical ProjectionEngine and Immutable Event Log

- **Status:** Accepted
- **Date:** 2026-09-11

## Context

If REST, WebSocket, replay, and React each interpret events, graphs will diverge (especially around retries and out-of-order delivery). Snapshots and UI caches will quietly become competing truths.

## Decision

The **immutable event log** is the sole source of truth.

A single **ProjectionEngine** implements `apply(event)` and `rebuild(events)` and derives `RunState`, `NodeState`, `GraphState`, and `TimelineState`.

The same logic supports live execution, REST, WebSocket, and replay/time travel. Live **when** to call `apply` (contiguous buffer, 2.0s skip-hole) is [ADR-007](ADR-007-live-sequence-gap.md). The engine itself is unchanged.

Snapshots may exist later as **optimization only**. They are not authoritative.

The React app **must not** reconstruct execution semantics independently.

## Consequences

**Positive**

- One place to test invariants (determinism, idempotency, rebuild ≡ apply)
- Reconnect is “read log, project”
- Replay is free (fold prefix of the log)

**Negative**

- Engine becomes a critical module; keep it cohesive
- UI teams cannot “just parse events in the browser” for convenience
- Snapshot bugs must always be fixable by deleting snapshots and rebuilding

## Alternatives considered

1. **Client-side event interpretation** — Faster prototypes, split-brain semantics. Rejected.
2. **Mutable state store as truth (DB rows updated in place)** — Destroys replay unless a log is kept anyway. Rejected for v1 source of truth.
3. **Multiple specialized projectors without a canonical fold** — Drift. Rejected; specialized *views* may exist but must be derived from the same engine outputs.
