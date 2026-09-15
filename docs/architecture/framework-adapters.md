# Framework adapters

## Purpose

Keep **core Tselora framework-neutral** while still meeting developers where they are.

Adapters **translate** framework activity into the Universal Agent Event Protocol. They must not leak framework-specific objects into `core` event models. Framework names, graph node classes, and vendor ids belong in `metadata` or adapter-local code.

## Initial strategy (order)

1. Raw Python decorators / context managers (`sdk` + `adapters/python`) — **v1 / current vertical slice**
2. OpenTelemetry bridge (`adapters/otel`) — **after** the raw-Python collector/projection/UI slice, not an MVP dependency
3. LangGraph adapter
4. OpenAI Agents SDK adapter
5. CrewAI adapter
6. Google ADK adapter
7. MCP-related instrumentation

OTEL is a **lossy inbound adapter**, not the Tselora protocol:

```text
Tselora protocol  →  Tselora-native causal model
OTEL spans        →  lossy inbound adapter  →  Tselora events
```

Do not require unstable `gen_ai.*` semantic conventions as core fields. **Missing parent is better than a fabricated causal edge.**

Only (1) is implemented. (2) is a scaffold placeholder. Later adapters are **planned**, not implemented.

## Responsibilities

| Adapter | Maps from | Maps to |
| --- | --- | --- |
| Python | decorators, context managers | node/llm/tool/run events + contextvars |
| OTEL | spans/events | protocol events |
| Framework adapters | native callbacks/hooks | protocol events |

Core must not import adapter packages.

## Inputs / outputs

**In:** framework callbacks, spans, or decorator wrappers.  
**Out:** protocol JSON events only.

## Invariants

- No `langgraph.*` types in `core/events`
- Adapters may be lossy; missing parent is better than a fake edge
- Redaction still applies on the emit path

## Failure cases

- Framework version drift: adapter fails closed (stop mapping), do not corrupt the protocol
- Double instrumentation (decorator + adapter): duplicate events possible; `event_id` must still be unique per emit—prefer one instrumentation path per boundary

## Future extension points

- Adapter capability matrix in docs
- Community adapters out-of-tree, as long as they speak the protocol
