# Universal Agent Event Protocol

## Purpose

The protocol is the **core contract** between instrumentation/adapters and Tselora. Everything downstream (store, projection, API, UI) consumes this shape—not framework-native objects.

## Responsibilities

- Define required envelope fields
- Enumerate v1 event types
- Specify optional structured fields (`actor`, `node`, `payload`, `metadata`, …)
- Version the schema (`schema_version`)

The protocol does **not** define TCP framing, HTTP paths, or UI widgets.

## Required fields (every event)

| Field | Role |
| --- | --- |
| `schema_version` | Protocol version, e.g. `"0.1"` |
| `event_id` | Globally unique id (SDK-assigned) |
| `run_id` | Run this event belongs to |
| `sequence` | **Required** for emitted events; producer-assigned, monotonic per `run_id` |
| `timestamp` | UTC instant of emission (ISO-8601) |
| `type` | Event type string |

## Optional / structured fields

| Field | Role |
| --- | --- |
| `parent_event_id` | Causal parent; primary graph edge |
| `actor` | Who acted (`type`, `id`, …) |
| `node` | Logical node (`id`, `type`, …) |
| `execution_instance_id` | This invocation (e.g. `researcher#2`) |
| `status` | Lifecycle status when applicable |
| `payload` | Type-specific structured data |
| `metadata` | Extensions; framework name, model id, etc. **No framework objects.** |

## Initial event types

**Run:** `run.started`, `run.completed`, `run.failed`, `run.cancelled`, `run.paused`, `run.resumed`, `run.forked`

**Agent:** `agent.started`, `agent.completed`, `agent.failed`

**Node:** `node.started`, `node.completed`, `node.failed`

**LLM:** `llm.started`, `llm.completed`, `llm.failed`

**Tool:** `tool.started`, `tool.completed`, `tool.failed`

**Plan:** `plan.created`, `plan.changed`, `plan.invalidated`

**Verification:** `verification.started`, `verification.completed`, `verification.failed`

**Control / structure:** `retry.started`, `loop.detected`, `checkpoint.created`, `approval.requested`, `approval.completed`

`checkpoint.created` is defined **now** so later resume/fork has a hook. v1 does **not** serialize arbitrary Python processes.

## Example

```json
{
  "schema_version": "0.1",
  "event_id": "evt_9382",
  "run_id": "run_1842",
  "sequence": 27,
  "timestamp": "2026-09-11T14:42:10Z",
  "type": "verification.failed",
  "parent_event_id": "evt_122",
  "actor": {
    "type": "agent",
    "id": "critic"
  },
  "node": {
    "id": "critic",
    "type": "verification"
  },
  "execution_instance_id": "critic#2",
  "status": "failed",
  "payload": {
    "score": 63,
    "threshold": 85,
    "failure_category": "insufficient_source_coverage",
    "action": "replan"
  },
  "metadata": {
    "framework": "custom-python",
    "model": "provider/model-name"
  }
}
```

## Inputs and outputs

**Inputs:** facts from adapters/SDK (lifecycle, scores, tool names—not hidden reasoning).

**Outputs:** JSON objects matching this schema, stored as one JSON object per JSONL line.

## Invariants

- `event_id` unique globally (practically: unique enough that collisions are treated as duplicates).
- `sequence` is **required** on SDK-emitted events and strictly increases per `run_id` at the **emitter** (gaps possible if events never arrive). There is no historical/import exception in the current architecture.
- `type` is from the catalog or a documented extension process.
- `payload` is JSON-serializable and framework-agnostic.
- Private chain-of-thought is out of protocol scope.

## Failure cases

- Unknown `type`: persist if envelope is valid; projection may treat as opaque timeline item (policy to be implemented; must not crash the engine).
- Missing required field: reject at SDK validation / collector; do not persist invalid envelopes.
- Schema mismatch: gated by `schema_version`.

## Future extension points

- Additive optional fields
- Namespaced extension types (`ext.<vendor>....`) if needed
- Stricter payload schemas per type (Pydantic models in `core/events/`)
- Remain **extensible enough** to correlate future inference-system telemetry without redesigning execution semantics (`run_id`, `event_id`, `sequence`, `parent_event_id`, `node.id`, `execution_instance_id`). Do not invent inference-specific event types in this document. Core stays inference-system-neutral.

See [ADR-001](../adr/ADR-001-event-protocol.md).
