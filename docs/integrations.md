# Integrations

Install extras from PyPI. Each adapter **translates** framework activity into Tselora `run.*` / `node.*` events **before** ingest. Framework objects do not become the core model. Tselora owns `event_id` and per-run `sequence`. Adapters are **lossy** and **not zero-config**: you construct the handler/processor/listener and attach it.

`pip install tselora` **0.1.16** exposes `from tselora import run, tool`. `sdk`, `adapters`, and `core` remain top-level compatibility aliases (`from tselora.adapters…` is the same adapters package).

| Extra | Entry point | Example |
| --- | --- | --- |
| (none) | `sdk.run`, `@tool`, `@node`, `@agent`, `@llm` | `examples/research_retry.py`, `examples/simple_agent.py` |
| `tselora[otel]` | `TseloraSpanProcessor` | `examples/otel_spans.py` |
| `tselora[langgraph]` | `TseloraLangGraphCallbackHandler` | `examples/langgraph_stategraph.py` |
| `tselora[openai-agents]` | `TseloraAgentsRunHooks` | `examples/openai_agents_runner.py` |
| `tselora[crewai]` | `TseloraCrewAIEventListener` | `examples/crewai_kickoff.py` |

```bash
pip install "tselora[langgraph]"
```

## What every first-slice adapter does

- Maps observed lifecycle onto existing protocol types (`run.started` / `run.completed` / `run.failed` and `node.started` / `node.completed` / `node.failed`).
- Allocates Tselora `run_id` and `execution_instance_id` values.
- Sends `AgentEvent` JSON to `POST /v1/events`. Collector, SQLite EventStore, ProjectionEngine, REST, WebSocket, and Explorer never import the framework.

## What they do not do

- They do **not** emit `tool.*`, `llm.*`, `plan.*`, `retry.*`, or `loop.*` from framework kinds or vendor attributes.
- They **do** copy **allowlisted Why? keys** onto `node.completed` / `node.failed` when those keys are already present on LangGraph node outputs or metadata, OTEL span attributes, OpenAI Agents run `context`, or CrewAI kickoff `inputs` (including nested `tselora.why`). Failures also set coarse `failure_category` (`timeout` / `error`). Prompts, completions, and other fields are dropped. This is still lossy: adapters do not invent hidden reasoning.
- They do **not** rewrite your graph, crew, or runner. Attaching the adapter is required.
- They do **not** replace OpenTelemetry or vendor APM.

## First-slice observation boundary

- **OTEL:** `SpanProcessor` `on_start` / `on_end`. Root span → `run.*`; child span → `node.*`. Span kind and `gen_ai.*` attributes are not promoted to other event types. Allowlisted Why? keys on span attributes are copied onto node payloads; prompts are not.
- **LangGraph:** callbacks on a compiled `StateGraph` (`config["callbacks"]` / `with_config`). `invoke` / `stream` first slice. LLM callbacks are ignored (`ignore_llm`). Not subgraph/Send/async as a separate mapping. Node functions are not rewritten. Dict node outputs may contribute Why? keys.
- **OpenAI Agents SDK:** `RunHooks` on `Runner.run` / `run_sync`. First slice is a single agent. The example uses `ScriptedModel` and `tracing_disabled=True` (no API key). Why? keys may come from run `context`.
- **CrewAI:** `BaseEventListener` on the process event bus. First slice is sequential `kickoff()`, one crew / one agent / one task. The example uses a scripted `BaseLLM` (no API key). Why? keys may come from kickoff `inputs`.

Google ADK and other stacks are not claimed.

After a `run_id` prints, open `http://127.0.0.1:5173/runs/<run_id>` (Explorer) or `GET /v1/runs/<run_id>`.
