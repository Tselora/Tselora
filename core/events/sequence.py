"""Per-run monotonic sequence assigned at emit time, not at arrival.

Concurrency: ``next()`` is serialized with a ``threading.Lock``. One
``SequenceCounter`` instance must be shared for a given ``run_id`` so
parallel threads in the same process still get a total order.

Sequence is *not* network arrival order. Gaps are allowed if an emit
never reaches the collector.
"""

from __future__ import annotations

import threading


class SequenceCounter:
    """Monotonic integer generator. Starts at 0; the first ``next()`` is 1."""

    def __init__(self, start: int = 0) -> None:
        if start < 0:
            raise ValueError("start must be >= 0")
        self._value = start
        self._lock = threading.Lock()

    def next(self) -> int:
        """Return the next sequence number (1, 2, 3, ... if start is 0)."""
        with self._lock:
            self._value += 1
            return self._value

    @property
    def current(self) -> int:
        """Last issued value, or the start value if none have been issued."""
        with self._lock:
            return self._value
