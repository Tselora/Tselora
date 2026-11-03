"""Minimal agent: decorated tool → HTTP collector → SQLite.

Terminal 1:
    tselora serve

Terminal 2:
    TSELORA_COLLECTOR_URL=http://127.0.0.1:8000 python examples/simple_agent.py
"""

from __future__ import annotations

import os

from tselora import (
    CollectorTransport,
    DEFAULT_COLLECTOR_URL,
    EventBatcher,
    EventEmitter,
    configure_emitter,
    run,
    tool,
)


def _collector_url() -> str:
    return (
        os.environ.get("TSELORA_COLLECTOR_URL")
        or os.environ.get("TSELOA_COLLECTOR_URL")
        or DEFAULT_COLLECTOR_URL
    )


@tool(name="search_web")
def search_web(query: str) -> str:
    return f"results for {query}"


def main() -> None:
    configure_emitter(EventEmitter(EventBatcher(CollectorTransport(_collector_url()))))
    with run() as run_id:
        print(f"run_id={run_id}")
        print(search_web("Tselora"))
        print(f"explorer: http://127.0.0.1:5173/runs/{run_id}")


if __name__ == "__main__":
    main()
