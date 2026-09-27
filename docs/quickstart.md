# Quick start

Python **3.12+**. Package: [`tselora`](https://pypi.org/project/tselora/) **0.1.13**.

```bash
python -m venv .venv
source .venv/bin/activate
pip install tselora

# Terminal 1
tselora serve

# Terminal 2
git clone https://github.com/Tselora/Tselora.git
cd Tselora
TSELOA_COLLECTOR_URL=http://127.0.0.1:8000 python examples/simple_agent.py
```

Inspect the run (replace the id printed by the example):

```bash
curl -sS "http://127.0.0.1:8000/health"
curl -sS "http://127.0.0.1:8000/v1/runs/<run_id>"
```

Events are stored under `.agent-devtools/runs/<run_id>/events.jsonl` unless you pass `--data-dir` or set `TSELOA_DATA_DIR`.

See also [examples/README.md](../examples/README.md).
