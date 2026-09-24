"""CrewAI kickoff → Tselora event-bus listener → collector JSONL.

Requires: pip install -e ".[crewai]"

First-slice shape only: sequential Crew, one Agent, one Task, custom BaseLLM (no API key).
Construct and retain ``TseloraCrewAIEventListener``. This is not zero-config.

Terminal 1 — collector:
    tselora serve

Terminal 2 — this example:
    TSELOA_COLLECTOR_URL=http://127.0.0.1:8000 python examples/crewai_kickoff.py

Terminal 3 — one-run viewer:
    cd ui && npm run dev
    open http://127.0.0.1:5173/runs/{run_id}
"""

from __future__ import annotations

import os

from crewai import Agent, Crew, Process, Task
from crewai.llms.base_llm import BaseLLM

from adapters.crewai.listener import TseloraCrewAIEventListener
from core.events.ids import new_run_id
from sdk.batcher import EventBatcher
from sdk.emitter import EventEmitter
from sdk.transport import DEFAULT_COLLECTOR_URL, CollectorTransport


class ScriptedLLM(BaseLLM):
    def __init__(self) -> None:
        super().__init__(model="scripted")

    def call(self, messages, tools=None, callbacks=None, available_functions=None, **kwargs):
        return "hello from a scripted crew"

    def supports_function_calling(self) -> bool:
        return False


def main() -> None:
    os.environ.pop("OPENAI_API_KEY", None)
    os.environ.setdefault("CREWAI_DISABLE_TELEMETRY", "true")
    base = os.environ.get("TSELOA_COLLECTOR_URL", DEFAULT_COLLECTOR_URL)
    emitter = EventEmitter(EventBatcher(CollectorTransport(base_url=base)))
    run_id = new_run_id()
    listener = TseloraCrewAIEventListener(emitter, run_id=run_id)
    researcher = Agent(
        role="Researcher",
        goal="Answer briefly",
        backstory="A careful researcher.",
        llm=ScriptedLLM(),
        verbose=False,
        allow_delegation=False,
    )
    task = Task(
        description="Say hello in one word.",
        expected_output="A single word.",
        agent=researcher,
    )
    crew = Crew(
        agents=[researcher],
        tasks=[task],
        process=Process.sequential,
        verbose=False,
    )
    crew.kickoff()
    emitter.flush()
    emitter.close()
    _ = listener
    print(f"run_id={run_id}")
    print(f"Viewer: http://127.0.0.1:5173/runs/{run_id}")


if __name__ == "__main__":
    main()
