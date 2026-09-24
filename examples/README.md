# examples

- `simple_agent.py` — one decorated tool (quickstart).
- `structured_execution.py` — official Week 3 acceptance example: sequential nodes, retry, loop, sequential sibling fan-out, and a failed-then-retried tool. Ordinary Python control flow only; no `retry.started` / `loop.detected`. Prints `run_id` for the one-run viewer.
- `otel_spans.py` — OpenTelemetry tracer through `TseloraSpanProcessor` into the existing collector (optional extra `.[otel]`).
- `langgraph_stategraph.py` — compiled `StateGraph` (`START` → `research` → `END`) through `TseloraLangGraphCallbackHandler` into the existing collector (optional extra `.[langgraph]`). First-slice shape only; prints `run_id` for the one-run viewer.
- `openai_agents_runner.py` — `Runner.run_sync` + `ScriptedModel` through `TseloraAgentsRunHooks` into the existing collector (optional extra `.[openai-agents]`). First-slice shape only; prints `run_id` for the one-run viewer.
- `crewai_kickoff.py` — sequential one-task `Crew.kickoff()` through `TseloraCrewAIEventListener` into the existing collector (optional extra `.[crewai]`). First-slice shape only; prints `run_id` for the one-run viewer.

Collector + example (`pip install tselora`, then this public checkout for scripts):

```bash
tselora serve
TSELOA_COLLECTOR_URL=http://127.0.0.1:8000 python examples/structured_execution.py
```
