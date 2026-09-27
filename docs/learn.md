# Learn (exact structure cohorts)

Learn v0 is a read-only query over Experiences:

```bash
curl -sS -X POST http://127.0.0.1:8000/v1/experiences/query \
  -H 'Content-Type: application/json' \
  -d '{"structure_fingerprint":"sha256:<hex>","limit":100}'
```

Matching is **exact** on `structure_fingerprint` (and any other filters you send). Order is server-defined and deterministic. There is no embedding index, semantic similarity, ranking, or automatic optimization.
