# sdk

Python SDK for emitting Universal Agent Event Protocol events.

Planned (Week 2): `emitter.py`, `batcher.py`, `transport.py`, `decorators.py`, `context.py`.

Assign `event_id` and per-run `sequence` at emit time. Transport is async and at-least-once; retries must reuse the same `event_id`.
