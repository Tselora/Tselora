"""Sequential nodes, retry, loop, fan-out, and a failed-then-retried tool.

Retry, loop, and sequential sibling fan-out are ordinary Python control flow.
The SDK records nested decorator invocations. Inspect the printed ``run_id``
via GET /v1/runs/{run_id}.

Terminal 1:
    tselora serve

Terminal 2:
    TSELORA_COLLECTOR_URL=http://127.0.0.1:8000 python examples/structured_execution.py
"""

from __future__ import annotations

import os

from tselora import (
    CollectorTransport,
    DEFAULT_COLLECTOR_URL,
    EventBatcher,
    EventEmitter,
    agent,
    configure_emitter,
    node,
    run,
    tool,
)


def _collector_url() -> str:
    return (
        os.environ.get("TSELORA_COLLECTOR_URL")
        or os.environ.get("TSELOA_COLLECTOR_URL")
        or DEFAULT_COLLECTOR_URL
    )

_search_calls = 0


def reset_search_attempts() -> None:
    """First ``search_web`` call fails; the second succeeds. For tests and main."""
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


@node(name="iterate")
def iterate(step: int) -> int:
    return step


@tool(name="fetch")
def fetch(item: str) -> str:
    return item


@node(name="merge")
def merge() -> None:
    return None


@node(name="gather")
def gather() -> None:
    fetch("a")
    fetch("b")
    merge()


@agent(name="research")
def research() -> None:
    plan()
    try:
        search_web("Tselora")
    except TimeoutError:
        search_web("Tselora")
    for step in (0, 1):
        iterate(step)
    gather()


def main() -> None:
    configure_emitter(EventEmitter(EventBatcher(CollectorTransport(_collector_url()))))
    reset_search_attempts()
    with run() as run_id:
        print(f"run_id={run_id}")
        research()
        print(f"explorer: http://127.0.0.1:5173/runs/{run_id}")


if __name__ == "__main__":
    main()
