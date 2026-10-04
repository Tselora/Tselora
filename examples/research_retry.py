"""Canonical demo: retry topology plus structured Why? fields.

Topology::

    run
     └─ research
         ├─ plan
         ├─ search_web #1 → failed (timeout)
         ├─ search_web #2 → succeeded
         └─ gather

After the first search fails, ``research`` emits allowlisted Why? keys on its
in-flight instance. A later decorator ``agent.completed`` with ``payload=None``
does not erase that payload.

Terminal 1:
    tselora serve

Terminal 2:
    cd ui && npm install && npm run dev

Terminal 3:
    TSELOA_COLLECTOR_URL=http://127.0.0.1:8000 python examples/research_retry.py

Open the printed ``run_id`` in Explorer, select ``research``, and inspect Why?.
Run twice for Compare (``left_run_id`` / ``right_run_id``) and Learn
(``?run_id=``; filter ``decision=retry``).
"""

from __future__ import annotations

from core.context import require_context
from core.events.types import EventType
from sdk import agent, get_emitter, node, run, tool

_search_calls = 0

RETRY_WHY: dict[str, str] = {
    "decision": "retry",
    "selected_strategy": "fallback_search",
    "evidence": "primary_search_timeout",
    "failure_category": "timeout",
    "action": "retry_search",
}


def reset_search_attempts() -> None:
    """First ``search_web`` call fails; the second succeeds."""
    global _search_calls
    _search_calls = 0


@tool(name="search_web")
def search_web(query: str) -> str:
    global _search_calls
    _search_calls += 1
    if _search_calls == 1:
        raise TimeoutError("search timed out")
    return f"results for {query}"


@node(name="plan")
def plan() -> None:
    return None


@node(name="gather")
def gather() -> None:
    return None


def emit_retry_why() -> None:
    ctx = require_context()
    instance_id = ctx.current_execution_instance_id()
    if instance_id is None:
        raise RuntimeError("retry Why? requires an in-flight execution instance")
    get_emitter().emit(
        EventType.AGENT_COMPLETED,
        status="completed",
        payload=dict(RETRY_WHY),
        execution_instance_id=instance_id,
        ctx=ctx,
    )


@agent(name="research")
def research() -> None:
    plan()
    try:
        search_web("Tselora")
    except TimeoutError:
        emit_retry_why()
        search_web("Tselora")
    gather()


def main() -> None:
    reset_search_attempts()
    with run() as run_id:
        print(f"run_id={run_id}")
        research()
        print(f"explorer: http://127.0.0.1:5173/runs/{run_id}")


if __name__ == "__main__":
    main()
