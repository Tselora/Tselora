"""CrewAI kickoff → Tselora event-bus listener → collector SQLite.

Requires: pip install "tselora[crewai]"

First-slice shape only: sequential Crew, one Agent, one Task, custom BaseLLM (no API key).
Construct and retain ``TseloraCrewAIEventListener``. This is not zero-config.

Terminal 1 — collector:
    tselora serve

Terminal 2 — this example:
    TSELORA_COLLECTOR_URL=http://127.0.0.1:8000 python examples/crewai_kickoff.py

Inspect the run in Explorer (`http://127.0.0.1:5173/runs/{run_id}`) or:
    curl -sS http://127.0.0.1:8000/v1/runs/{run_id}

Maps to run.* / node.*. Kickoff inputs may include nested tselora.why (allowlisted keys only).
"""

from __future__ import annotations

import os

from crewai import Agent, Crew, Process, Task
from crewai.llms.base_llm import BaseLLM

from tselora import (
    CollectorTransport,
    DEFAULT_COLLECTOR_URL,
    EventBatcher,
    EventEmitter,
    new_run_id,
)
from tselora.adapters.crewai.listener import TseloraCrewAIEventListener


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
    base = (
        os.environ.get("TSELORA_COLLECTOR_URL")
        or os.environ.get("TSELOA_COLLECTOR_URL")
        or DEFAULT_COLLECTOR_URL
    )
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
    crew.kickoff(
        inputs={
            "tselora.why": {
                "decision": "answer",
                "selected_strategy": "scripted",
                "action": "complete_task",
            }
        }
    )
    emitter.flush()
    emitter.close()
    _ = listener
    print(f"run_id={run_id}")
    print(f"explorer: http://127.0.0.1:5173/runs/{run_id}")


if __name__ == "__main__":
    main()
