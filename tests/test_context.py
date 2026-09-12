from core.context import (
    ExecutionContext,
    get_context,
    reset_context,
    set_context,
)
from core.events.schema import NodeRef
from core.events.sequence import SequenceCounter


def test_no_global_current_node() -> None:
    import core.context as ctxmod

    assert not hasattr(ctxmod, "current_node")
    assert get_context() is None


def test_nested_context_restores_parent() -> None:
    ctx = ExecutionContext(run_id="run_a", sequence=SequenceCounter())
    token = set_context(ctx)
    try:
        ctx.push(parent_event_id="evt_run", node=None, execution_instance_id=None)
        outer = NodeRef(id="outer", type="tool")
        ctx.push(parent_event_id="evt_outer", node=outer, execution_instance_id="outer#1")
        assert get_context() is ctx
        assert ctx.current_parent_event_id() == "evt_outer"
        inner = NodeRef(id="inner", type="tool")
        ctx.push(parent_event_id="evt_inner", node=inner, execution_instance_id="inner#1")
        assert ctx.current_node() is not None
        assert ctx.current_node().id == "inner"
        ctx.pop()
        assert ctx.current_parent_event_id() == "evt_outer"
        ctx.pop()
        assert ctx.current_parent_event_id() == "evt_run"
    finally:
        reset_context(token)
    assert get_context() is None
