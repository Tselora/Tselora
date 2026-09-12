"""Execution context via contextvars. There is no global current node.

Limitation (this slice): thread/executor/async propagation helpers are
not implemented. Nested *synchronous* decorators share this context and
restore the stack on exit, including when the inner function raises.

Opaque third-party threads and subprocesses will not see this context.
"""

from __future__ import annotations

from contextvars import ContextVar, Token
from dataclasses import dataclass, field

from core.events.schema import NodeRef
from core.events.sequence import SequenceCounter


@dataclass
class ContextFrame:
    """One nesting level of active execution (tool/node/run)."""

    parent_event_id: str | None
    node: NodeRef | None
    execution_instance_id: str | None


@dataclass
class ExecutionContext:
    """Per-run context stored in a ContextVar, not a process global node."""

    run_id: str
    sequence: SequenceCounter
    _stack: list[ContextFrame] = field(default_factory=list)
    _instance_counts: dict[str, int] = field(default_factory=dict)

    def current_parent_event_id(self) -> str | None:
        if not self._stack:
            return None
        return self._stack[-1].parent_event_id

    def current_node(self) -> NodeRef | None:
        if not self._stack:
            return None
        return self._stack[-1].node

    def push(
        self,
        *,
        parent_event_id: str | None,
        node: NodeRef | None,
        execution_instance_id: str | None,
    ) -> None:
        self._stack.append(
            ContextFrame(
                parent_event_id=parent_event_id,
                node=node,
                execution_instance_id=execution_instance_id,
            )
        )

    def pop(self) -> ContextFrame:
        if not self._stack:
            raise RuntimeError("execution context stack is empty")
        return self._stack.pop()

    def next_instance_id(self, logical_node_id: str) -> str:
        """Allocate ``node_id#n`` for this logical node within the run."""
        n = self._instance_counts.get(logical_node_id, 0) + 1
        self._instance_counts[logical_node_id] = n
        return f"{logical_node_id}#{n}"


_execution_context: ContextVar[ExecutionContext | None] = ContextVar(
    "tselora_execution_context",
    default=None,
)


def get_context() -> ExecutionContext | None:
    """Return the active execution context, or None if no run is bound."""
    return _execution_context.get()


def require_context() -> ExecutionContext:
    ctx = get_context()
    if ctx is None:
        raise RuntimeError("no Tselora execution context; start a run first")
    return ctx


def set_context(ctx: ExecutionContext) -> Token[ExecutionContext | None]:
    """Bind ``ctx`` in this contextvars context. Returns a reset token."""
    return _execution_context.set(ctx)


def reset_context(token: Token[ExecutionContext | None]) -> None:
    _execution_context.reset(token)


def clear_context() -> None:
    _execution_context.set(None)
