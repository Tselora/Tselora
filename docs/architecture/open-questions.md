# Open questions and concerns

This file records **concerns** about locked decisions. It does **not** change those decisions. Implementation follows the locked architecture until an ADR supersedes it.

## 1. Live apply vs sequence holes

At-least-once + async transport implies events can arrive out of order. Incremental `apply` during a live run may see `sequence` 30 before 29.

**Locked:** arrival order is not causal truth; `sequence` is used for deterministic ordering; rebuild is authoritative.

**Concern:** Week 1–3 must specify a concrete live policy (buffer until contiguous sequence vs apply-and-reorder). Either is compatible if rebuild remains the source of displayed REST state after reconnect. Risk: naive live graphs flicker if they apply strictly in arrival order.

**Do not change:** JSONL as truth; ProjectionEngine as canonical.

## 2. Sequence gaps vs “monotonic at emitter”

If the process crashes after incrementing sequence but before durable send, gaps appear. Projection should tolerate gaps.

**Concern:** UI might look “stuck” waiting for a sequence that will never exist. Need an explicit timeout or “highest contiguous vs highest seen” in implementation (not specified in the lock).

## 3. `execution_instance_id` optional on the wire

The protocol lists it as optional. Graph quality depends on it for loops and fan-out.

**Concern:** If adapters omit it, the engine may need a documented fallback. Prefer SDK-required instance ids for `node.*`, `llm.*`, `tool.*` without changing the conceptual protocol.

## 4. Unknown event types

Locked catalog is finite, but real agents will invent types.

**Concern:** Strict reject vs opaque timeline passthrough. Recommendation for implementers: persist valid envelopes; project unknown types onto the timeline without crashing. Confirm in Week 1 schema validation tests.

## 5. Single collector process vs concurrent append

v1 JSONL assumes a local collector. Two processes writing the same `events.jsonl` can interleave writes.

**Concern:** Document “one collector per data directory” as an operational invariant. Not a reason to add a database in v1.

## 6. OTEL semantic mismatch

Bridging OTEL spans to parent_event_id is not 1:1 with Tselora’s node instance model.

**Concern:** The OTEL adapter may be lossy. Core protocol stays Tselora-native; do not reshape the protocol around OTEL.

## 7. Homepage URL in pyproject.toml

`pyproject.toml` currently points at `https://github.com/tselora/tselora`. The implemented remote may differ (`Tselora/Tselora`). Keep docs generic unless an ADR locks the canonical URL.

## 8. Package name vs data-directory name

The product and Python package are **Tselora** (`name = "tselora"` in `pyproject.toml`). The collector’s v1 data directory is still **`.agent-devtools/`** (see ADR-006 and `server/collector/app.py`). That on-disk path is the current implementation, not a second product. Whether to rename the directory later is undecided; do not change it without an ADR. The CLI is not implemented; `agent-devtools` as a pip/CLI name in older plan text is a stale placeholder.
