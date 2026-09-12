# Concurrency and execution context

## Purpose

Keep **causal context** correct when agents use threads, executors, and asyncio—without a global “current node”.

## Mechanism

Python **`contextvars`** hold an **active node stack** (and related run/parent identifiers).

Push on node/LLM/tool start; pop on end. Nested decorators/context managers nest the stack.

Do **not** use a module-level `current_node` global. It is wrong under concurrency.

## Responsibilities

SDK / `core/context.py`:

- Store `run_id`, current `event_id` / parent candidate, logical node, instance id
- Copy context across `contextvars` copy/context.run
- Provide explicit propagation helpers for:
  - threads
  - `concurrent.futures` executors
  - async boundaries where context is not inherited

## Inputs / outputs

**In:** decorator/context-manager enter/exit; explicit `attach`/`propagate` at boundaries.  
**Out:** fields on emitted events (`parent_event_id`, `node`, `execution_instance_id`).

## Invariants

- Nested sync contexts restore the previous stack frame on exit (including exceptions).
- Two parallel tasks must not share a mutable stack; they use copied contexts.
- Sequence numbers remain per-run monotonic at the emitter even under parallelism (lock or atomic counter in the SDK).

## Known loss of context

Opaque third-party concurrency, **subprocesses**, and libraries that create **independent execution contexts** may **lose causal context**. Events may still be emitted but with a broken or missing `parent_event_id`.

Tselora will document this; it will not pretend to instrument every native thread started inside a closed-source library.

## Failure cases

- Forgot to propagate into a thread: orphan branch in the graph
- Unbalanced push/pop: leaked parent; tests must cover nesting and exceptions
- Subprocess: new process has empty context unless the app passes ids explicitly

## Future extension points

- OpenTelemetry context bridge (`adapters/otel`)
- Explicit `execution_instance_id` allocation API for fan-out
