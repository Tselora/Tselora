# Quick start

Python **3.12+**, Node.js **20+**. Package: [`tselora`](https://pypi.org/project/tselora/) **0.1.13**.

Same workflow as the [README](../README.md#quick-start):

```bash
git clone https://github.com/Tselora/Tselora.git
cd Tselora
python -m venv .venv
source .venv/bin/activate
pip install tselora
```

```bash
# Terminal 1
tselora serve

# Terminal 2
cd ui && npm install && npm run dev

# Terminal 3
TSELOA_COLLECTOR_URL=http://127.0.0.1:8000 python examples/simple_agent.py
```

Open `http://127.0.0.1:5173/runs/<run_id>`. Compare and Learn are `/compare` and `/learn` on the same origin.

Events are stored under `.agent-devtools/runs/<run_id>/events.jsonl` unless the collector is started with `--data-dir` or `TSELOA_DATA_DIR`.

See [examples/README.md](../examples/README.md) and [ui/README.md](../ui/README.md).
