# Vision

Tselora is an open-source **execution intelligence platform for AI agents**.

Tagline: **The execution shadow for intelligent systems.**

## The idea

Intelligent systems already exist: people build them with Python, LangGraph, CrewAI, vendor agent SDKs, and custom loops. What they lack is a faithful **shadow** of execution—structure, time, state, and observable decisions—independent of any one framework.

Tselora plugs into an existing agent and observes. It reconstructs:

- the actual execution graph
- timeline
- node and run state
- causal relationships
- retries, loops, and parallel branches
- observable decision metadata

Developers inspect what happened, understand why execution **changed** (from structured evidence), and eventually replay, control, and learn from previous runs.

## Positioning

Tselora is a **developer / execution-intelligence layer**. It is not an agent framework and not an orchestrator. It does not choose the next tool. It does not replace your graph library.

## Principles

- **Observe, don’t own the agent.**
- **Event log is truth.**
- **One projection engine.**
- **Framework-neutral core.**
- **Observable metadata, never private chain-of-thought.**
- **Local-first in v1.**
- **Honest about replay:** visualization now; real re-execution only with an explicit checkpoint contract.

## “Why?”

Tselora must not reconstruct hidden reasoning. A plan change is explained like this:

- Trigger: `verification_failed`
- Evidence: 7 sources
- Threshold: 85
- Score: 63
- Decision: replan
- Selected strategy: `research_branch_B`
- Historical evidence: 17/20 similar runs succeeded *(cross-run: future)*

That is **execution metadata**, not chain-of-thought.
