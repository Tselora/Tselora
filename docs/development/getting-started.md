# Getting started

Tselora is in early implementation. Week 1 step 1 is a vertical slice: `@tool` → HTTP collector → JSONL. There is no ProjectionEngine or UI yet.

## Prerequisites

- Git
- Python **3.12+** (3.13 is fine)
- Node.js 20+ when UI work starts (Week 3)
- A virtualenv tool (`python -m venv`)

## Clone and install (when code exists)

```bash
git clone <repository-url>
cd Tselora
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -e ".[dev]"
```

## Run the collector and example (Week 1 slice)

```bash
pip install -e ".[dev]"

# Terminal 1 — collector (JSONL under .agent-devtools/)
TSELOA_DATA_DIR=.agent-devtools uvicorn server.collector.app:app --host 127.0.0.1 --port 8000

# Terminal 2 — instrumented function
TSELOA_COLLECTOR_URL=http://127.0.0.1:8000 python examples/simple_agent.py
```

Events are appended to `.agent-devtools/runs/<run_id>/events.jsonl`. The CLI (`tselora server`) is not implemented yet.

## Layout to read first

1. [README.md](../../README.md)
2. [docs/product/vision.md](../product/vision.md) and [v1.md](../product/v1.md)
3. [docs/architecture/overview.md](../architecture/overview.md)
4. [docs/development/development-guide.md](development-guide.md)
5. ADRs in [docs/adr/](../adr/)

## Local runtime data

When the collector exists, it will write:

```text
.agent-devtools/runs/run_<id>/events.jsonl
```

This directory is gitignored. Do not commit logs.

## Running tests

```bash
pytest
```

Week 1 step 1 tests cover the event envelope, IDs, sequence, context, decorator, JSONL, collector, and an end-to-end example.

## UI (future)

The React app will live in `ui/` (TypeScript, React Flow, WebSockets). Scaffolding is a README only until Week 3.

## Rules of the road

See the ten development rules in [development-guide.md](development-guide.md). In short: protocol is sacred, log is truth, UI is not, no database in v1, no CoT harvesting.
