"""SDK-assigned identifiers. Never allocated by storage."""

from __future__ import annotations

import uuid


def new_event_id() -> str:
    """Return a globally unique event id (`evt_` + UUID hex)."""
    return f"evt_{uuid.uuid4().hex}"


def new_run_id() -> str:
    """Return a globally unique run id (`run_` + UUID hex)."""
    return f"run_{uuid.uuid4().hex}"
