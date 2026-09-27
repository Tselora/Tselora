# Execution Experience

An Experience is a compact, deterministic record derived from a **terminal** execution (`completed`, `failed`, or `cancelled`). It includes structure (logical node ids, fingerprint), counts, allowlisted Why? fields, and coarse control flags—not raw prompts or hidden reasoning.

```bash
curl -sS "http://127.0.0.1:8000/v1/experiences/exp_<run_id>"
```

It is not a second event log, a transcript archive, or an optimizer. The JSONL event log remains the source of truth.
