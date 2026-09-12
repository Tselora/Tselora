from datetime import UTC, datetime

import pytest
from pydantic import ValidationError

from core.events.schema import Actor, AgentEvent, NodeRef
from core.events.types import EventType


def _event(**overrides: object) -> AgentEvent:
    data: dict[str, object] = {
        "schema_version": "0.1",
        "event_id": "evt_test",
        "run_id": "run_test",
        "sequence": 1,
        "timestamp": datetime(2026, 9, 11, 14, 42, 10, tzinfo=UTC),
        "type": EventType.TOOL_STARTED,
        "parent_event_id": "evt_parent",
        "actor": Actor(type="tool", id="search_web"),
        "node": NodeRef(id="search_web", type="tool"),
        "execution_instance_id": "search_web#1",
        "status": "started",
        "payload": {"query": "Tselora"},
        "metadata": {"framework": "custom-python"},
    }
    data.update(overrides)
    return AgentEvent.model_validate(data)


def test_valid_event() -> None:
    event = _event()
    assert event.event_id == "evt_test"
    assert event.node is not None
    assert event.node.id == "search_web"


def test_invalid_event_missing_required() -> None:
    with pytest.raises(ValidationError):
        AgentEvent.model_validate({"event_id": "evt_x"})


def test_invalid_sequence() -> None:
    with pytest.raises(ValidationError):
        _event(sequence=0)


def test_serialization_roundtrip() -> None:
    event = _event()
    raw = event.model_dump_json()
    restored = AgentEvent.model_validate_json(raw)
    assert restored.event_id == event.event_id
    assert restored.type == EventType.TOOL_STARTED
    assert restored.model_dump(mode="json")["timestamp"] == "2026-09-11T14:42:10Z"


def test_unknown_type_is_allowed() -> None:
    event = _event(type="ext.custom.thing")
    assert event.type == "ext.custom.thing"
