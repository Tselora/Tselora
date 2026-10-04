# Quick start

Python **3.12+**, Node.js **20+**. Package: [`tselora`](https://pypi.org/project/tselora/) **0.1.15**.

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

Open `http://127.0.0.1:5173/runs/<run_id>` (Why? auto-selects **research** when it is the only Why? instance). Run twice, then Compare and Learn on the same origin. Equal Compare fields are a valid result.

The collector writes SQLite under `.agent-devtools/tselora.sqlite` unless you pass `--data-dir` or `TSELOA_DATA_DIR`. `tselora import-jsonl` copies an older `runs/<run_id>/events.jsonl` tree into that database and leaves the JSONL files in place.

`pip install tselora` then `from sdk import …` (not `import tselora`). See the README Imports section.

See [examples/README.md](../examples/README.md) and [ui/README.md](../ui/README.md).
