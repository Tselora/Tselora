# Learn (exact structure cohorts)

Learn v0 is a **read-only** query over existing Experience documents. Explorer `/learn?run_id=` loads `GET /v1/experiences/exp_<run_id>` then `POST /v1/experiences/query` with that document’s `structure_fingerprint`. There is no Learn store.

```bash
curl -sS -X POST http://127.0.0.1:8000/v1/experiences/query \
  -H 'Content-Type: application/json' \
  -d '{"structure_fingerprint":"sha256:<hex>","limit":100}'
```

Matching is **exact** on `structure_fingerprint` (and any other filters you send). Order is server-defined and deterministic. There is no embedding index, semantic similarity, ranking, or automatic optimization.

## Near-miss (derived, 0.1.15)

`GET /v1/near-misses` lists completed runs in which a logical step failed and a later attempt of that same step completed. The collector rebuilds projections and derives the list. There is no near-miss table and no new event type. When an Experience is current, the record may copy `structure_fingerprint` and `experience_id`; those fields are omitted if Experience is missing or stale.

This is not a Learn store and not a reliability-map UI. Explorer has no Near-Miss page in this release.
