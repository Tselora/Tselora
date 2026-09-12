# ADR-003: Logical Node Identity vs Execution Instance Identity

- **Status:** Accepted
- **Date:** 2026-09-11

## Context

Agents loop, retry, and fan out. If each invocation is a new graph node id, the graph explodes and “the researcher” is no longer a stable concept. If invocations are collapsed without an instance id, retries and parallel branches cannot be inspected.

## Decision

Separate:

- **Logical `node_id`** (`node.id`): conceptual node, stable across iterations.
- **`execution_instance_id`**: one invocation (`researcher#1`, `researcher#2`, …).

Loops reuse logical ids. Fan-out may be **visually** collapsed; the engine **retains** instances. Graph **edges** come primarily from `parent_event_id`.

Do not derive causal edges merely from temporal adjacency.

## Consequences

**Positive**

- Inspect loops and retries without losing “which node is this”
- Parallel branches remain first-class internally
- Matches developer mental model of a graph program

**Negative**

- Adapters must allocate instance ids
- Collapse is a view concern; careless UI could hide failures
- Missing instance ids degrade the model (see open-questions)

## Alternatives considered

1. **Only instance ids in the graph** — Accurate but unreadable for loops. Rejected as the *only* identity.
2. **Only logical ids** — Cannot distinguish `researcher#1` vs `#2`. Rejected.
3. **Edges from time** — False causality under concurrency. Rejected.
