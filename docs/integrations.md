# Integrations

Install extras from PyPI. Each adapter **translates** framework activity into Tselora events. Framework objects do not become the core model.

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

First-slice limits (do not assume full framework coverage):

- **LangGraph:** compiled `StateGraph` via callbacks; not subgraph/Send/stream ingestion.
- **OpenAI Agents SDK:** `Runner` + hooks; examples use a scripted model (no API key).
- **CrewAI:** sequential kickoff via the event bus; examples use a scripted LLM.
- **OTEL:** span processor mapping; lossy vs Tselora node instances.

Attaching a handler is required. This is not zero-touch instrumentation.
