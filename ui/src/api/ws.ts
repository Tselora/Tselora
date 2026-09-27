import { PATCH_SCHEMA_VERSION, type StatePatch } from "../types/projection";

export type RunSocketHandlers = {
  onPatch: (patch: StatePatch) => void;
  onClose: (code: number) => void;
  onError: () => void;
};

export type RunSocket = {
  close: () => void;
};

export function connectRunSocket(runId: string, handlers: RunSocketHandlers): RunSocket {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const url = `${protocol}//${window.location.host}/v1/runs/${encodeURIComponent(runId)}/ws`;
  const socket = new WebSocket(url);
  let closedByUs = false;

  socket.onmessage = (event: MessageEvent<string>) => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(event.data);
    } catch {
      handlers.onError();
      return;
    }
    if (!isStatePatch(parsed)) {
      handlers.onError();
      return;
    }
    handlers.onPatch(parsed);
  };

  socket.onerror = () => {
    if (!closedByUs) {
      handlers.onError();
    }
  };

  socket.onclose = (event: CloseEvent) => {
    if (!closedByUs) {
      handlers.onClose(event.code);
    }
  };

  return {
    close: () => {
      closedByUs = true;
      socket.close();
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isStatePatch(value: unknown): value is StatePatch {
  if (!isRecord(value)) {
    return false;
  }
  if (value.schema_version !== PATCH_SCHEMA_VERSION) {
    return false;
  }
  return isRecord(value.from_cursor) && isRecord(value.to_cursor);
}
