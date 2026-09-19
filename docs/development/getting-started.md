# Getting started

Tselora is a local execution shadow: instrumented Python → collector → JSONL → ProjectionEngine → REST / WebSocket → one-run UI.

## Prerequisites

- Git
- Python **3.12+** (3.13 is fine)
- Node.js 20+ for the UI
- A virtualenv tool (`python -m venv`)

## Clone and install

```bash
git clone https://github.com/Tselora/Tselora.git
cd Tselora
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -e ".[dev]"
```

## Run the collector and example

```bash
# Terminal 1 — collector (JSONL under .agent-devtools/)
TSELOA_DATA_DIR=.agent-devtools uvicorn server.collector.app:app --host 127.0.0.1 --port 8000

# Terminal 2 — instrumented function
TSELOA_COLLECTOR_URL=http://127.0.0.1:8000 python examples/simple_agent.py
```

Events are appended to `.agent-devtools/runs/<run_id>/events.jsonl`. The SDK queues events and retries HTTP on collector outage, reusing the same `event_id`. The CLI (`tselora server`) is not implemented yet.

Projected state is available at `GET /v1/runs/{run_id}` and live patches at `WS /v1/runs/{run_id}/ws`.

## Run the UI

```bash
cd ui
npm install
npm run dev
```

Vite listens on `http://127.0.0.1:5173` and proxies `/v1` to the collector. Open:

```text
http://127.0.0.1:5173/runs/{run_id}
```

`run_id` is in the example output and under `.agent-devtools/runs/`. Details: [ui/README.md](../../ui/README.md).

## Layout to read first

1. [README.md](../../README.md)
2. [docs/product/vision.md](../product/vision.md) and [v1.md](../product/v1.md)
3. [docs/architecture/overview.md](../architecture/overview.md)
4. [docs/development/development-guide.md](development-guide.md)
5. ADRs in [docs/adr/](../adr/)

## Local runtime data

The collector writes:

```text
.agent-devtools/runs/run_<id>/events.jsonl
```

This directory is gitignored. Do not commit logs.

## Running tests

```bash
pytest
cd ui && npm test
```

## Rules of the road

See the ten development rules in [development-guide.md](development-guide.md). In short: protocol is sacred, log is truth, UI is not, no database in v1, no CoT harvesting.
