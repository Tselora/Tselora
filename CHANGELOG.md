# Changelog

All notable changes to Tselora will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html) once the event protocol is considered stable.

## [Unreleased]

### Added

- Architecture-first repository: protocol, projection, persistence, and product documentation
- ADRs 001–006 (event protocol, ordering, node identity, ProjectionEngine, WebSocket patches, JSONL persistence)
- Scaffolding for `core/`, `sdk/`, `server/`, `adapters/`, `ui/`, `cli/`, `examples/`, and `tests/`
- Development sequence (Week 1–3) and invariant-focused testing strategy

Implementation of the SDK, collector, projections, and UI has **not** started.
