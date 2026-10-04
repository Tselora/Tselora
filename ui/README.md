# Explorer

Vite + React app. It loads `ProjectionState` over REST and applies collector WebSocket patches. It does not reconstruct execution semantics from raw events.

## Run

Collector on port 8000:

```bash
pip install tselora
tselora serve
```

Explorer:

```bash
cd ui
npm install
npm run dev
```

Open `http://127.0.0.1:5173/runs/{run_id}` (the URL loads the run; `/` lists recent runs). Why? fills when a node payload has allowlisted keys (canonical example: **research**).

`/compare` and `/learn` are in the same app (Learn = exact Experience fingerprint query). Vite proxies `/v1` (including WebSocket) to `TSELOA_COLLECTOR_URL` or `http://127.0.0.1:8000`.

```bash
TSELOA_COLLECTOR_URL=http://127.0.0.1:8051 npm run dev
```

## Tests / build

```bash
npm test
npm run build
```

Explorer is **not** inside the PyPI wheel. The collector remains `tselora serve`.
