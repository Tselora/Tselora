import { emptyProjection, type ProjectionState, type StatePatch } from "../types/projection";
import { applyPatch, PatchApplyError } from "./applyPatch";
import { cursor } from "./cursor";

function base(): ProjectionState {
  return emptyProjection();
}

function patch(partial: Partial<StatePatch> & Pick<StatePatch, "from_cursor" | "to_cursor">): StatePatch {
  return {
    schema_version: "tselora.patch.v1",
    run_id: null,
    run: null,
    nodes: null,
    graph: null,
    timeline: null,
    ...partial,
  };
}

test("noop patch", () => {
  const state = base();
  const c = cursor(state);
  expect(applyPatch(state, patch({ from_cursor: c, to_cursor: c }))).toEqual(state);
});

test("run replacement", () => {
  const state = base();
  const nextRun = {
    run_id: "r1",
    status: "started",
    started_event_id: "e1",
    last_sequence: 1,
    checkpoints: [],
    forked_from_run_id: null,
    fork_source_checkpoint_id: null,
    fork_source_event_id: null,
    child_run_ids: [],
  };
  const next: ProjectionState = { ...state, run: nextRun };
  const result = applyPatch(
    state,
    patch({
      from_cursor: cursor(state),
      to_cursor: cursor(next),
      run: nextRun,
    }),
  );
  expect(result.run).toEqual(nextRun);
  expect(result.nodes).toBe(state.nodes);
});

test("nodes replacement", () => {
  const state = base();
  const nodes = [
    {
      logical_node_id: "n1",
      node_type: "llm",
      execution_instance_id: "i1",
      status: "started",
      started_event_id: "e2",
      parent_event_id: "e1",
      last_sequence: 2,
      payload: null,
      metadata: null,
    },
  ];
  const next: ProjectionState = { ...state, nodes };
  const result = applyPatch(
    state,
    patch({
      from_cursor: cursor(state),
      to_cursor: cursor(next),
      nodes,
    }),
  );
  expect(result.nodes).toEqual(nodes);
  expect(result.run).toBe(state.run);
});

test("graph replacement", () => {
  const state = base();
  const graph = {
    logical_node_ids: ["n1"],
    instance_ids: ["i1"],
    edges: [
      {
        parent_event_id: "e1",
        child_event_id: "e2",
        parent_instance_id: null,
        child_instance_id: "i1",
        parent_logical_id: null,
        child_logical_id: "n1",
        child_sequence: 2,
      },
    ],
  };
  const next: ProjectionState = { ...state, graph };
  const result = applyPatch(
    state,
    patch({
      from_cursor: cursor(state),
      to_cursor: cursor(next),
      graph,
    }),
  );
  expect(result.graph).toEqual(graph);
});

