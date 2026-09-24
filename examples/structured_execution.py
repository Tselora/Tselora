"""Official Week 3 acceptance example: sequential nodes, retry, loop, fan-out, failure.

Retry, loop, and sequential sibling fan-out are ordinary Python control flow.
The SDK only records nested decorator invocations. Open the printed ``run_id``
in the one-run viewer.

Terminal 1:
    tselora serve

Terminal 2:
    TSELOA_COLLECTOR_URL=http://127.0.0.1:8000 python examples/structured_execution.py
"""

from __future__ import annotations

from sdk import agent, node, run, tool

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
    reset_search_attempts()
    with run() as run_id:
        print(f"run_id={run_id}")
        research()
        print(f"events: .agent-devtools/runs/{run_id}/events.jsonl")


if __name__ == "__main__":
    main()
