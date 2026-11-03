# Quick start

Python **3.12+**, Node.js **20+**. Package: [`tselora`](https://pypi.org/project/tselora/) **0.1.16**.

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
TSELORA_COLLECTOR_URL=http://127.0.0.1:8000 python examples/research_retry.py
```

Open `http://127.0.0.1:5173/runs/<run_id>` (Why? auto-selects **research** when it is the only Why? instance). Run twice, then Compare, Learn, and Near-miss on the same origin. Equal Compare fields are a valid result. The retry in `research_retry.py` is a derived near-miss on `search_web`.

The collector writes SQLite under `.agent-devtools/tselora.sqlite` unless you pass `--data-dir` or `TSELORA_DATA_DIR`. `tselora import-jsonl` copies an older `runs/<run_id>/events.jsonl` tree into that database and leaves the JSONL files in place. The legacy names `TSELOA_COLLECTOR_URL` and `TSELOA_DATA_DIR` are still accepted.

`pip install tselora` then `from tselora import run, tool` (`from sdk import …` still works). See the README Imports section.

See [examples/README.md](../examples/README.md) and [ui/README.md](../ui/README.md).
