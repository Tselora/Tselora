import type { GraphState, NodeState, TimelineEntry } from "../types/projection";
import {
  executionPresentation,
  executionPresentations,
  liveBadgeKind,
  ordinalAmongLogical,
  retryFamilies,
  runDisplayName,
  siblingGroups,
  timelinePresentation,
  titleCaseLogicalNodeId,
} from "./index";

function node(overrides: Partial<NodeState> & Pick<NodeState, "logical_node_id" | "execution_instance_id">): NodeState {
  return {
    node_type: "node",
    status: "completed",
    started_event_id: null,
    parent_event_id: null,
    last_sequence: 1,
    payload: null,
    metadata: null,
    ...overrides,
  };
}

test("titleCaseLogicalNodeId splits snake and title-cases tokens", () => {
  expect(titleCaseLogicalNodeId("search_web")).toBe("Search Web");
  expect(titleCaseLogicalNodeId("selected_strategy")).toBe("Selected Strategy");
});

test("titleCaseLogicalNodeId handles separators and camelCase without inventing meaning", () => {
  expect(titleCaseLogicalNodeId("gather")).toBe("Gather");
  expect(titleCaseLogicalNodeId("search-web")).toBe("Search Web");
  expect(titleCaseLogicalNodeId("pkg.plan")).toBe("Pkg Plan");
  expect(titleCaseLogicalNodeId("searchWeb")).toBe("Search Web");
  expect(titleCaseLogicalNodeId("HTTP_retry")).toBe("Http Retry");
  expect(titleCaseLogicalNodeId("")).toBe("");
});

test("ordinalAmongLogical is 1-based in existing node order", () => {
  const nodes = [
    node({ logical_node_id: "iterate", execution_instance_id: "iterate#1" }),
    node({ logical_node_id: "iterate", execution_instance_id: "iterate#2" }),
    node({ logical_node_id: "fetch", execution_instance_id: "fetch#1" }),
  ];
  expect(ordinalAmongLogical(nodes, "iterate", "iterate#1")).toBe(1);
  expect(ordinalAmongLogical(nodes, "iterate", "iterate#2")).toBe(2);
  expect(ordinalAmongLogical(nodes, "fetch", "fetch#1")).toBe(1);
  expect(ordinalAmongLogical(nodes, "iterate", "missing")).toBe(0);
  expect(ordinalAmongLogical([], "iterate", "iterate#1")).toBe(0);
});

test("repeated completed logical nodes are not a retry family", () => {
  const nodes = [
    node({ logical_node_id: "iterate", execution_instance_id: "iterate#1", status: "completed" }),
    node({ logical_node_id: "iterate", execution_instance_id: "iterate#2", status: "completed" }),
  ];
  expect(retryFamilies(nodes)).toEqual([]);
  const rows = executionPresentations(nodes);
  expect(rows.every((row) => row.inRetryFamily === false)).toBe(true);
  expect(rows[0].displayLabel).toBe("Execution 1 of 2");
  expect(rows[1].displayLabel).toBe("Execution 2 of 2");
  expect(rows[0].attemptNumber).toBeNull();
});

test("failed then later same logical node is a retry family", () => {
  const nodes = [
    node({
      logical_node_id: "search_web",
      execution_instance_id: "search_web#1",
      status: "failed",
    }),
    node({
      logical_node_id: "search_web",
      execution_instance_id: "search_web#2",
      status: "completed",
    }),
  ];
  expect(retryFamilies(nodes)).toEqual([
    { logicalNodeId: "search_web", instanceIds: ["search_web#1", "search_web#2"] },
  ]);
  const first = executionPresentation(nodes, "search_web#1");
  const second = executionPresentation(nodes, "search_web#2");
  expect(first?.inRetryFamily).toBe(true);
  expect(first?.attemptNumber).toBe(1);
  expect(first?.displayLabel).toBe("Attempt 1");
  expect(first?.title).toBe("Search Web");
  expect(second?.displayLabel).toBe("Attempt 2");
  expect(second?.totalExecutions).toBe(2);
});

test("cancelled then later instance is a retry family; lone failure is not", () => {
  expect(
    retryFamilies([
      node({ logical_node_id: "x", execution_instance_id: "x#1", status: "cancelled" }),
      node({ logical_node_id: "x", execution_instance_id: "x#2", status: "completed" }),
    ]),
  ).toHaveLength(1);
  expect(
    retryFamilies([
      node({ logical_node_id: "x", execution_instance_id: "x#1", status: "failed" }),
    ]),
  ).toEqual([]);
});

