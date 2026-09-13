"""Redact sensitive fields before persistence.

This is not a secret scanner. Callers control what they emit. The
collector applies a Redactor before JSONL append so later policies can
plug in without changing the emitter-to-transport path.
"""

from __future__ import annotations

from typing import Protocol

from core.events.schema import AgentEvent


class Redactor(Protocol):
    """Transform an event before it is written to the event log."""

    def redact(self, event: AgentEvent) -> AgentEvent: ...


class IdentityRedactor:
    """Pass-through. Replace with a real policy before remote deployment."""

    def redact(self, event: AgentEvent) -> AgentEvent:
        return event


class KeyRedactor:
    """Drop listed payload keys. Not a secret scanner."""

    def __init__(self, keys: frozenset[str] | set[str]) -> None:
        self._keys = frozenset(keys)

    def redact(self, event: AgentEvent) -> AgentEvent:
        if not event.payload:
            return event
        stripped = {k: v for k, v in event.payload.items() if k not in self._keys}
        return event.model_copy(update={"payload": stripped})
