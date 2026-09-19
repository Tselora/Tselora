from __future__ import annotations

from pathlib import Path

from core.events.types import EventType
from core.projection.engine import ProjectionEngine
from core.projection.live import FakeClock, GAP_TIMEOUT_SECONDS, LiveProjectionSession
from core.projection.patches import apply_patch
from server.storage.jsonl import JsonlEventStore
from tests.test_projection import _evt


def _session() -> tuple[LiveProjectionSession, FakeClock, list[tuple[str, object]]]:
    clock = FakeClock()
    received: list[tuple[str, object]] = []
    session = LiveProjectionSession(
        clock=clock, on_patch=lambda run_id, patch: received.append((run_id, patch))
    )
    return session, clock, received


def _rebuild(store: JsonlEventStore, run_id: str):
    return ProjectionEngine(run_id=run_id).rebuild(store.read(run_id))


def test_sequence_1_applies_immediately_and_emits_patch() -> None:
    session, _, received = _session()
    event = _evt(event_id="e1", run_id="r1", sequence=1, type=EventType.RUN_STARTED)
    patches = session.ingest(event)
    assert len(patches) == 1
    assert received == [("r1", patches[0])]
    assert session.next_seq("r1") == 2
    assert session.snapshot("r1").timeline.entries[0].event_id == "e1"


def test_sequence_3_is_buffered_without_patch(tmp_path: Path) -> None:
    session, clock, received = _session()
    store = JsonlEventStore(tmp_path)
    e1 = _evt(event_id="e1", run_id="r1", sequence=1, type=EventType.RUN_STARTED)
    e3 = _evt(event_id="e3", run_id="r1", sequence=3, type=EventType.RUN_COMPLETED)
    store.append(e1)
    store.append(e3)
    session.ingest(e1)
    received.clear()
    patches = session.ingest(e3)
    assert patches == []
    assert received == []
    assert session.next_seq("r1") == 2
    assert all(e.event_id != "e3" for e in session.snapshot("r1").timeline.entries)
    clock.advance(GAP_TIMEOUT_SECONDS - 0.001)
    assert received == []


def test_fill_hole_before_timeout_applies_2_then_3(tmp_path: Path) -> None:
    session, _, received = _session()
    store = JsonlEventStore(tmp_path)
    events = [
        _evt(event_id="e1", run_id="r1", sequence=1, type=EventType.RUN_STARTED),
        _evt(event_id="e3", run_id="r1", sequence=3, type=EventType.TOOL_COMPLETED),
        _evt(event_id="e2", run_id="r1", sequence=2, type=EventType.TOOL_STARTED),
    ]
    for event in events:
        store.append(event)
        session.ingest(event)
    applied_ids = [p.timeline.entries[-1].event_id for _, p in received if p.timeline]
    assert applied_ids == ["e1", "e2", "e3"]
    assert session.snapshot("r1") == _rebuild(store, "r1")


def test_timeout_skip_applies_buffered_and_matches_rebuild(tmp_path: Path) -> None:
    session, clock, received = _session()
    store = JsonlEventStore(tmp_path)
    e1 = _evt(event_id="e1", run_id="r1", sequence=1, type=EventType.RUN_STARTED)
    e3 = _evt(event_id="e3", run_id="r1", sequence=3, type=EventType.RUN_COMPLETED)
    store.append(e1)
    store.append(e3)
    session.ingest(e1)
    session.ingest(e3)
    n = len(received)
    clock.advance(GAP_TIMEOUT_SECONDS)
    assert len(received) == n + 1
    assert session.snapshot("r1") == _rebuild(store, "r1")
    assert [e.event_id for e in session.snapshot("r1").timeline.entries] == ["e1", "e3"]


def test_late_lower_sequence_after_skip_no_rollback(tmp_path: Path) -> None:
    session, clock, _ = _session()
    store = JsonlEventStore(tmp_path)
    e1 = _evt(event_id="e1", run_id="r1", sequence=1, type=EventType.RUN_STARTED)
    e3 = _evt(event_id="e3", run_id="r1", sequence=3, type=EventType.TOOL_COMPLETED)
    e2 = _evt(event_id="e2", run_id="r1", sequence=2, type=EventType.TOOL_STARTED)
    store.append(e1)
    store.append(e3)
    session.ingest(e1)
    session.ingest(e3)
    clock.advance(GAP_TIMEOUT_SECONDS)
    after_skip = session.snapshot("r1")
    store.append(e2)
    session.ingest(e2)
    assert after_skip.timeline.entries[0].event_id == "e1"
    assert session.snapshot("r1") == _rebuild(store, "r1")
    ids = [e.event_id for e in session.snapshot("r1").timeline.entries]
    assert ids == ["e1", "e2", "e3"]


def test_first_event_sequence_5_applies_after_timeout(tmp_path: Path) -> None:
    session, clock, received = _session()
    store = JsonlEventStore(tmp_path)
    e5 = _evt(event_id="e5", run_id="r1", sequence=5, type=EventType.RUN_STARTED)
    store.append(e5)
    assert session.ingest(e5) == []
    assert received == []
    clock.advance(GAP_TIMEOUT_SECONDS)
    assert len(received) == 1
    assert session.snapshot("r1") == _rebuild(store, "r1")
    assert session.next_seq("r1") == 6


def test_duplicate_event_id_no_second_patch() -> None:
    session, _, received = _session()
    event = _evt(event_id="dup", run_id="r1", sequence=1, type=EventType.RUN_STARTED)
    first = session.ingest(event)
    second = session.ingest(event)
    assert len(first) == 1
    assert second == []
    assert len(received) == 1


