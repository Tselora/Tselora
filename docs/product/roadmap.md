# Roadmap

Horizons are directional, not dates. Do not market unbuilt layers as shipping.

## v1 — Local shadow

Protocol, Python SDK, JSONL collector, ProjectionEngine, REST + WebSocket patches, React graph/timeline/inspector, visualization replay. See [v1.md](v1.md).

## After v1 — Adapters

OpenTelemetry bridge, then LangGraph, OpenAI Agents SDK, CrewAI, Google ADK, MCP-related instrumentation. Each adapter is a translation into the protocol.

## Future — Runtime control

Command channel: pause, resume, stop, approve, retry, fork. Outcomes are events. UI is never source of truth. Not production-grade in the first control slice.

## Future — True execution replay / fork

Only where the application emits `checkpoint.created` and implements resume. Never claimed as generic Python serialization.

## Future / experimental — Cross-run experience

Compare runs, “17/20 similar runs succeeded,” experience graph. Experimental until an ADR defines identity of “similar.”

## Explicitly not planned as core

- Replacing agent frameworks
- Multi-tenant cloud in the v1 architecture
- Secret scraping as a product feature
- Reconstructing private CoT
