# ADR-001: Universal Agent Event Protocol

- **Status:** Accepted
- **Date:** 2026-09-11

## Context

Tselora must observe many agent stacks (raw Python, LangGraph, OpenAI Agents SDK, CrewAI, Google ADK, OTEL, MCP) without becoming an orchestration framework. If core models ingest framework objects, every adapter contaminates persistence, projection, and UI.

We need a single, versioned, JSON-serializable contract that adapters emit and the collector stores.

## Decision

Adopt a **Universal Agent Event Protocol** as the only contract between instrumentation and Tselora.

Every event includes `schema_version`, `event_id`, `run_id`, `sequence`, `timestamp`, and `type`. Optional structured fields include `parent_event_id`, `actor`, `node`, `execution_instance_id`, `status`, `payload`, and `metadata`.

Initial types cover run/agent/node/llm/tool/plan/verification/retry/loop/checkpoint/approval and pause/resume/fork.

Framework-specific details belong in `metadata` or adapter code. Core models remain protocol types only.

`schema_version` starts at `"0.1"`. Casual breaking changes are forbidden (Development Rule 1).

## Consequences

**Positive**

- One projection, one store, many adapters
- UI and REST never depend on LangGraph/CrewAI types
- Observable “Why?” lives in structured `payload`, not hidden reasoning

**Negative**

- Adapters are lossy by design
- Protocol evolution requires ADRs and versioning
- Invented vendor types need a compatibility policy (see open-questions)

## Alternatives considered

1. **Store native framework traces** — Couples Tselora to each vendor; UI forks per framework. Rejected.
2. **OpenTelemetry as the only data model** — Useful as a *bridge*, but OTEL span semantics do not encode Tselora node instances, plan changes, or verification payloads cleanly. Rejected as the core contract; accepted as adapter #2.
3. **Relational schema instead of events** — Premature; projection would still need a log for replay. Rejected for the interchange format.