test("timeline replacement", () => {
  const state = base();
  const timeline = {
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
  const nextRun = { ...state.run, last_sequence: 1, run_id: "r1", started_event_id: "e1", status: "started" };
  const next: ProjectionState = { ...state, run: nextRun, timeline };
  const result = applyPatch(
    state,
    patch({
      from_cursor: cursor(state),
      to_cursor: cursor(next),
      run: nextRun,
      timeline,
    }),
  );
  expect(result.timeline).toEqual(timeline);
});

test("sparse patch", () => {
  const state: ProjectionState = {
    run: { run_id: "r1", status: "started", started_event_id: "e1", last_sequence: 1, checkpoints: [], forked_from_run_id: null, fork_source_checkpoint_id: null, fork_source_event_id: null, child_run_ids: []},
    nodes: [],
    graph: { logical_node_ids: [], instance_ids: [], edges: [] },
    timeline: {
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
    },
  };
  const graph = { logical_node_ids: ["n1"], instance_ids: ["i1"], edges: [] };
  const next = { ...state, graph };
  const result = applyPatch(
    state,
    patch({
      run_id: "r1",
      from_cursor: cursor(state),
      to_cursor: cursor(next),
      graph,
    }),
  );
  expect(result.graph).toEqual(graph);
  expect(result.run).toBe(state.run);
  expect(result.nodes).toBe(state.nodes);
  expect(result.timeline).toBe(state.timeline);
});

test("wrong schema_version", () => {
  const state = base();
  const c = cursor(state);
  expect(() =>
    applyPatch(state, { ...patch({ from_cursor: c, to_cursor: c }), schema_version: "nope" }),
  ).toThrow(PatchApplyError);
});

test("wrong run_id", () => {
  const state: ProjectionState = {
    ...base(),
    run: { ...base().run, run_id: "r1" },
  };
  const c = cursor(state);
  expect(() => applyPatch(state, patch({ run_id: "other", from_cursor: c, to_cursor: c }))).toThrow(
    PatchApplyError,
  );
});

test("from_cursor mismatch", () => {
  const state = base();
  const c = cursor(state);
  expect(() =>
    applyPatch(
      state,
      patch({
        from_cursor: { ...c, last_sequence: 9 },
        to_cursor: c,
      }),
    ),
  ).toThrow(PatchApplyError);
});

test("to_cursor mismatch", () => {
  const state = base();
  const nextRun = { ...state.run, last_sequence: 5 };
  expect(() =>
    applyPatch(
      state,
      patch({
        from_cursor: cursor(state),
        to_cursor: cursor(state),
        run: nextRun,
      }),
    ),
  ).toThrow(PatchApplyError);
});

test("patch application produces expected cursor", () => {
  const state = base();
  const timeline = {
    entries: [
      {
        event_id: "tip",
        sequence: 3,
        type: "run.completed",
        status: "completed",
        node_id: null,
        execution_instance_id: null,
        parent_event_id: null,
      },
    ],
  };
  const nextRun = { run_id: "r1", status: "completed", started_event_id: "e1", last_sequence: 3, checkpoints: [], forked_from_run_id: null, fork_source_checkpoint_id: null, fork_source_event_id: null, child_run_ids: []};
  const next: ProjectionState = { ...state, run: nextRun, timeline };
  const result = applyPatch(
    state,
    patch({
      from_cursor: cursor(state),
      to_cursor: cursor(next),
      run: nextRun,
      timeline,
    }),
  );
  expect(cursor(result)).toEqual({ last_sequence: 3, event_count: 1, tip_event_id: "tip" });
});

test("patch application preserves unchanged views", () => {
  const nodes = [
    {
      logical_node_id: "keep",
      node_type: null,
      execution_instance_id: "inst",
      status: "started",
      started_event_id: "e2",
      parent_event_id: "e1",
      last_sequence: 2,
      payload: null,
      metadata: null,
    },
  ];
  const graph = { logical_node_ids: ["keep"], instance_ids: ["inst"], edges: [] };
  const state: ProjectionState = {
    run: { run_id: "r1", status: "started", started_event_id: "e1", last_sequence: 1, checkpoints: [], forked_from_run_id: null, fork_source_checkpoint_id: null, fork_source_event_id: null, child_run_ids: []},
    nodes,
    graph,
    timeline: { entries: [] },
  };
  const nextRun = { ...state.run, last_sequence: 2 };
  const next = { ...state, run: nextRun };
  const result = applyPatch(
    state,
    patch({
      run_id: "r1",
      from_cursor: cursor(state),
      to_cursor: cursor(next),
      run: nextRun,
    }),
  );
  expect(result.nodes).toBe(nodes);
  expect(result.graph).toBe(graph);
  expect(result.timeline).toBe(state.timeline);
});

test("late non-tip fill keeps last_sequence and applies timeline", () => {
  const beforeTimeline = {
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
      {
        event_id: "e3",
        sequence: 3,
        type: "tool.completed",
        status: "completed",
        node_id: null,
        execution_instance_id: null,
        parent_event_id: null,
      },
    ],
  };
  const afterTimeline = {
    entries: [
      beforeTimeline.entries[0],
      {
        event_id: "e2",
        sequence: 2,
        type: "tool.started",
        status: "started",
        node_id: null,
        execution_instance_id: null,
        parent_event_id: "e1",
      },
      beforeTimeline.entries[1],
    ],
  };
  const run = { run_id: "r1", status: "started", started_event_id: "e1", last_sequence: 3, checkpoints: [], forked_from_run_id: null, fork_source_checkpoint_id: null, fork_source_event_id: null, child_run_ids: []};
  const state: ProjectionState = {
    run,
    nodes: [],
    graph: { logical_node_ids: [], instance_ids: [], edges: [] },
    timeline: beforeTimeline,
  };
  const next: ProjectionState = { ...state, timeline: afterTimeline };
  const result = applyPatch(
    state,
    patch({
      run_id: "r1",
      from_cursor: cursor(state),
      to_cursor: cursor(next),
      timeline: afterTimeline,
    }),
  );
  expect(result.run.last_sequence).toBe(3);
  expect(cursor(result)).toEqual({ last_sequence: 3, event_count: 3, tip_event_id: "e3" });
  expect(result.timeline.entries.map((e) => e.event_id)).toEqual(["e1", "e2", "e3"]);
});
