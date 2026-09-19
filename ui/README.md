# ui

Minimal one-run live viewer. It bootstraps `ProjectionState` from REST and applies mechanical `StatePatch` messages from the collector WebSocket. It does not interpret `AgentEvent` objects.

## Prerequisites

- Node.js 20+
- Collector running on port **8000** (`GET /v1/runs/{run_id}` and `WS /v1/runs/{run_id}/ws`)

## Install

```bash
cd ui
npm install
```

## Development

```bash
npm run dev
```

Vite listens on `http://127.0.0.1:5173` (IPv4) and proxies `/v1/*` (including WebSocket) to `http://127.0.0.1:8000`.

## Open a run

Navigate to:

```
http://127.0.0.1:5173/runs/{run_id}
```

Or open `/` and submit a `run_id` in the form.

`run_id` comes from recorded agent executions (JSONL / collector ingest). There is no run picker in this slice.

## Tests / build

```bash
npm test
npm run build
```
