# Testing strategy

Tests protect **invariants**, not framework trivia. Prefer focused unit tests around protocol, store, context, and ProjectionEngine. Add one acceptance path (Week 3 sample agent) rather than many UI snapshots.

## Invariants

1. **Event IDs are unique.** Collisions are treated as duplicates, not as two facts.
2. **Duplicate events do not create duplicate state.** Idempotent persist and `apply`.
3. **Event arrival order is not assumed to be causal order.** Shuffle tests.
4. **`parent_event_id` defines causal relationships.** No edges from timestamps or adjacency.
5. **Logical node IDs remain stable across iterations.** Loops reuse `node.id`.
6. **Execution instances distinguish repeated/concurrent invocations.**
7. **ProjectionEngine is deterministic.** Same log → same state.
8. **Rebuilding state from the event log produces the same result as applying events incrementally** (in sequence order, after dedup).
9. **The event log remains the source of truth.** Snapshots, if any, can be dropped.
10. **UI state can always be reconstructed from the event log.** REST bootstrap after WS drop.

## Suggested test modules (when implemented)

| Area | Examples |
| --- | --- |
| `tests/events/` | schema, types, ids |
| `tests/storage/` | jsonl append, dupes, restart |
| `tests/context/` | nesting, exception unwind, copy into thread |
| `tests/projection/` | graph edges, loops, fan-out, rebuild ≡ apply |
| `tests/sdk/` | batch retry, backpressure |
| `tests/acceptance/` | Week 3 sample agent |

## What not to test yet

- Cloud, auth, Kafka
- Screenshot-only UI tests without projection invariants
- Fake adapters that import framework objects into `core`

## Redaction

Assert secrets in a payload never reach JSONL when marked/redacted. Do not require an ML secret scanner in v1.
