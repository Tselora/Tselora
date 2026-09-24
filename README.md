# Tselora

[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)
[![Python 3.12+](https://img.shields.io/badge/python-3.12%2B-blue.svg)](https://pypi.org/project/tselora/)
[![PyPI](https://img.shields.io/pypi/v/tselora.svg)](https://pypi.org/project/tselora/)

**The execution shadow for intelligent systems.**

Tselora records what an existing agent actually did as structured events, then reconstructs the execution graph, timeline, node state, and causal links. It is **not** an agent framework or orchestrator. It sits beside agents you already run.

Install the SDK from PyPI. This repository holds usage examples and the demo GIF. The implementation source is private.

**Python package:** `tselora` **0.1.4** (`pip install tselora`).

## Install

Python **3.12+**.

```bash
pip install tselora
# optional extras:
pip install "tselora[otel]"
pip install "tselora[langgraph]"
pip install "tselora[openai-agents]"
pip install "tselora[crewai]"
```

The wheel ships `core`, `sdk`, `server`, `adapters`, and the `tselora` CLI (`tselora serve`).

## Quickstart

Terminal 1 — local collector (JSONL under `.agent-devtools/` unless `--data-dir` or `TSELOA_DATA_DIR`):

```bash
tselora serve
```

Terminal 2 — example from this repository (examples are **not** in the wheel):

```bash
git clone https://github.com/Tselora/Tselora.git
cd Tselora
TSELOA_COLLECTOR_URL=http://127.0.0.1:8000 python examples/simple_agent.py
```

Copy the printed `run_id`. Richer graph (retry / loop / fan-out): `python examples/structured_execution.py`.

Optional first-slice adapters: `examples/otel_spans.py`, `examples/langgraph_stategraph.py`, `examples/openai_agents_runner.py`, `examples/crewai_kickoff.py` (install the matching extra first).

![Live one-run viewer: execution graph, run status, node list, and timeline](https://raw.githubusercontent.com/Tselora/Tselora/main/docs/assets/tselora-demo.gif)

## What Tselora is not

- Not an agent framework, planner, or orchestrator
- Not a replacement for LangGraph, CrewAI, OpenAI Agents SDK, Google ADK, etc.
- Not a chain-of-thought recorder
- Not a cloud control plane or production auth system in v1

## License

[Apache License 2.0](LICENSE)
