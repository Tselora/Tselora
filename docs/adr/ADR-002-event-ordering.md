# ADR-002: Event Ordering, Deduplication, and At-Least-Once Delivery

- **Status:** Accepted
- **Date:** 2026-09-11

## Context

The SDK assigns `event_id` (globally unique) and a monotonically increasing `sequence` per run **when the event is emitted**. Transport to the collector is **asynchronous**. Delivery is **at-least-once**.

Therefore duplicates and out-of-order arrival are normal. Collector receive order is **not** causal truth.

## Decision

1. **Deduplicate** on `event_id` in the collector/EventStore and in ProjectionEngine.
2. **Order** events for projection and replay by `sequence` within `run_id`, not by arrival or file-physical guess beyond what append provides.
3. **Causality** uses `parent_event_id`, never temporal adjacency or receive order.
4. SDK retries after collector outage must **reuse** the same `event_id` (and sequence) for the same logical emit so retries do not create new facts.

## Consequences

**Positive**

- Safe retries and batching
- Deterministic rebuild
- Honest graphs under concurrency

**Negative**

- Live UI must not assume contiguous arrival
- Emitters need durable-enough identity for in-flight batches (implementation detail in Week 2)
- Sequence gaps after crash are possible
- Live contiguous wait and skip-hole timeout are specified in [ADR-007](ADR-007-live-sequence-gap.md)

## Alternatives considered

1. **Exactly-once transport (Kafka transactions, etc.)** — Violates v1 local-first and “no brokers”. Rejected.
2. **Order by timestamp** — Clock skew and concurrent nodes make this false causality. Rejected.
3. **Synchronous emit in the agent hot path** — Simpler ordering, worse latency and agent coupling. Rejected as the default; batching remains the plan.
