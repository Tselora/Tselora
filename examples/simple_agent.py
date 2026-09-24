"""Minimal agent: decorated tool → HTTP collector → JSONL.

Terminal 1:
    tselora serve

Terminal 2:
    TSELOA_COLLECTOR_URL=http://127.0.0.1:8000 python examples/simple_agent.py
"""

from __future__ import annotations

from sdk import run, tool


@tool(name="search_web")
def search_web(query: str) -> str:
    return f"results for {query}"


def main() -> None:
    with run() as run_id:
        print(f"run_id={run_id}")
        print(search_web("Tselora"))
        print(f"events: .agent-devtools/runs/{run_id}/events.jsonl")


if __name__ == "__main__":
    main()
