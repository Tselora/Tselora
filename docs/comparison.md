# Deterministic comparison

```bash
curl -sS -X POST http://127.0.0.1:8000/v1/comparisons \
  -H 'Content-Type: application/json' \
  -d '{"left_run_id":"run_a","right_run_id":"run_b"}'
```

Both runs are rebuilt through ProjectionEngine and compared. Optional Experience documents are attached when present.

The result describes **observable differences**. It does not name a better run, winner, or recommendation.