def test_contiguous_drain_2_3_4_when_2_arrives() -> None:
    session, _, received = _session()
    session.ingest(_evt(event_id="e1", run_id="r1", sequence=1, type=EventType.RUN_STARTED))
    session.ingest(_evt(event_id="e4", run_id="r1", sequence=4, type=EventType.RUN_COMPLETED))
    session.ingest(_evt(event_id="e3", run_id="r1", sequence=3, type=EventType.TOOL_COMPLETED))
    received.clear()
    session.ingest(_evt(event_id="e2", run_id="r1", sequence=2, type=EventType.TOOL_STARTED))
    tips = [p.timeline.entries[-1].event_id for _, p in received if p.timeline]
    assert tips == ["e2", "e3", "e4"]
    assert session.next_seq("r1") == 5


def test_each_hole_has_its_own_timeout(tmp_path: Path) -> None:
    session, clock, received = _session()
    store = JsonlEventStore(tmp_path)
    e1 = _evt(event_id="e1", run_id="r1", sequence=1, type=EventType.RUN_STARTED)
    e3 = _evt(event_id="e3", run_id="r1", sequence=3, type=EventType.TOOL_STARTED)
    e5 = _evt(event_id="e5", run_id="r1", sequence=5, type=EventType.RUN_COMPLETED)
    for event in (e1, e3, e5):
        store.append(event)
        session.ingest(event)
    clock.advance(GAP_TIMEOUT_SECONDS)
    assert [e.event_id for e in session.snapshot("r1").timeline.entries] == ["e1", "e3"]
    assert session.next_seq("r1") == 4
    clock.advance(GAP_TIMEOUT_SECONDS)
    assert session.snapshot("r1") == _rebuild(store, "r1")
    assert [e.event_id for e in session.snapshot("r1").timeline.entries] == ["e1", "e3", "e5"]


def test_later_event_does_not_reset_timer(tmp_path: Path) -> None:
    session, clock, received = _session()
    store = JsonlEventStore(tmp_path)
    e1 = _evt(event_id="e1", run_id="r1", sequence=1, type=EventType.RUN_STARTED)
    e3 = _evt(event_id="e3", run_id="r1", sequence=3, type=EventType.TOOL_STARTED)
    e4 = _evt(event_id="e4", run_id="r1", sequence=4, type=EventType.TOOL_COMPLETED)
    store.append(e1)
    store.append(e3)
    store.append(e4)
    session.ingest(e1)
    session.ingest(e3)
    clock.advance(1.0)
    session.ingest(e4)
    clock.advance(1.0)
    assert session.snapshot("r1") == _rebuild(store, "r1")
    assert [e.event_id for e in session.snapshot("r1").timeline.entries] == ["e1", "e3", "e4"]
    assert len(received) >= 3


def test_hole_fill_just_before_timeout_cancels_skip(tmp_path: Path) -> None:
    session, clock, received = _session()
    store = JsonlEventStore(tmp_path)
    e1 = _evt(event_id="e1", run_id="r1", sequence=1, type=EventType.RUN_STARTED)
    e3 = _evt(event_id="e3", run_id="r1", sequence=3, type=EventType.RUN_COMPLETED)
    e2 = _evt(event_id="e2", run_id="r1", sequence=2, type=EventType.TOOL_STARTED)
    store.append(e1)
    store.append(e3)
    session.ingest(e1)
    session.ingest(e3)
    clock.advance(GAP_TIMEOUT_SECONDS - 0.001)
    store.append(e2)
    session.ingest(e2)
    n = len(received)
    clock.advance(1.0)
    assert len(received) == n
    assert session.snapshot("r1") == _rebuild(store, "r1")
    assert [e.sequence for e in session.snapshot("r1").timeline.entries] == [1, 2, 3]


def test_patch_composition_matches_snapshot() -> None:
    session, _, _ = _session()
    run_id = "r1"
    initial = session.snapshot(run_id)
    events = [
        _evt(event_id="e1", run_id=run_id, sequence=1, type=EventType.RUN_STARTED),
        _evt(event_id="e2", run_id=run_id, sequence=2, type=EventType.TOOL_STARTED),
        _evt(event_id="e3", run_id=run_id, sequence=3, type=EventType.TOOL_COMPLETED),
    ]
    for event in events:
        session.ingest(event)
    state = initial
    for patch in session.patches(run_id):
        state = apply_patch(state, patch)
    assert state == session.snapshot(run_id)


def test_ingest_order_converges_with_store_rebuild(tmp_path: Path) -> None:
    session, clock, _ = _session()
    store = JsonlEventStore(tmp_path)
    run_id = "r1"
    events = [
        _evt(event_id="e3", run_id=run_id, sequence=3, type=EventType.RUN_COMPLETED),
        _evt(event_id="e1", run_id=run_id, sequence=1, type=EventType.RUN_STARTED),
        _evt(event_id="e2", run_id=run_id, sequence=2, type=EventType.TOOL_STARTED),
    ]
    for event in events:
        store.append(event)
        session.ingest(event)
    clock.advance(GAP_TIMEOUT_SECONDS)
    assert session.snapshot(run_id) == _rebuild(store, run_id)


def test_runs_are_isolated() -> None:
    session, clock, received = _session()
    session.ingest(_evt(event_id="a1", run_id="ra", sequence=1, type=EventType.RUN_STARTED))
    session.ingest(_evt(event_id="b3", run_id="rb", sequence=3, type=EventType.RUN_STARTED))
    assert session.next_seq("ra") == 2
    assert session.next_seq("rb") == 1
    clock.advance(GAP_TIMEOUT_SECONDS)
    assert [e.event_id for e in session.snapshot("ra").timeline.entries] == ["a1"]
    assert [e.event_id for e in session.snapshot("rb").timeline.entries] == ["b3"]
    assert {run_id for run_id, _ in received} == {"ra", "rb"}
