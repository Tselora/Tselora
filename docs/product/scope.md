# Scope

## In product scope (platform)

Execution intelligence for existing AI agents: protocol, collection, projection, inspection UI, visualization replay, later control and cross-run learning.

## Out of product scope (always)

- Being an agent/orchestration framework
- Capturing private chain-of-thought
- Automatic rewriting of user agents
- Claiming generic process serialization

## v1 vs later

See [v1.md](v1.md) and [roadmap.md](roadmap.md).

**v1** is local, file-based, single-user, inspect-and-visualize.

**Not v1:** database, distributed collector, cloud, auth, multi-tenancy, production runtime control, experience graph, generic re-execution.

## Layers we will build (over time)

| Layer | Role | v1 |
| --- | --- | --- |
| Protocol + SDK | Emit facts | Yes |
| Collector + JSONL | Persist | Yes |
| ProjectionEngine | Semantics | Yes |
| REST / WS / React | Inspect | Yes |
| Adapters | Frameworks | Python first; others later |
| Control plane | Pause/approve/fork | Future |
| Cross-run intelligence | Experience | Future / experimental |