test("executionPresentation for a single node", () => {
  const nodes = [node({ logical_node_id: "plan", execution_instance_id: "plan#1" })];
  const row = executionPresentation(nodes, "plan#1");
  expect(row).toMatchObject({
    title: "Plan",
    executionOrdinal: 1,
    totalExecutions: 1,
    inRetryFamily: false,
    attemptNumber: null,
    displayLabel: "Execution 1 of 1",
  });
  expect(executionPresentation(nodes, "missing")).toBeNull();
  expect(executionPresentations([])).toEqual([]);
});

test("siblingGroups requires two or more children and ignores null parent instances", () => {
  const graph: GraphState = {
    logical_node_ids: ["research", "gather", "fetch"],
    instance_ids: ["research#1", "gather#1", "fetch#1", "fetch#2", "merge#1"],
    edges: [
      {
        parent_event_id: "r",
        child_event_id: "g",
        parent_instance_id: "research#1",
        child_instance_id: "gather#1",
        parent_logical_id: "research",
        child_logical_id: "gather",
        child_sequence: 13,
      },
      {
        parent_event_id: "gs",
        child_event_id: "f1",
        parent_instance_id: "gather#1",
        child_instance_id: "fetch#1",
        parent_logical_id: "gather",
        child_logical_id: "fetch",
        child_sequence: 15,
      },
      {
        parent_event_id: "gs",
        child_event_id: "f2",
        parent_instance_id: "gather#1",
        child_instance_id: "fetch#2",
        parent_logical_id: "gather",
        child_logical_id: "fetch",
        child_sequence: 17,
      },
      {
        parent_event_id: "gs",
        child_event_id: "m",
        parent_instance_id: "gather#1",
        child_instance_id: "merge#1",
        parent_logical_id: "gather",
        child_logical_id: "merge",
        child_sequence: 19,
      },
      {
        parent_event_id: "run",
        child_event_id: "as",
        parent_instance_id: null,
        child_instance_id: "research#1",
        parent_logical_id: null,
        child_logical_id: "research",
        child_sequence: 2,
      },
    ],
  };
  expect(siblingGroups(graph)).toEqual([
    {
      parentInstanceId: "gather#1",
      childInstanceIds: ["fetch#1", "fetch#2", "merge#1"],
    },
  ]);
  expect(siblingGroups({ logical_node_ids: [], instance_ids: [], edges: [] })).toEqual([]);
});

test("timelinePresentation keeps technical fields and uses execution labels", () => {
  const nodes = [
    node({ logical_node_id: "search_web", execution_instance_id: "search_web#1", status: "failed" }),
    node({ logical_node_id: "search_web", execution_instance_id: "search_web#2", status: "completed" }),
  ];
  const entries: TimelineEntry[] = [
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
      event_id: "e6",
      sequence: 6,
      type: "tool.failed",
      status: "failed",
      node_id: "search_web",
      execution_instance_id: "search_web#1",
      parent_event_id: "e5",
    },
  ];
  const rows = timelinePresentation(entries, nodes);
  expect(rows[0]).toMatchObject({
    eventId: "e1",
    sequence: 1,
    type: "run.started",
    status: "started",
    title: null,
    displayLabel: null,
    executionInstanceId: null,
  });
  expect(rows[1]).toMatchObject({
    eventId: "e6",
    sequence: 6,
    type: "tool.failed",
    status: "failed",
    title: "Search Web",
    displayLabel: "Attempt 1",
    executionInstanceId: "search_web#1",
    parentEventId: "e5",
  });
});

test("timelinePresentation title-cases node_id when instance is missing from nodes", () => {
  const entries: TimelineEntry[] = [
    {
      event_id: "e",
      sequence: 3,
      type: "node.started",
      status: "started",
      node_id: "plan",
      execution_instance_id: "plan#1",
      parent_event_id: "r",
    },
  ];
  expect(timelinePresentation(entries, [])[0].title).toBe("Plan");
  expect(timelinePresentation(entries, [])[0].displayLabel).toBeNull();
});

test("runDisplayName prefers agent logical id", () => {
  expect(
    runDisplayName(
      [
        node({ logical_node_id: "plan", execution_instance_id: "plan#1", node_type: "node" }),
        node({ logical_node_id: "research", execution_instance_id: "research#1", node_type: "agent" }),
      ],
      "run_x",
    ),
  ).toBe("Research");
  expect(runDisplayName([], "run_x")).toBe("run_x");
  expect(runDisplayName([], null)).toBe("Run");
});

test("liveBadgeKind maps view and status", () => {
  expect(liveBadgeKind("historical", "live")).toBe("historical");
  expect(liveBadgeKind("live", "live")).toBe("live");
  expect(liveBadgeKind("live", "resyncing")).toBe("reconnecting");
  expect(liveBadgeKind("live", "loading")).toBe("reconnecting");
  expect(liveBadgeKind("historical", "resyncing")).toBe("historical");
});

