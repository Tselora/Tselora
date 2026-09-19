# server/api

REST for initial load, full state, reconnect, historical data.

Implemented: `runs.py` (`GET /v1/runs/{run_id}` rebuilds from JSONL via ProjectionEngine). Live updates are WebSocket **patches** (`server/ws.py`), not this package duplicating projection.
