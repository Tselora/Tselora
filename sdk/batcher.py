"""In-memory at-least-once delivery. Does not write JSONL.

Crashes can lose unacked queued events (sequence gaps). Retries reuse the
same AgentEvent (same event_id and sequence). Full queue blocks the emitter.
"""

from __future__ import annotations

import queue
import threading
import time
from typing import Final

from core.events.schema import AgentEvent
from sdk.transport import Transport

_SENTINEL: Final[object] = object()


class EventBatcher:
    """Queue events and POST them from a worker thread with retries."""

    def __init__(
        self,
        transport: Transport,
        *,
        maxsize: int = 256,
        retry_backoff_s: float = 0.05,
        max_retry_backoff_s: float = 1.0,
    ) -> None:
        if maxsize < 1:
            raise ValueError("maxsize must be >= 1")
        self._transport = transport
        self._queue: queue.Queue[AgentEvent | object] = queue.Queue(maxsize=maxsize)
        self._retry_backoff_s = retry_backoff_s
        self._max_retry_backoff_s = max_retry_backoff_s
        self._stop = threading.Event()
        self._thread = threading.Thread(
            target=self._run,
            name="tselora-event-batcher",
            daemon=True,
        )
        self._thread.start()

    def send(self, event: AgentEvent) -> None:
        """Enqueue ``event``. Blocks when the queue is full (no drops)."""
        if self._stop.is_set():
            raise RuntimeError("EventBatcher is closed")
        self._queue.put(event)

    def flush(self, timeout: float = 30.0) -> None:
        """Block until queued events have been accepted by transport."""
        finished = threading.Event()

        def _join() -> None:
            self._queue.join()
            finished.set()

        waiter = threading.Thread(target=_join, name="tselora-batcher-flush", daemon=True)
        waiter.start()
        if not finished.wait(timeout):
            raise TimeoutError("event batcher flush timed out")

    def close(self) -> None:
        """Flush, then stop the worker. Does not close the inner transport."""
        if self._stop.is_set():
            return
        try:
            self.flush()
        except TimeoutError:
            pass
        self._stop.set()
        try:
            self._queue.put(_SENTINEL, timeout=1.0)
        except queue.Full:
            pass
        self._thread.join(timeout=5.0)

    def _run(self) -> None:
        while True:
            try:
                item = self._queue.get(timeout=0.1)
            except queue.Empty:
                if self._stop.is_set():
                    return
                continue
            if item is _SENTINEL:
                self._queue.task_done()
                return
            event = item
            assert isinstance(event, AgentEvent)
            self._deliver(event)
            self._queue.task_done()

    def _deliver(self, event: AgentEvent) -> None:
        delay = self._retry_backoff_s
        while True:
            try:
                self._transport.send(event)
                return
            except Exception:
                if self._stop.is_set():
                    return
                time.sleep(delay)
                delay = min(delay * 2, self._max_retry_backoff_s)
