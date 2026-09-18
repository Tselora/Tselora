"""Append-only JSONL EventStore. Authoritative log; not a database."""

from __future__ import annotations

import json
import re
import threading
from collections.abc import Iterator
from pathlib import Path

from core.events.schema import AgentEvent

_SAFE_RUN_ID = re.compile(r"^[A-Za-z0-9._-]+$")


class JsonlEventStore:
    """Persist one JSON object per line under ``<base>/runs/<run_id>/events.jsonl``.

    v1 assumes a single local collector process per data directory.
    ``append`` is idempotent on ``event_id``. Physical file order is
    arrival order, not causal order.
    """

    def __init__(self, base_dir: str | Path) -> None:
        self._base = Path(base_dir)
        self._lock = threading.Lock()
        self._seen: dict[str, set[str]] = {}

    def _run_dir(self, run_id: str) -> Path:
        if not _SAFE_RUN_ID.match(run_id):
            raise ValueError(f"unsafe run_id: {run_id!r}")
        return self._base / "runs" / run_id

    def _events_path(self, run_id: str) -> Path:
        return self._run_dir(run_id) / "events.jsonl"

    def _ensure_seen(self, run_id: str) -> set[str]:
        if run_id not in self._seen:
            ids: set[str] = set()
            path = self._events_path(run_id)
            if path.is_file():
                with path.open(encoding="utf-8") as handle:
                    for line in handle:
                        line = line.strip()
                        if not line:
                            continue
                        data = json.loads(line)
                        eid = data.get("event_id")
                        if isinstance(eid, str):
                            ids.add(eid)
            self._seen[run_id] = ids
        return self._seen[run_id]

    def has_event(self, run_id: str, event_id: str) -> bool:
        with self._lock:
            return event_id in self._ensure_seen(run_id)

    def append(self, event: AgentEvent) -> bool:
        """Persist ``event``. Return False if ``event_id`` was already stored."""
        with self._lock:
            seen = self._ensure_seen(event.run_id)
            if event.event_id in seen:
                return False
            path = self._events_path(event.run_id)
            path.parent.mkdir(parents=True, exist_ok=True)
            payload = event.model_dump_json() + "\n"
            with path.open("a", encoding="utf-8") as handle:
                handle.write(payload)
                handle.flush()
            seen.add(event.event_id)
            return True

    def has_run(self, run_id: str) -> bool:
        """True when ``events.jsonl`` exists for ``run_id`` (including an empty file)."""
        return self._events_path(run_id).is_file()

    def read(self, run_id: str) -> list[AgentEvent]:
        return list(self.iter_events(run_id))

    def iter_events(self, run_id: str) -> Iterator[AgentEvent]:
        path = self._events_path(run_id)
        if not path.is_file():
            return
        with path.open(encoding="utf-8") as handle:
            for line in handle:
                line = line.strip()
                if not line:
                    continue
                yield AgentEvent.model_validate_json(line)
