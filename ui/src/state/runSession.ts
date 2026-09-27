import { useEffect, useRef, useState } from "react";

import { getRun, RestError } from "../api/rest";
import { connectRunSocket, type RunSocket } from "../api/ws";
import { PatchApplyError, applyPatch } from "../projection/applyPatch";
import type { ProjectionState } from "../types/projection";

export type SessionStatus = "loading" | "live" | "resyncing" | "error";
export type SessionView = "live" | "historical";

export type RunSession = {
  runId: string | undefined;
  state: ProjectionState | null;
  status: SessionStatus;
  error: string | null;
  view: SessionView;
  throughSequence: number | null;
  tipLastSequence: number;
  showHistorical: (throughSequence: number) => void;
  showLive: () => void;
};

export type GetRunFn = typeof getRun;

export type RunSessionDeps = {
  getRun: GetRunFn;
  connectSocket: typeof connectRunSocket;
  delay: (ms: number) => Promise<void>;
};

export type RunSessionHandle = {
  stop: () => void;
  showHistorical: (throughSequence: number) => void;
  showLive: () => void;
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
  let view: SessionView = "live";
  let throughSequence: number | null = null;
  let tipLastSequence = 0;

  function emit(status: SessionStatus, error: string | null) {
    if (!cancelled) {
      onChange({
        runId,
        state,
        status,
        error,
        view,
        throughSequence,
        tipLastSequence,
        showHistorical,
        showLive,
      });
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
        if (cancelled || view !== "live") {
          return;
        }
        if (state == null) {
          void resync();
          return;
        }
        try {
          state = applyPatch(state, patch);
          tipLastSequence = state.run.last_sequence;
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
        if (view === "live") {
          void resync();
        }
      },
      onClose: () => {
        if (view === "live") {
          void resync();
        }
      },
    });
  }

  async function bootstrap(kind: "load" | "resync") {
    if (cancelled) {
      return;
    }
    view = "live";
    throughSequence = null;
    emit(kind === "load" ? "loading" : "resyncing", null);
    try {
      const snapshot = await deps.getRun(runId);
      if (cancelled || view !== "live") {
        return;
      }
      state = snapshot;
      tipLastSequence = state.run.last_sequence;
      attempts = 0;
      emit("live", null);
      openSocket();
    } catch (err) {
      if (cancelled || view !== "live") {
        return;
      }
      const message = err instanceof RestError ? err.message : "failed to load run";
      emit("error", message);
      disconnect();
    }
  }

  async function resync() {
    if (cancelled || resyncQueued || view !== "live") {
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
    if (cancelled || view !== "live") {
      return;
    }
    await bootstrap("resync");
  }

  async function showHistorical(n: number) {
    if (cancelled) {
      return;
    }
    view = "historical";
    throughSequence = n;
    disconnect();
    try {
      state = await deps.getRun(runId, { throughSequence: n });
      if (cancelled || view !== "historical") {
        return;
      }
      emit("live", null);
    } catch (err) {
      if (cancelled) {
        return;
      }
      const message = err instanceof RestError ? err.message : "failed to load run";
      emit("error", message);
    }
  }

  function showLive() {
    if (cancelled) {
      return;
    }
    void bootstrap("load");
  }

  void bootstrap("load");

  return {
    stop: () => {
      cancelled = true;
      disconnect();
    },
    showHistorical,
    showLive,
  };
}

const idleSession = (runId: string | undefined): RunSession => ({
  runId,
  state: null,
  status: runId ? "loading" : "error",
  error: runId ? null : "missing run id",
  view: "live",
  throughSequence: null,
  tipLastSequence: 0,
  showHistorical: () => undefined,
  showLive: () => undefined,
});

export function useRunSession(runId: string | undefined): RunSession {
  const [session, setSession] = useState<RunSession>(() => idleSession(runId));
  const handleRef = useRef<RunSessionHandle | null>(null);

  useEffect(() => {
    if (!runId) {
      setSession(idleSession(runId));
      return;
    }
    const handle = startRunSession(runId, setSession);
    handleRef.current = handle;
    return () => {
      handle.stop();
      handleRef.current = null;
    };
  }, [runId]);

  return session;
}
