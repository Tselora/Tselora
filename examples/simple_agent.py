"""Minimal agent: decorated tool → HTTP collector → SQLite.

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
        print(f"explorer: http://127.0.0.1:5173/runs/{run_id}")


if __name__ == "__main__":
    main()
