# Getting started

Tselora is in the **architecture / scaffolding** phase. There is no runnable collector or UI yet. This page is how a contributor orients and prepares a machine for Week 1 implementation.

## Prerequisites

- Git
- Python **3.12+** (3.13 is fine)
- Node.js 20+ when UI work starts (Week 3)
- A virtualenv tool (`python -m venv`)

## Clone and install (when code exists)

```bash
git clone <repository-url>
cd Tselora
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -e ".[dev]"
```

Runtime dependencies (Pydantic, FastAPI, Typer, etc.) will be added when implementation starts. `pyproject.toml` currently lists **dev** extras only.

## Layout to read first

1. [README.md](../../README.md)
2. [docs/product/vision.md](../product/vision.md) and [v1.md](../product/v1.md)
3. [docs/architecture/overview.md](../architecture/overview.md)
4. [docs/development/development-guide.md](development-guide.md)
5. ADRs in [docs/adr/](../adr/)

## Local runtime data

When the collector exists, it will write:

```text
.agent-devtools/runs/run_<id>/events.jsonl
```

This directory is gitignored. Do not commit logs.

## Running tests

```bash
pytest
```

No tests are implemented yet; Week 1 adds schema, store, and context tests.

## UI (future)

The React app will live in `ui/` (TypeScript, React Flow, WebSockets). Scaffolding is a README only until Week 3.

## Rules of the road

See the ten development rules in [development-guide.md](development-guide.md). In short: protocol is sacred, log is truth, UI is not, no database in v1, no CoT harvesting.
