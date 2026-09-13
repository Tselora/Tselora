"""Synchronous @agent / @node / @tool / @llm decorators and run()."""

from __future__ import annotations

import os
from collections.abc import Callable, Iterator
from contextlib import contextmanager
from functools import wraps
from typing import ParamSpec, TypeVar, overload

from core.context import ExecutionContext, reset_context, set_context
from core.events.ids import new_run_id
from core.events.schema import Actor, NodeRef
from core.events.sequence import SequenceCounter
from core.events.types import EventType
from sdk.batcher import EventBatcher
from sdk.emitter import EventEmitter
from sdk.transport import DEFAULT_COLLECTOR_URL, CollectorTransport

P = ParamSpec("P")
R = TypeVar("R")

_emitter: EventEmitter | None = None


def configure_emitter(emitter: EventEmitter | None) -> None:
    """Install the process-wide emitter (transport), or reset to default."""
    global _emitter
    previous = _emitter
    _emitter = emitter
    if previous is not None and previous is not emitter:
        previous.close()


def get_emitter() -> EventEmitter:
    global _emitter
    if _emitter is None:
        base = os.environ.get("TSELOA_COLLECTOR_URL", DEFAULT_COLLECTOR_URL)
        transport = EventBatcher(CollectorTransport(base_url=base))
        _emitter = EventEmitter(transport)
    return _emitter


@contextmanager
def run(*, run_id: str | None = None) -> Iterator[str]:
    """Bind a run context, emit run.started, then run.completed or run.failed.

    Nested ``@agent`` / ``@node`` / ``@tool`` / ``@llm`` calls inherit this context.
    """
    rid = run_id or new_run_id()
    ctx = ExecutionContext(run_id=rid, sequence=SequenceCounter())
    token = set_context(ctx)
    emitter = get_emitter()
    started = emitter.emit(
        EventType.RUN_STARTED,
        status="started",
        actor=Actor(type="sdk", id="run"),
        ctx=ctx,
    )
    ctx.push(parent_event_id=started.event_id, node=None, execution_instance_id=None)
    try:
        yield rid
    except BaseException as exc:
        emitter.emit(
            EventType.RUN_FAILED,
            status="failed",
            payload={"error_type": type(exc).__name__, "message": str(exc)},
            ctx=ctx,
        )
        raise
    else:
        emitter.emit(EventType.RUN_COMPLETED, status="completed", ctx=ctx)
    finally:
        try:
            ctx.pop()
        except RuntimeError:
            pass
        try:
            emitter.flush()
        except TimeoutError:
            pass
        reset_context(token)


def _logical_name(func: Callable[..., object], name: str | None) -> str:
    if name:
        return name
    module = getattr(func, "__module__", "") or ""
    qual = getattr(func, "__qualname__", getattr(func, "__name__", "node"))
    return f"{module}.{qual}" if module else str(qual)


def _wrap_instrumented(
    func: Callable[P, R],
    name: str | None,
    *,
    kind: str,
    started: EventType,
    completed: EventType,
    failed: EventType,
) -> Callable[P, R]:
    logical_id = _logical_name(func, name)

    @wraps(func)
    def wrapper(*args: P.args, **kwargs: P.kwargs) -> R:
        from core.context import require_context

        ctx = require_context()
        emitter = get_emitter()
        instance_id = ctx.next_instance_id(logical_id)
        node = NodeRef(id=logical_id, type=kind)
        actor = Actor(type=kind, id=logical_id)

        started_event = emitter.emit(
            started,
            status="started",
            actor=actor,
            node=node,
            execution_instance_id=instance_id,
            ctx=ctx,
        )
        ctx.push(
            parent_event_id=started_event.event_id,
            node=node,
            execution_instance_id=instance_id,
        )
        try:
            result = func(*args, **kwargs)
        except BaseException as exc:
            emitter.emit(
                failed,
                status="failed",
                actor=actor,
                node=node,
                execution_instance_id=instance_id,
                payload={"error_type": type(exc).__name__, "message": str(exc)},
                ctx=ctx,
            )
            raise
        else:
            emitter.emit(
                completed,
                status="completed",
                actor=actor,
                node=node,
                execution_instance_id=instance_id,
                ctx=ctx,
            )
            return result
        finally:
            ctx.pop()

    return wrapper


@overload
def agent(func: Callable[P, R]) -> Callable[P, R]: ...


@overload
def agent(*, name: str | None = None) -> Callable[[Callable[P, R]], Callable[P, R]]: ...


def agent(
    func: Callable[P, R] | None = None,
    *,
    name: str | None = None,
) -> Callable[P, R] | Callable[[Callable[P, R]], Callable[P, R]]:
    """Instrument a synchronous function as a logical agent node."""

    def apply(inner: Callable[P, R]) -> Callable[P, R]:
        return _wrap_instrumented(
            inner,
            name,
            kind="agent",
            started=EventType.AGENT_STARTED,
            completed=EventType.AGENT_COMPLETED,
            failed=EventType.AGENT_FAILED,
        )

    if func is not None:
        return apply(func)
    return apply


@overload
def node(func: Callable[P, R]) -> Callable[P, R]: ...


@overload
def node(*, name: str | None = None) -> Callable[[Callable[P, R]], Callable[P, R]]: ...


def node(
    func: Callable[P, R] | None = None,
    *,
    name: str | None = None,
) -> Callable[P, R] | Callable[[Callable[P, R]], Callable[P, R]]:
    """Instrument a synchronous function as a logical execution node."""

    def apply(inner: Callable[P, R]) -> Callable[P, R]:
        return _wrap_instrumented(
            inner,
            name,
            kind="node",
            started=EventType.NODE_STARTED,
            completed=EventType.NODE_COMPLETED,
            failed=EventType.NODE_FAILED,
        )

    if func is not None:
        return apply(func)
    return apply


@overload
def tool(func: Callable[P, R]) -> Callable[P, R]: ...


@overload
def tool(*, name: str | None = None) -> Callable[[Callable[P, R]], Callable[P, R]]: ...


def tool(
    func: Callable[P, R] | None = None,
    *,
    name: str | None = None,
) -> Callable[P, R] | Callable[[Callable[P, R]], Callable[P, R]]:
    """Instrument a synchronous function as a logical tool node.

    ``*.completed`` / ``*.failed`` use ``parent_event_id`` of the matching
    ``*.started`` from the contextvars stack, not timestamps.
    """

    def apply(inner: Callable[P, R]) -> Callable[P, R]:
        return _wrap_instrumented(
            inner,
            name,
            kind="tool",
            started=EventType.TOOL_STARTED,
            completed=EventType.TOOL_COMPLETED,
            failed=EventType.TOOL_FAILED,
        )

    if func is not None:
        return apply(func)
    return apply


@overload
def llm(func: Callable[P, R]) -> Callable[P, R]: ...


@overload
def llm(*, name: str | None = None) -> Callable[[Callable[P, R]], Callable[P, R]]: ...


def llm(
    func: Callable[P, R] | None = None,
    *,
    name: str | None = None,
) -> Callable[P, R] | Callable[[Callable[P, R]], Callable[P, R]]:
    """Instrument a synchronous function as a logical LLM node."""

    def apply(inner: Callable[P, R]) -> Callable[P, R]:
        return _wrap_instrumented(
            inner,
            name,
            kind="llm",
            started=EventType.LLM_STARTED,
            completed=EventType.LLM_COMPLETED,
            failed=EventType.LLM_FAILED,
        )

    if func is not None:
        return apply(func)
    return apply
