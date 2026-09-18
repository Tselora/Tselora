# ADR-007: Live Sequence-Gap Buffer and Skip-Hole Timeout

- **Status:** Accepted
- **Date:** 2026-09-18

## Context

Transport is asynchronous and at-least-once (ADR-002). Events can arrive out of `sequence` order. Some sequence numbers may never arrive (crash after the emitter increments `sequence`).

REST rebuild from JSONL is already authoritative and orders by producer `sequence` (ADR-004, ADR-005). Live projection must not apply in arrival order (flicker, false causality). It also must not stall forever waiting for a sequence that will never exist.

`ProjectionEngine.apply` already accepts a later, lower `sequence` (lifecycle by sequence, topology parent repair). The engine has no un-apply. `ProjectionState` / `StatePatch` have no gap or watermark fields.

Open questions 1 and 2 (buffer-until-contiguous vs apply-and-reorder; timeout vs stuck UI) are resolved by this ADR.

## Decision

v1 **live** projection (not REST, not `rebuild`) uses **contiguous wait**, then **skip-hole apply**, with a **2.0 second** timer per hole.

1. **JSONL persists immediately** on ingest. The live buffer is not persistence and not a second log.

2. Live projection is **per `run_id`**. Live `apply` order is producer-assigned **`sequence`**, never arrival order.

3. **`next_seq` starts at 1** for each run.

4. If the event’s `sequence == next_seq`: call existing `ProjectionEngine.apply`, advance `next_seq`, then drain any buffered events that are now contiguous, in increasing `sequence`.

5. If `sequence > next_seq`: the event is already (or is) persisted; **buffer** it for live projection; start a **2.0s** timer for the **current missing `next_seq`** if that hole’s timer is not already running.

6. The timer **belongs to the current hole**. Later buffered events **do not reset** it. If the missing sequence arrives before timeout, **cancel** the timer and drain normally (step 4).

7. On timeout (**skip-hole**):
   - do not drop the missing event if it arrives later
   - set `next_seq` to the **lowest buffered sequence**
   - `apply` buffered events in **increasing sequence**
   - do not `apply` in arrival order

8. If a previously skipped **lower** sequence arrives later: persist normally; if `event_id` is new, **`apply` immediately**; **never rollback** already-applied events. Duplicate `event_id` remains a no-op (ADR-002).

9. **Do not change `ProjectionEngine`** for this policy. It already handles late lower-sequence events.

10. Live projection **must not** invent a gap event, watermark field, or second semantic model. A hole is visible only as missing `sequence` values on the existing timeline.

11. WebSocket emits **`StatePatch` only after** `apply` of an event or a drained batch (ADR-005). Buffered events emit **no** patch until drained.

12. **REST remains rebuild-based and authoritative.** REST does not use the live buffer or the 2.0s timer.

13. After a normal drain (contiguous, timeout skip, or late fill):

    `live_snapshot == ProjectionEngine(run_id).rebuild(JsonlEventStore.read(run_id))`

14. If that invariant fails: **rebuild** the live session from JSONL; do **not** un-apply; clients recover via **REST** bootstrap/reconnect (ADR-005).

15. Client `StatePatch` cursor mismatch means **REST resync**. The client must not invent missing events or reconstruct projection semantics.

## Consequences

**Positive**

- Live UI waits briefly for out-of-order delivery without treating arrival as causality
- Lost sequences do not stall live projection forever
- REST, replay, and reconnect stay a pure JSONL rebuild
- No protocol or `ProjectionState` field changes

**Negative**

- For up to 2.0s, live state can lag REST (REST already includes persisted-but-buffered events)
- After skip-hole, timeline `sequence` can jump; a late fill is applied out of live `next_seq` order but still through the engine
- Implementers must keep live sessions and REST on the same `JsonlEventStore`

## Alternatives considered

1. **Apply in arrival order** — Rejected (ADR-002; flicker; false edges).
2. **Wait forever for contiguous sequence** — Rejected; crash gaps are normal.
3. **Mark the gap on `ProjectionState` / watermark-only advance (no `apply` past the hole)** — Rejected for v1; second semantic channel; REST cannot round-trip the mark; timeout would not advance live projection.
4. **Timeout = always `rebuild` instead of skip-hole `apply`** — Rebuild remains the **mismatch** repair (decision 14), not the normal timeout path. Normal timeout is skip-hole `apply` of the already-persisted buffer (equivalent to rebuild of that log when the buffer matches JSONL).
5. **Un-apply / rollback live state when a skipped sequence arrives** — Rejected; the engine has no un-apply; log + `apply`/`rebuild` are the recovery tools.
