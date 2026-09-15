# Contributing to Tselora

Thank you for helping build Tselora. This project is **architecture-first**: protocol and invariants come before features.

## Setup

See [docs/development/getting-started.md](docs/development/getting-started.md).

Summary:

1. Python 3.12+
2. Create a virtualenv and install the project in editable mode with `dev` extras once implementation exists (`pip install -e ".[dev]"`).
3. UI work will use Node in `ui/` (not scaffolded as an app yet).
4. Do not commit `.env`, credentials, or `.agent-devtools/runs/`.

## Architecture-first development

Read before changing code:

- [docs/architecture/overview.md](docs/architecture/overview.md)
- [docs/product/v1.md](docs/product/v1.md)
- [docs/development/development-guide.md](docs/development/development-guide.md)
- Relevant ADRs in [docs/adr/](docs/adr/)

### Documentation conflict rule

When documentation conflicts:

1. Locked ADRs in [`docs/adr/`](docs/adr/) win for **implementation**.
2. [`docs/product/v1.md`](docs/product/v1.md) wins for **v1 scope**.
3. The long-form Architecture & Execution Plan (`docs/Agent_Execution_Intelligence_Architecture_and_Execution_Plan_v0.2_Concrete.docx`) **must be synchronized** rather than left contradictory.

If a change would alter a locked decision, open an ADR **first**. Do not silently change:

- Universal Agent Event Protocol shape
- JSONL as v1 source of truth
- ProjectionEngine as the only place execution semantics live
- framework-neutral core models

## Tests

Changes that touch protocol, storage, projection, or context **must** add or update tests for the [invariants](docs/development/testing-strategy.md):

- unique `event_id`
- duplicate events are idempotent
- arrival order is not causal order
- `parent_event_id` defines edges
- stable logical `node_id` vs `execution_instance_id`
- deterministic ProjectionEngine
- rebuild ≡ incremental apply
- event log remains authoritative
- UI state reconstructible from the log

Do not merge protocol or projection changes without tests.

## Event protocol compatibility

Never modify the Universal Event Protocol casually (Rule 1).

- Additive optional fields may be proposed with `schema_version` discussion.
- Renames, type changes, and new required fields need an ADR and a version bump plan.
- Adapters translate **into** the protocol. Framework objects must not leak into `core` models.

## Framework-neutral core

`core/` must not import LangGraph, CrewAI, OpenAI Agents, Google ADK, or other framework SDKs. Framework-specific details belong in `adapters/` and in event `metadata` / extensions.

## Proposing changes

1. Issue: describe the problem, not only the patch.
2. If architectural: draft an ADR (`docs/adr/ADR-NNN-title.md`) with Status, Context, Decision, Consequences, Alternatives.
3. Implementation PR: small, tested, referenced ADR if any.
4. Docs: update architecture or product docs in the same PR when behavior or scope changes.

## Code quality

- Python 3.12+, modern typing
- Small, cohesive modules
- Explicit interfaces over magic
- No premature abstraction
- No new dependency unless it solves a clear v1 requirement

## License

Contributions are under the [Apache License 2.0](LICENSE).
