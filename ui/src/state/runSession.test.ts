import { emptyProjection, type ProjectionState, type StatePatch } from "../types/projection";
import { cursor } from "../projection/cursor";
import { startRunSession, type RunSession } from "./runSession";
import type { RunSocketHandlers } from "../api/ws";
import { RestError } from "../api/rest";

function waitFor(pred: () => boolean, timeoutMs = 1000): Promise<void> {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      if (pred()) {
        resolve();
        return;
      }
      if (Date.now() - start > timeoutMs) {
        reject(new Error("timeout"));
        return;
      }
      setTimeout(tick, 0);
    };
    tick();
  });
}

test("REST snapshot then WebSocket patch updates state", async () => {
  const snapshot = emptyProjection();
  snapshot.run = { run_id: "r1", status: "started", started_event_id: "e1", last_sequence: 1 };
  snapshot.timeline = {
    entries: [
      {
        event_id: "e1",
        sequence: 1,
        type: "run.started",
        status: "started",
        node_id: null,
        execution_instance_id: null,
        parent_event_id: null,
      },
    ],
  };
  const nextRun = { ...snapshot.run, status: "completed", last_sequence: 2 };
  const nextTimeline = {
    entries: [
      ...snapshot.timeline.entries,
      {
        event_id: "e2",
        sequence: 2,
        type: "run.completed",
        status: "completed",
        node_id: null,
        execution_instance_id: null,
        parent_event_id: null,
      },
    ],
  };
  const next: ProjectionState = { ...snapshot, run: nextRun, timeline: nextTimeline };
  const patch: StatePatch = {
    schema_version: "tselora.patch.v1",
    run_id: "r1",
    from_cursor: cursor(snapshot),
    to_cursor: cursor(next),
    run: nextRun,
    nodes: null,
    graph: null,
    timeline: nextTimeline,
  };

  let handlers: RunSocketHandlers | null = null;
  let latest: RunSession | null = null;
  const handle = startRunSession(
    "r1",
    (s) => {
      latest = s;
    },
    {
      getRun: async () => structuredClone(snapshot),
      connectSocket: (_id, h) => {
        handlers = h;
        return { close: () => undefined };
      },
      delay: async () => undefined,
    },
  );

  await waitFor(() => latest?.status === "live" && latest.state?.run.last_sequence === 1);
  handlers!.onPatch(patch);
  await waitFor(() => latest?.state?.run.status === "completed");
  expect(latest!.state!.timeline.entries).toHaveLength(2);
  handle.stop();
});

test("patch mismatch triggers REST resync", async () => {
  const first = emptyProjection();
  first.run = { run_id: "r1", status: "started", started_event_id: "e1", last_sequence: 1 };
  const second: ProjectionState = {
    ...first,
    run: { ...first.run, last_sequence: 9, status: "completed" },
  };
  let getCount = 0;
  let handlers: RunSocketHandlers | null = null;
  let latest: RunSession | null = null;
  startRunSession(
    "r1",
    (s) => {
      latest = s;
    },
    {
      getRun: async () => {
        getCount += 1;
        return structuredClone(getCount === 1 ? first : second);
      },
      connectSocket: (_id, h) => {
        handlers = h;
        return { close: () => undefined };
      },
      delay: async () => undefined,
    },
  );

  await waitFor(() => latest?.status === "live" && getCount === 1);
  handlers!.onPatch({
    schema_version: "tselora.patch.v1",
    run_id: "r1",
    from_cursor: { last_sequence: 99, event_count: 0, tip_event_id: null },
    to_cursor: { last_sequence: 100, event_count: 0, tip_event_id: null },
    run: null,
    nodes: null,
    graph: null,
    timeline: null,
  });
  await waitFor(() => getCount === 2 && latest?.state?.run.last_sequence === 9);
  expect(latest!.status).toBe("live");
});

test("unknown run surfaces REST error", async () => {
  let latest: RunSession | null = null;
  startRunSession(
    "missing",
    (s) => {
      latest = s;
    },
    {
      getRun: async () => {
        throw new RestError("unknown run: missing", 404);
      },
      connectSocket: () => ({ close: () => undefined }),
      delay: async () => undefined,
    },
  );
  await waitFor(() => latest?.status === "error");
  expect(latest!.error).toContain("unknown run");
});
