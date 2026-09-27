# Tselora

[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)
[![Python 3.12+](https://img.shields.io/badge/python-3.12%2B-blue.svg)](https://pypi.org/project/tselora/)
[![PyPI](https://img.shields.io/pypi/v/tselora.svg)](https://pypi.org/project/tselora/)

**Open-source execution intelligence for AI agents.**

Tselora reconstructs AI-agent executions into a deterministic execution model so you can observe what happened, inspect structured decisions, apply cooperative runtime control, preserve execution experiences, record reproduction lineage, compare runs, interpret observable differences, and retrieve historical executions that share the same structure.

It is **not** an agent framework or orchestrator. It sits beside agents you already run.

**Python package:** [`tselora`](https://pypi.org/project/tselora/) **0.1.13**. Implementation source is distributed on PyPI; this repository holds usage examples, Explorer, and the demo GIF.

![Tselora product demo: agent execution, reconstructed topology and structured decisions, Experience, deterministic comparison, and exact-structure historical cohort](https://raw.githubusercontent.com/Tselora/Tselora/main/docs/assets/tselora-demo.gif)

*The GIF shows the full flow: an agent executes, Tselora reconstructs the execution topology and structured decisions, turns the run into a reusable Experience, compares executions deterministically, and retrieves a historical cohort sharing the same structure fingerprint.*

## Why Tselora

Traditional tracing primarily answers:

> What happened during this execution?

Tselora is designed to additionally answer:

- What was the **execution structure**?
- What **structured decisions** were recorded?
- What execution state can be **preserved** as Experience?
- How can this execution be **related or reproduced** (lineage, not process snapshots)?
- What **changed** between two reconstructed executions?
- Which previous executions have the **same structure**?

Tselora does **not** replace OpenTelemetry or vendor tracing. It is an execution-intelligence layer that can consume events from multiple agent stacks. It does not capture hidden model reasoning or chain-of-thought.

## Capability model

```text
Observe → Explain → Control → Remember → Reproduce → Compare → Interpret → Learn
```

| Stage | What it means today |
| --- | --- |
| **Observe** | Record protocol events and project them into graph, timeline, and node/run state. |
| **Explain** | Show structured Why? fields the execution actually emitted (`trigger`, `decision`, …). |
| **Control** | Cooperative pause/resume/cancel-style intents; the application must honor them. |
| **Remember** | Derive an Execution Experience from a **terminal** run. |
| **Reproduce** | Record checkpoints and parent/child fork lineage; the app owns restore. |
| **Compare** | Deterministically compare two reconstructed executions (no winner/loser). |
| **Interpret** | Present observable differences in Explorer (and via comparison REST). |
| **Learn** | Retrieve Experiences with the same exact `structure_fingerprint`. |

Learn v0 is exact-match and read-only. It does **not** use embeddings, vector similarity, ranking, or autonomous optimization.

## Architecture

```text
Agent / framework
        ↓
Execution events (Universal Agent Event Protocol)
        ↓
Local collector → JSONL EventStore
        ↓
ProjectionEngine
        ↓
Execution state / topology
        ↓
Experience / reproduction lineage / comparison / Learn query
        ↓
REST + WebSocket + Explorer (`ui/`)
```

- The **event log** is authoritative.
- **ProjectionEngine** is the semantic interpreter (the client does not invent graph semantics).
- **Experience** is derived from terminal projected state; it is not a second event log.
- **Comparison** rebuilds both runs and diffs projected state (plus optional Experience).
- **Learn** uses `POST /v1/experiences/query` with an exact `structure_fingerprint`.

## Supported integrations

Verified extras on `tselora` 0.1.13. Adapters are first-slice and **lossy**; they are not zero-config.

| Integration | Extra | Status |
| --- | --- | --- |
| Raw Python (`run`, `@agent` / `@node` / `@tool` / `@llm`) | (core) | Supported |
| OpenTelemetry | `tselora[otel]` | Supported (first slice) |
| LangGraph | `tselora[langgraph]` | Supported (first slice) |
| OpenAI Agents SDK | `tselora[openai-agents]` | Supported (first slice) |
| CrewAI | `tselora[crewai]` | Supported (first slice) |

Google ADK and other stacks are not claimed here.

## Quick start

Python **3.12+**, Node.js **20+**. Package: [`tselora`](https://pypi.org/project/tselora/) **0.1.13**.

```bash
git clone https://github.com/Tselora/Tselora.git
cd Tselora
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install tselora
```

Terminal 1 — collector (`http://127.0.0.1:8000`):

```bash
tselora serve
```

Terminal 2 — Explorer (`http://127.0.0.1:5173`):

```bash
cd ui
npm install
npm run dev
```

Terminal 3 — example:

```bash
TSELOA_COLLECTOR_URL=http://127.0.0.1:8000 python examples/simple_agent.py
```

Copy the printed `run_id`, then:

1. Open `http://127.0.0.1:5173/runs/<run_id>` — graph, timeline, node inspector.
2. Compare: `http://127.0.0.1:5173/compare?left_run_id=<run_id>&right_run_id=<other_run_id>` (run the example twice).
3. Learn: `http://127.0.0.1:5173/learn?run_id=<run_id>` (exact `structure_fingerprint` cohorts).

`simple_agent.py` is the smoke test. For retry / loop / fan-out topology use `examples/structured_execution.py`. Neither example emits structured Why? fields; Experience still appears for terminal runs.

Collector flags: `tselora serve --host 127.0.0.1 --port 8000 --data-dir .agent-devtools`.

Optional adapters (install the extra first): `examples/otel_spans.py`, `examples/langgraph_stategraph.py`, `examples/openai_agents_runner.py`, `examples/crewai_kickoff.py`.

## Example

```python
from sdk import run, tool


@tool(name="search_web")
def search_web(query: str) -> str:
    return f"results for {query}"


with run() as run_id:
    search_web("Tselora")
    print(run_id)
```

More examples: [examples/README.md](examples/README.md).

## Explorer

This repository’s `ui/` app is Explorer. The PyPI wheel does **not** bundle it; `tselora serve` is collector-only.

Vite listens on **5173** and proxies `/v1` (including WebSocket) to `TSELOA_COLLECTOR_URL` or `http://127.0.0.1:8000`. See [ui/README.md](ui/README.md).

REST remains available for the same collector:

| Need | Endpoint |
| --- | --- |
| Full projected run | `GET /v1/runs/{run_id}` |
| Graph / timeline | `GET /v1/runs/{run_id}/graph`, `.../timeline` |
| Events | `GET /v1/runs/{run_id}/events` |
| Experience | `GET /v1/experiences/exp_{run_id}` |
| Learn (exact structure) | `POST /v1/experiences/query` |
| Compare two runs | `POST /v1/comparisons` |
| Live patches | WebSocket on the collector (see `tselora serve` / package `server.ws`) |

Health: `http://127.0.0.1:8000/health`.

## Execution Experience

An Execution Experience is a deterministic, privacy-bounded document derived when a run reaches a **terminal** status (`completed`, `failed`, or `cancelled`).

It is **not** a second event log, a prompt archive, chain-of-thought storage, or an optimizer.

## Reproduction

Tselora can record `checkpoint.created` and fork lineage (`parent_run_id` / `child_run_id`). The **application** owns restoration. Tselora does not snapshot or resume arbitrary process or interpreter state.

## Comparison

`POST /v1/comparisons` with `left_run_id` and `right_run_id` rebuilds both executions and reports observable differences (outcome, structured Why?, topology, counts/timing, controls, lineage, optional Experience). It does not label a better or worse run.

## Learn

Learn v0 retrieves historical Experiences that share the exact same `structure_fingerprint` (`POST /v1/experiences/query`). Results are deterministic, exact-match, read-only, and preserve server order. No embeddings, semantic similarity, ranking, recommendations, or automatic optimization.

## Implemented vs deferred

**In `tselora` 0.1.13**

- Event protocol, local collector, JSONL EventStore
- ProjectionEngine, REST, WebSocket patches
- Structured Why? keys, cooperative control APIs
- Experience extract/query, comparison, checkpoint/fork helpers
- First-slice adapters: OTEL, LangGraph, OpenAI Agents SDK, CrewAI

**Intentionally deferred**

- Autonomous optimization / “Learn how to improve the agent”
- Embeddings or vector similarity
- Hosted/cloud Tselora, authentication, multi-tenancy
- Generic re-execution of arbitrary agents
- Zero-config / zero-touch framework integration
- Replacing OpenTelemetry or vendor APM

## Documentation

- [Quick start](docs/quickstart.md)
- [Explorer](ui/README.md)
- [Architecture](docs/architecture.md)
- [Integrations](docs/integrations.md)
- [Experience](docs/experience.md)
- [Reproduction](docs/reproduction.md)
- [Comparison](docs/comparison.md)
- [Learn](docs/learn.md)
- [Runtime control](docs/runtime-control.md)
- [Contributing](CONTRIBUTING.md)

## License

[Apache License 2.0](LICENSE)
