# Learn (exact structure cohorts)

Learn v0 is a **read-only** query over existing Experience documents. Explorer `/learn?run_id=` loads `GET /v1/experiences/exp_<run_id>` then `POST /v1/experiences/query` with that document’s `structure_fingerprint`. There is no Learn store.

```bash
curl -sS -X POST http://127.0.0.1:8000/v1/experiences/query \
  -H 'Content-Type: application/json' \
  -d '{"structure_fingerprint":"sha256:<hex>","limit":100}'
```

Matching is **exact** on `structure_fingerprint` (and any other filters you send). Order is server-defined and deterministic. There is no embedding index, semantic similarity, ranking, or automatic optimization.
