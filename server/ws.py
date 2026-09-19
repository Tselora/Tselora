"""WebSocket delivery of live StatePatch objects. No projection semantics."""

from __future__ import annotations

import asyncio
import threading
from dataclasses import dataclass

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from core.projection.patches import StatePatch

router = APIRouter()

PATCH_QUEUE_MAXSIZE = 32
WS_CLOSE_SLOW_CLIENT = 1013

_STOP = object()
_OVERFLOW = object()


@dataclass(eq=False)
class _Subscriber:
    loop: asyncio.AbstractEventLoop
    queue: asyncio.Queue[object]
    run_id: str
    hub: PatchHub
    overflowed: bool = False

    def offer(self, item: object) -> None:
        """Non-blocking. Schedules enqueue on the connection's event loop."""

        def _put() -> None:
            try:
                if item is _STOP:
                    try:
                        self.queue.put_nowait(_STOP)
                    except asyncio.QueueFull:
                        return
                    return
                if self.overflowed:
                    return
                try:
                    self.queue.put_nowait(item)
                except asyncio.QueueFull:
                    self._mark_overflow()
            except Exception:
                self._mark_overflow()

        try:
            self.loop.call_soon_threadsafe(_put)
        except RuntimeError:
            self.overflowed = True
            self.hub.drop(self.run_id, self)

    def _mark_overflow(self) -> None:
        self.overflowed = True
        self.hub.drop(self.run_id, self)
        try:
            self.queue.put_nowait(_OVERFLOW)
        except asyncio.QueueFull:
            pass
        except Exception:
            pass


class PatchHub:
    """Fan-out StatePatch JSON to per-run WebSocket subscribers."""

    def __init__(self, maxsize: int = PATCH_QUEUE_MAXSIZE) -> None:
        if maxsize < 1:
            raise ValueError("maxsize must be >= 1")
        self.maxsize = maxsize
        self._lock = threading.Lock()
        self._subs: dict[str, set[_Subscriber]] = {}

    def register(self, run_id: str, loop: asyncio.AbstractEventLoop) -> _Subscriber:
        sub = _Subscriber(
            loop=loop,
            queue=asyncio.Queue(maxsize=self.maxsize),
            run_id=run_id,
            hub=self,
        )
        with self._lock:
            self._subs.setdefault(run_id, set()).add(sub)
        return sub

    def drop(self, run_id: str, sub: _Subscriber) -> None:
        """Remove one subscriber. Idempotent. Does not close the socket."""
        with self._lock:
            bucket = self._subs.get(run_id)
            if bucket is None:
                return
            bucket.discard(sub)
            if not bucket:
                del self._subs[run_id]

    def unregister(self, run_id: str, sub: _Subscriber) -> None:
        self.drop(run_id, sub)
        sub.offer(_STOP)

    def subscriber_count(self, run_id: str) -> int:
        with self._lock:
            return len(self._subs.get(run_id, ()))

    def on_patch(self, run_id: str, patch: StatePatch) -> None:
        payload = patch.model_dump(mode="json")
        with self._lock:
            subs = list(self._subs.get(run_id, ()))
        for sub in subs:
            sub.offer(payload)


@router.websocket("/v1/runs/{run_id}/ws")
async def run_patches_ws(websocket: WebSocket, run_id: str) -> None:
    store = websocket.app.state.store
    try:
        store.has_run(run_id)
    except ValueError:
        await websocket.close(code=1008)
        return

    await websocket.accept()
    hub: PatchHub = websocket.app.state.hub
    sub = hub.register(run_id, asyncio.get_running_loop())
    sender = asyncio.create_task(_send_patches(websocket, sub))
    receiver = asyncio.create_task(_drain_client(websocket))
    try:
        done, pending = await asyncio.wait(
            {sender, receiver}, return_when=asyncio.FIRST_COMPLETED
        )
        for task in pending:
            task.cancel()
        for task in done:
            if task.cancelled():
                continue
            exc = task.exception()
            if exc is not None and not isinstance(exc, WebSocketDisconnect):
                raise exc
    except WebSocketDisconnect:
        pass
    finally:
        sender.cancel()
        receiver.cancel()
        hub.unregister(run_id, sub)


async def _send_patches(websocket: WebSocket, sub: _Subscriber) -> None:
    try:
        while True:
            payload = await sub.queue.get()
            if payload is _STOP:
                return
            if payload is _OVERFLOW:
                await websocket.close(code=WS_CLOSE_SLOW_CLIENT)
                return
            await websocket.send_json(payload)
            if sub.overflowed:
                await websocket.close(code=WS_CLOSE_SLOW_CLIENT)
                return
    except WebSocketDisconnect:
        return


async def _drain_client(websocket: WebSocket) -> None:
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        return
