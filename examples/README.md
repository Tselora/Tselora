# examples

Requires `pip install tselora` and a running collector (`tselora serve`).

- `research_retry.py` — canonical quickstart: `research` → plan, failed then retried `search_web`, gather, plus structured Why? on `research`.
- `simple_agent.py` — one decorated tool (minimal smoke).
- `structured_execution.py` — sequential nodes, retry, loop, sibling fan-out, and a failed-then-retried tool using ordinary Python control flow.
- `otel_spans.py` — OpenTelemetry tracer via `TseloraSpanProcessor` (`pip install "tselora[otel]"`).
- `langgraph_stategraph.py` — compiled `StateGraph` via `TseloraLangGraphCallbackHandler` (`pip install "tselora[langgraph]"`). First slice only.
- `openai_agents_runner.py` — `Runner.run_sync` + scripted model via `TseloraAgentsRunHooks` (`pip install "tselora[openai-agents]"`). First slice only.
- `crewai_kickoff.py` — sequential one-task `Crew.kickoff()` via `TseloraCrewAIEventListener` (`pip install "tselora[crewai]"`). First slice only.

```bash
tselora serve
TSELOA_COLLECTOR_URL=http://127.0.0.1:8000 python examples/research_retry.py
```

Then open `http://127.0.0.1:5173/runs/<run_id>` (Explorer: `cd ui && npm install && npm run dev`) or `GET http://127.0.0.1:8000/v1/runs/<run_id>`.
