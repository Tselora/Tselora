from __future__ import annotations

from collections.abc import Iterator

import pytest

from core.events.schema import AgentEvent
from sdk.decorators import configure_emitter
from sdk.emitter import EventEmitter


class RecordingTransport:
    def __init__(self) -> None:
        self.events: list[AgentEvent] = []

    def send(self, event: AgentEvent) -> None:
        self.events.append(event)


@pytest.fixture
def recording_transport() -> Iterator[RecordingTransport]:
    transport = RecordingTransport()
    configure_emitter(EventEmitter(transport))
    yield transport
    configure_emitter(None)
