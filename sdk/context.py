"""Explicit context propagation across thread/executor boundaries.

Normal nested calls inherit the active ``contextvars`` context. Threads and
``ThreadPoolExecutor`` workers do not. Capture on the originating thread,
then bind a stack copy inside the worker so causal ``parent_event_id`` is
preserved without sharing a mutable stack.
"""

from __future__ import annotations

from collections.abc import Callable, Iterator
from contextlib import contextmanager
from functools import wraps
from typing import ParamSpec, TypeVar

from core.context import ExecutionContext, require_context, reset_context, set_context

P = ParamSpec("P")
R = TypeVar("R")


@contextmanager
def bind_context(ctx: ExecutionContext | None = None) -> Iterator[ExecutionContext]:
    """Bind a branched copy of ``ctx`` (or the current context) for this task.

    The copy shares ``run_id``, sequence, and instance allocation. Push/pop
    on the bound context does not mutate the originating stack. Always
    restores the previous ``contextvars`` binding, including on exception.
    """
    source = ctx if ctx is not None else require_context()
    bound = source.branch()
    token = set_context(bound)
    try:
        yield bound
    finally:
        reset_context(token)


def propagate_context(
    fn: Callable[P, R],
    ctx: ExecutionContext | None = None,
) -> Callable[P, R]:
    """Return a wrapper that runs ``fn`` with a copy of the originating context.

    Capture ``ctx`` (or the current context) on the calling thread—before
    ``executor.submit``—not inside the worker.
    """
    captured = ctx if ctx is not None else require_context()

    @wraps(fn)
    def wrapper(*args: P.args, **kwargs: P.kwargs) -> R:
        with bind_context(captured):
            return fn(*args, **kwargs)

    return wrapper
