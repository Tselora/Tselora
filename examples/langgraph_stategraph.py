"""LangGraph StateGraph → Tselora callback handler → collector JSONL.

Requires: pip install -e ".[langgraph]"

First-slice shape only: compiled StateGraph START → research → END.
Attach ``TseloraLangGraphCallbackHandler`` via ``with_config`` / callbacks.
This is not zero-config; node functions are not rewritten.

Terminal 1 — collector:
    tselora serve

Terminal 2 — this example:
    TSELOA_COLLECTOR_URL=http://127.0.0.1:8000 python examples/langgraph_stategraph.py

Terminal 3 — one-run viewer (visualization replay over projected sequence):
    cd ui && npm run dev
    open http://127.0.0.1:5173/runs/{run_id}
"""

from __future__ import annotations

import os

from langgraph.graph import END, START, StateGraph
from typing_extensions import TypedDict

from adapters.langgraph.handler import TseloraLangGraphCallbackHandler
from core.events.ids import new_run_id
from sdk.batcher import EventBatcher
from sdk.emitter import EventEmitter
from sdk.transport import DEFAULT_COLLECTOR_URL, CollectorTransport


class State(TypedDict):
    topic: str


def research(state: State) -> State:
    return {"topic": state["topic"]}


def main() -> None:
    base = os.environ.get("TSELOA_COLLECTOR_URL", DEFAULT_COLLECTOR_URL)
    emitter = EventEmitter(EventBatcher(CollectorTransport(base_url=base)))
    handler = TseloraLangGraphCallbackHandler(emitter)
    graph = (
        StateGraph(State)
        .add_node("research", research)
        .add_edge(START, "research")
        .add_edge("research", END)
        .compile()
        .with_config({"callbacks": [handler]})
    )
    run_id = new_run_id()
    graph.invoke({"topic": "ice cream"}, config={"metadata": {"tselora.run_id": run_id}})
    emitter.flush()
    emitter.close()
    print(f"run_id={run_id}")
    print(f"Viewer: http://127.0.0.1:5173/runs/{run_id}")


if __name__ == "__main__":
    main()
