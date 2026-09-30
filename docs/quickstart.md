# Quick start

Python **3.12+**, Node.js **20+**. Package: [`tselora`](https://pypi.org/project/tselora/) **0.1.14**.

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
TSELOA_COLLECTOR_URL=http://127.0.0.1:8000 python examples/research_retry.py
```

Open `http://127.0.0.1:5173/runs/<run_id>`, select **research** for Why?. Run twice, then `/compare?left_run_id=…&right_run_id=…` and `/learn?run_id=…`.

Events are stored in `.agent-devtools/tselora.sqlite` unless the collector is started with `--data-dir` or `TSELOA_DATA_DIR`. `tselora import-jsonl` copies an older `runs/<run_id>/events.jsonl` tree into that database and leaves the JSONL files in place.

See [examples/README.md](../examples/README.md) and [ui/README.md](../ui/README.md).
