"""OpenAI Agents SDK Runner → Tselora RunHooks → collector JSONL.

Requires: pip install -e ".[openai-agents]"

First-slice shape only: one Agent, Runner.run_sync, ScriptedModel (no API key).
Attach ``TseloraAgentsRunHooks`` via ``hooks=``. This is not zero-config.

Terminal 1 — collector:
    tselora serve

Terminal 2 — this example:
    TSELOA_COLLECTOR_URL=http://127.0.0.1:8000 python examples/openai_agents_runner.py

Terminal 3 — one-run viewer:
    cd ui && npm run dev
    open http://127.0.0.1:5173/runs/{run_id}
"""

from __future__ import annotations

import os

from agents import Agent, Runner
from agents.run import RunConfig
from agents.testing import ScriptedModel, assistant_message

from adapters.openai_agents.hooks import TseloraAgentsRunHooks
from core.events.ids import new_run_id
from sdk.batcher import EventBatcher
from sdk.emitter import EventEmitter
from sdk.transport import DEFAULT_COLLECTOR_URL, CollectorTransport


def main() -> None:
    base = os.environ.get("TSELOA_COLLECTOR_URL", DEFAULT_COLLECTOR_URL)
    emitter = EventEmitter(EventBatcher(CollectorTransport(base_url=base)))
    run_id = new_run_id()
    hooks = TseloraAgentsRunHooks(emitter, run_id=run_id)
    model = ScriptedModel()
    model.enqueue([assistant_message("hello from a scripted model")])
    agent = Agent(name="Solo", model=model, instructions="Say hello.")
    Runner.run_sync(
        agent,
        "hello",
        hooks=hooks,
        run_config=RunConfig(tracing_disabled=True),
    )
    emitter.flush()
    emitter.close()
    print(f"run_id={run_id}")
    print(f"Viewer: http://127.0.0.1:5173/runs/{run_id}")


if __name__ == "__main__":
    main()
