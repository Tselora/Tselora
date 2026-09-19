"""Live per-run projection: contiguous wait, then skip-hole apply (ADR-007).

Not HTTP. Not WebSocket. Persistence remains the caller's responsibility.
"""

from __future__ import annotations

import threading
import time
from collections.abc import Callable
from dataclasses import dataclass, field

from core.events.schema import AgentEvent
from core.projection.engine import ProjectionEngine
from core.projection.models import ProjectionState
from core.projection.patches import StatePatch, diff

GAP_TIMEOUT_SECONDS = 2.0


class TimerHandle:
    def cancel(self) -> None:
        raise NotImplementedError


class LiveClock:
    """Schedule a callback after ``delay`` seconds of monotonic time."""

    def monotonic(self) -> float:
        raise NotImplementedError

    def call_later(self, delay: float, callback: Callable[[], None]) -> TimerHandle:
        raise NotImplementedError


class _ThreadTimerHandle(TimerHandle):
    def __init__(self, timer: threading.Timer) -> None:
        self._timer = timer

    def cancel(self) -> None:
        self._timer.cancel()


class MonotonicClock(LiveClock):
    """Production clock: ``time.monotonic`` + ``threading.Timer``."""

    def monotonic(self) -> float:
        return time.monotonic()

    def call_later(self, delay: float, callback: Callable[[], None]) -> TimerHandle:
        timer = threading.Timer(delay, callback)
        timer.daemon = True
        timer.start()
        return _ThreadTimerHandle(timer)


class FakeClock(LiveClock):
    """Deterministic clock for tests. ``advance`` fires due callbacks."""

    def __init__(self) -> None:
        self._now = 0.0
        self._seq = 0
        self._pending: list[_FakeAlarm] = []

    def monotonic(self) -> float:
        return self._now

    def call_later(self, delay: float, callback: Callable[[], None]) -> TimerHandle:
        self._seq += 1
        alarm = _FakeAlarm(due=self._now + delay, seq=self._seq, callback=callback)
        self._pending.append(alarm)
        return alarm

    def advance(self, seconds: float) -> None:
        self._now += seconds
        due = [a for a in self._pending if a.active and a.due <= self._now]
        self._pending = [a for a in self._pending if a.active and a.due > self._now]
        for alarm in sorted(due, key=lambda a: (a.due, a.seq)):
            if alarm.active:
                alarm.callback()


@dataclass
class _FakeAlarm(TimerHandle):
    due: float
    seq: int
    callback: Callable[[], None]
    active: bool = True

    def cancel(self) -> None:
        self.active = False


PatchListener = Callable[[str, StatePatch], None]


@dataclass
class _RunLive:
    run_id: str
    engine: ProjectionEngine
    next_seq: int = 1
    buffer: dict[int, dict[str, AgentEvent]] = field(default_factory=dict)
    timer: TimerHandle | None = None
    timer_hole: int | None = None


class LiveProjectionSession:
    """One process-local live projector. Independent engines/buffers/timers per run."""

    def __init__(
        self,
        *,
        clock: LiveClock | None = None,
        on_patch: PatchListener | None = None,
    ) -> None:
        self._clock: LiveClock = clock or MonotonicClock()
        self._listeners: list[PatchListener] = [] if on_patch is None else [on_patch]
        self._lock = threading.Lock()
        self._runs: dict[str, _RunLive] = {}
        self._patches: dict[str, list[StatePatch]] = {}

    def subscribe(self, listener: PatchListener) -> None:
        self._listeners.append(listener)

    def patches(self, run_id: str) -> tuple[StatePatch, ...]:
        return tuple(self._patches.get(run_id, ()))

    def snapshot(self, run_id: str) -> ProjectionState:
        with self._lock:
            live = self._runs.get(run_id)
            if live is None:
                return ProjectionEngine(run_id=run_id).snapshot()
            return live.engine.snapshot()

    def next_seq(self, run_id: str) -> int:
        with self._lock:
            live = self._runs.get(run_id)
            return 1 if live is None else live.next_seq

    def ingest(self, event: AgentEvent) -> list[StatePatch]:
        """Fold ``event`` into live projection. Caller already persisted JSONL."""
        with self._lock:
            return self._ingest_locked(event)

    def _run(self, run_id: str) -> _RunLive:
        live = self._runs.get(run_id)
        if live is None:
            live = _RunLive(run_id=run_id, engine=ProjectionEngine(run_id=run_id))
            self._runs[run_id] = live
            self._patches.setdefault(run_id, [])
        return live

    def _ingest_locked(self, event: AgentEvent) -> list[StatePatch]:
        live = self._run(event.run_id)
        emitted: list[StatePatch] = []
        seq = event.sequence
        if seq == live.next_seq:
            self._cancel_timer(live)
            self._apply_emit(live, event, emitted)
            live.next_seq += 1
            self._drain_contiguous(live, emitted)
        elif seq > live.next_seq:
            slot = live.buffer.setdefault(seq, {})
            slot[event.event_id] = event
            self._ensure_timer(live)
        else:
            self._apply_emit(live, event, emitted)
        return emitted

    def _drain_contiguous(self, live: _RunLive, emitted: list[StatePatch]) -> None:
        while live.next_seq in live.buffer:
            slot = live.buffer.pop(live.next_seq)
            for event in sorted(slot.values(), key=lambda e: e.event_id):
                self._apply_emit(live, event, emitted)
            live.next_seq += 1
        if live.buffer:
            self._ensure_timer(live)
        else:
            self._cancel_timer(live)

    def _skip_hole(self, run_id: str, hole: int) -> None:
        with self._lock:
            live = self._runs.get(run_id)
            if live is None or live.timer_hole != hole or not live.buffer:
                return
            self._cancel_timer(live)
            live.next_seq = min(live.buffer)
            emitted: list[StatePatch] = []
            self._drain_contiguous(live, emitted)

    def _apply_emit(
        self, live: _RunLive, event: AgentEvent, emitted: list[StatePatch]
    ) -> None:
        before = live.engine.snapshot()
        live.engine.apply(event)
        after = live.engine.snapshot()
        if before == after:
            return
        patch = diff(before, after)
        emitted.append(patch)
        self._patches.setdefault(live.run_id, []).append(patch)
        for listener in self._listeners:
            listener(live.run_id, patch)

    def _ensure_timer(self, live: _RunLive) -> None:
        if live.timer is not None or not live.buffer:
            return
        hole = live.next_seq
        live.timer_hole = hole
        run_id = live.run_id
        live.timer = self._clock.call_later(
            GAP_TIMEOUT_SECONDS, lambda: self._skip_hole(run_id, hole)
        )

    def _cancel_timer(self, live: _RunLive) -> None:
        if live.timer is not None:
            live.timer.cancel()
        live.timer = None
        live.timer_hole = None
