"""HTTP transport to the local collector. The SDK never writes JSONL."""

from __future__ import annotations

from typing import Protocol

import httpx

from core.events.schema import AgentEvent

DEFAULT_COLLECTOR_URL = "http://127.0.0.1:8000"


class Transport(Protocol):
    """Send a fully formed event to the collector."""

    def send(self, event: AgentEvent) -> None: ...


class CollectorTransport:
    """Synchronous POST /v1/events. An async batcher can wrap this later."""

    def __init__(
        self,
        base_url: str = DEFAULT_COLLECTOR_URL,
        *,
        timeout: float = 10.0,
        client: httpx.Client | None = None,
    ) -> None:
        self._base_url = base_url.rstrip("/")
        self._owns_client = client is None
        self._client = client or httpx.Client(timeout=timeout)

    def send(self, event: AgentEvent) -> None:
        url = f"{self._base_url}/v1/events"
        response = self._client.post(url, json=event.model_dump(mode="json"))
        response.raise_for_status()

    def close(self) -> None:
        if self._owns_client:
            self._client.close()
