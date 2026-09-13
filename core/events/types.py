"""Catalog of Universal Agent Event Protocol types.

Unknown types may still be persisted if the envelope is valid.
This slice emits run.* plus agent.*, node.*, tool.*, and llm.* lifecycle events.
"""

from __future__ import annotations

from enum import StrEnum


class EventType(StrEnum):
    """Known event types. Values are the on-the-wire strings."""

    RUN_STARTED = "run.started"
    RUN_COMPLETED = "run.completed"
    RUN_FAILED = "run.failed"
    RUN_CANCELLED = "run.cancelled"
    RUN_PAUSED = "run.paused"
    RUN_RESUMED = "run.resumed"
    RUN_FORKED = "run.forked"

    AGENT_STARTED = "agent.started"
    AGENT_COMPLETED = "agent.completed"
    AGENT_FAILED = "agent.failed"

    NODE_STARTED = "node.started"
    NODE_COMPLETED = "node.completed"
    NODE_FAILED = "node.failed"

    TOOL_STARTED = "tool.started"
    TOOL_COMPLETED = "tool.completed"
    TOOL_FAILED = "tool.failed"

    LLM_STARTED = "llm.started"
    LLM_COMPLETED = "llm.completed"
    LLM_FAILED = "llm.failed"

    PLAN_CREATED = "plan.created"
    PLAN_CHANGED = "plan.changed"
    PLAN_INVALIDATED = "plan.invalidated"

    VERIFICATION_STARTED = "verification.started"
    VERIFICATION_COMPLETED = "verification.completed"
    VERIFICATION_FAILED = "verification.failed"

    RETRY_STARTED = "retry.started"
    LOOP_DETECTED = "loop.detected"
    CHECKPOINT_CREATED = "checkpoint.created"

    APPROVAL_REQUESTED = "approval.requested"
    APPROVAL_COMPLETED = "approval.completed"


SCHEMA_VERSION = "0.1"
