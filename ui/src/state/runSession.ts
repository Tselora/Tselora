import { useEffect, useState } from "react";

import { getRun, RestError } from "../api/rest";
import { connectRunSocket, type RunSocket } from "../api/ws";
import { PatchApplyError, applyPatch } from "../projection/applyPatch";
import type { ProjectionState } from "../types/projection";

export type SessionStatus = "loading" | "live" | "resyncing" | "error";

export type RunSession = {
  runId: string | undefined;
  state: ProjectionState | null;
  status: SessionStatus;
  error: string | null;
};

export type RunSessionDeps = {
  getRun: typeof getRun;
  connectSocket: typeof connectRunSocket;
  delay: (ms: number) => Promise<void>;
};

export type RunSessionHandle = {
  stop: () => void;
};

const MAX_ATTEMPTS = 8;

const defaultDeps: RunSessionDeps = {
  getRun,
  connectSocket: connectRunSocket,
  delay: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
};

export function startRunSession(
  runId: string,
  onChange: (session: RunSession) => void,
  deps: RunSessionDeps = defaultDeps,
): RunSessionHandle {
  let cancelled = false;
  let attempts = 0;
  let socket: RunSocket | null = null;
  let state: ProjectionState | null = null;
  let resyncQueued = false;

  function emit(status: SessionStatus, error: string | null) {
    if (!cancelled) {
      onChange({ runId, state, status, error });
    }
  }

  function disconnect() {
    socket?.close();
    socket = null;
  }

  function openSocket() {
    disconnect();
    socket = deps.connectSocket(runId, {
      onPatch: (patch) => {
        if (cancelled) {
          return;
        }
        if (state == null) {
          void resync();
          return;
        }
        try {
          state = applyPatch(state, patch);
          attempts = 0;
          emit("live", null);
        } catch (err) {
          if (err instanceof PatchApplyError) {
            void resync();
            return;
          }
          throw err;
        }
      },
      onError: () => {
        void resync();
      },
      onClose: () => {
        void resync();
      },
    });
  }

  async function bootstrap(kind: "load" | "resync") {
    if (cancelled) {
      return;
    }
    emit(kind === "load" ? "loading" : "resyncing", null);
    try {
      state = await deps.getRun(runId);
      if (cancelled) {
        return;
      }
      attempts = 0;
      emit("live", null);
      openSocket();
    } catch (err) {
      if (cancelled) {
        return;
      }
      const message = err instanceof RestError ? err.message : "failed to load run";
      emit("error", message);
      disconnect();
    }
  }

  async function resync() {
    if (cancelled || resyncQueued) {
      return;
    }
    resyncQueued = true;
    attempts += 1;
    if (attempts > MAX_ATTEMPTS) {
      emit("error", "reconnect failed");
      disconnect();
      resyncQueued = false;
      return;
    }
    disconnect();
    const delayMs = Math.min(2000, 250 * 2 ** (attempts - 1));
    await deps.delay(delayMs);
    resyncQueued = false;
    if (cancelled) {
      return;
    }
    await bootstrap("resync");
  }

  void bootstrap("load");

  return {
    stop: () => {
      cancelled = true;
      disconnect();
    },
  };
}

export function useRunSession(runId: string | undefined): RunSession {
  const [session, setSession] = useState<RunSession>({
    runId,
    state: null,
    status: runId ? "loading" : "error",
    error: runId ? null : "missing run id",
  });

  useEffect(() => {
    if (!runId) {
      setSession({ runId, state: null, status: "error", error: "missing run id" });
      return;
    }
    const handle = startRunSession(runId, setSession);
    return () => handle.stop();
  }, [runId]);

  return session;
}
