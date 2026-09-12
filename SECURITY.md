# Security Policy

Tselora observes agent execution. That can include **prompts, tool arguments, model responses, and execution metadata**. Treat the local event log as sensitive.

## What users control

- **You choose what to emit.** Instrumentation and adapters should only send fields the application intends to persist.
- **Raw secrets must never be emitted by default.** API keys, tokens, passwords, and credentials must not appear in payloads or metadata.
- **Redact before persistence.** The collector must not write unredacted sensitive fields to JSONL. Redaction happens on the emit path (SDK) and is enforced again at the collector boundary.

v1 includes a `Redactor` abstraction (`core/redaction.py`). It is **not** an elaborate secret-detection system. Do not rely on Tselora to find secrets you forgot to strip.

## Reporting a vulnerability

Do not open a public issue for security reports.

Email the maintainers (or use GitHub private vulnerability reporting once the public repository enables it) with:

- a description of the issue
- affected versions / commit if known
- reproduction steps that do **not** include live secrets
- impact (log leakage, path traversal in run IDs, WebSocket exposure, etc.)

We will acknowledge reports as soon as practical and coordinate a fix before any public disclosure.

## v1 threat model (local-first)

v1 is a **local developer tool**:

- no authentication
- no multi-tenancy
- no remote collector
- no cloud deployment

Anyone who can reach the local collector/API can read run data. Bind to loopback in development. Do not expose the collector on a public interface.

## Future remote deployments

When Tselora is no longer local-only, stronger controls are required before any network exposure:

- authentication and authorization
- TLS
- tenant isolation
- retention and deletion
- encryption at rest
- audit of who viewed which run
- stricter payload allowlists

Those controls are **out of v1 scope**. Do not treat the current architecture as production-ready for shared or remote use.

## Safe handling of event data

- Keep `.agent-devtools/runs/` out of version control (see `.gitignore`).
- Do not commit sample logs that contain real user or customer data.
- Prefer structured decision metadata over dumping full prompts when a “Why?” view is enough.
- Never attempt to capture or reconstruct **private chain-of-thought**.
