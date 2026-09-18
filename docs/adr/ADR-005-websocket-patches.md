# ADR-005: REST Bootstrap + WebSocket State Patches

- **Status:** Accepted
- **Date:** 2026-09-11

## Context

Live runs can emit many events. Sending the entire log or entire state on every tick wastes bandwidth and invites the UI to become an event processor. Pure REST polling is simple but laggy. Pure WebSocket without a snapshot protocol makes reconnect painful.

## Decision

**REST** is used for:

- initial run loading
- full state
- reconnect/recovery
- historical data

**WebSocket** is used for **live updates** as **state patches** produced **after** ProjectionEngine applies an event (or a batch):

```text
Event → ProjectionEngine → state change → StatePatch → WebSocket → React UI
```

The UI applies patches to REST-bootstrapped state. It does not independently reconstruct execution semantics. After disconnect, REST reload (or rebuild) restores truth from the log.

REST **rebuilds from JSONL** and does **not** use the live sequence buffer or skip-hole timer ([ADR-007](ADR-007-live-sequence-gap.md)). WebSocket patches are emitted only after live `apply` of an event or drained batch; buffered events produce no patch until drained. Cursor mismatch → REST resync.

## Consequences

**Positive**

- UI stays a renderer
- Reconnect is well-defined
- Patch protocol can evolve without changing JSONL

**Negative**

- Need a versioned patch schema
- Patch bugs require REST resync
- Must not stream raw logs as the live API of record

## Alternatives considered

1. **WebSocket sends every event** — UI becomes a second ProjectionEngine. Rejected.
2. **WebSocket sends full state every time** — Simple, expensive, still OK for tiny runs; rejected as the architecture for v1 going forward.
3. **REST polling only** — Acceptable fallback, poor live UX. Rejected as the primary live path.
