import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { vi } from "vitest";

import { ExecutionGraph, toFlow } from "../components/ExecutionGraph";
import type { GraphEdge, GraphState, NodeState } from "../types/projection";

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  if (typeof globalThis.ResizeObserver === "undefined") {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as typeof ResizeObserver;
  }
});

const populated: GraphState = {
  logical_node_ids: ["research", "gather", "fetch", "merge"],
  instance_ids: ["research#1", "gather#1", "fetch#1", "fetch#2", "merge#1"],
  edges: [
    {
      parent_event_id: "as",
      child_event_id: "gs",
      parent_instance_id: "research#1",
      child_instance_id: "gather#1",
      parent_logical_id: "research",
      child_logical_id: "gather",
      child_sequence: 13,
    },
  ],
};

const empty: GraphState = {
  logical_node_ids: [],
  instance_ids: [],
  edges: [],
};

function node(
  logical: string,
  instance: string,
  status: string,
  extras: Partial<NodeState> = {},
): NodeState {
  return {
    logical_node_id: logical,
    node_type: "node",
    execution_instance_id: instance,
    status,
    started_event_id: "s",
    parent_event_id: "p",
    last_sequence: 1,
    payload: null,
    metadata: null,
    ...extras,
  };
}

function mount(
  graph: GraphState,
  projectedNodes: NodeState[] = [],
  selectedInstanceId: string | null = null,
  onSelectInstance: (id: string) => void = () => undefined,
): { el: HTMLDivElement; root: Root } {
  const el = document.createElement("div");
  document.body.appendChild(el);
  const root = createRoot(el);
  act(() => {
    root.render(
      <ExecutionGraph
        graph={graph}
        projectedNodes={projectedNodes}
        selectedInstanceId={selectedInstanceId}
        onSelectInstance={onSelectInstance}
      />,
    );
  });
  return { el, root };
}

test("empty instance_ids unmounts React Flow after a populated graph", () => {
  const projected = populated.instance_ids.map((id) =>
    node(id.split("#")[0], id, "completed"),
  );
  const { el, root } = mount(populated, projected);
  expect(el.querySelector(".react-flow")).not.toBeNull();

  act(() => {
    root.render(
      <ExecutionGraph
        graph={empty}
        projectedNodes={[]}
        selectedInstanceId={null}
        onSelectInstance={() => undefined}
      />,
    );
  });

  expect(el.querySelector(".react-flow")).toBeNull();
});

test("humanizes search_web and shows Attempt labels for a retry family", () => {
  const graph: GraphState = {
    logical_node_ids: ["search_web"],
    instance_ids: ["search_web#1", "search_web#2"],
    edges: [],
  };
  const projected = [
    node("search_web", "search_web#1", "failed"),
    node("search_web", "search_web#2", "completed"),
  ];
  const { el } = mount(graph, projected);
  expect(el.querySelector("h2")?.textContent).toBe("Execution Flow");
  expect(el.textContent).toContain("Search Web");
  expect(el.textContent).toContain("Attempt 1");
  expect(el.textContent).toContain("Attempt 2");
  expect(el.textContent).not.toMatch(/\bLoop\b/);
  expect(el.textContent).not.toMatch(/\bIteration\b/);
  expect(el.textContent).not.toMatch(/\bParallel\b/);
  expect(el.textContent).not.toMatch(/\bRetry\b/);
  const titles = [...el.querySelectorAll(".exec-node-title")].map((n) => n.textContent);
  expect(titles.every((t) => t !== "search_web#1" && t !== "search_web#2")).toBe(true);
});

test("repeated completed executions show Execution N of M", () => {
  const graph: GraphState = {
    logical_node_ids: ["plan"],
    instance_ids: ["plan#1", "plan#2"],
    edges: [],
  };
  const projected = [
    node("plan", "plan#1", "completed"),
    node("plan", "plan#2", "completed"),
  ];
  const { el } = mount(graph, projected);
  expect(el.textContent).toContain("Plan");
  expect(el.textContent).toContain("Execution 1 of 2");
  expect(el.textContent).toContain("Execution 2 of 2");
  expect(el.textContent).not.toContain("Attempt");
});

test("selection click uses executionInstanceId and topology ids match graph", () => {
  const onSelect = vi.fn();
  const projected = [
    node("research", "research#1", "completed"),
    node("gather", "gather#1", "failed"),
  ];
  const { el } = mount(populated, projected, "gather#1", onSelect);
  const ids = [...el.querySelectorAll("[data-execution-instance-id]")].map(
    (n) => n.getAttribute("data-execution-instance-id"),
  );
  expect(ids).toEqual(populated.instance_ids);
  const failed = el.querySelector('[data-execution-instance-id="gather#1"]');
  expect(failed?.className).toContain("exec-node-failed");
  const completed = el.querySelector('[data-execution-instance-id="research#1"]');
  expect(completed?.className).toContain("exec-node-completed");
  expect(failed?.textContent).toContain("Failed");
  expect(completed?.textContent).toContain("Completed");
  act(() => {
    failed?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  expect(onSelect).toHaveBeenCalledWith("gather#1");
});

function edge(
  parent: string | null,
  child: string,
  childEventId: string,
  sequence: number,
): GraphEdge {
  return {
    parent_event_id: parent == null ? "run" : `${parent}-start`,
    child_event_id: childEventId,
    parent_instance_id: parent,
    child_instance_id: child,
    parent_logical_id: parent == null ? null : parent.split("#")[0],
    child_logical_id: child.split("#")[0],
    child_sequence: sequence,
  };
}

function cardIds(el: HTMLElement): (string | null)[] {
  return [...el.querySelectorAll("[data-execution-instance-id]")].map((card) =>
    card.getAttribute("data-execution-instance-id"),
  );
}

function laidOut(graph: GraphState, projected: NodeState[]) {
  const flow = toFlow(graph, projected, null);
  return {
    pairs: flow.edges.map((item) => ({ source: item.source, target: item.target })),
    positions: new Map(flow.nodes.map((item) => [item.id, item.position])),
  };
}

test("three-agent chain lays parent left of child and keeps predecessors started", () => {
  const graph: GraphState = {
    logical_node_ids: ["researcher", "analyst", "writer"],
    instance_ids: ["researcher#1", "analyst#1", "writer#1"],
    edges: [
      edge(null, "researcher#1", "evt_r", 2),
      edge("researcher#1", "analyst#1", "evt_a", 3),
      edge("analyst#1", "writer#1", "evt_w", 4),
    ],
  };
  const projected = [
    node("researcher", "researcher#1", "started", { node_type: "agent" }),
    node("analyst", "analyst#1", "started", { node_type: "agent" }),
    node("writer", "writer#1", "completed", { node_type: "agent" }),
  ];
  const { el } = mount(graph, projected);
  const cards = [...el.querySelectorAll("[data-node-type]")].map((card) => card.getAttribute("data-node-type"));
  expect(cards).toEqual(["agent", "agent", "agent"]);
  expect(el.textContent).toContain("Researcher");
  expect(el.textContent).toContain("Analyst");
  expect(el.textContent).toContain("Writer");
  expect(el.querySelector('[data-execution-instance-id="researcher#1"]')?.textContent).toContain("Started");
  expect(el.querySelector('[data-execution-instance-id="analyst#1"]')?.textContent).toContain("Started");
  const { pairs, positions } = laidOut(graph, projected);
  expect(pairs).toEqual([
    { source: "researcher#1", target: "analyst#1" },
    { source: "analyst#1", target: "writer#1" },
  ]);
  expect(positions.get("researcher#1")!.x).toBeLessThan(positions.get("analyst#1")!.x);
  expect(positions.get("analyst#1")!.x).toBeLessThan(positions.get("writer#1")!.x);
});

test("fan-out stacks siblings under the planner and does not join writer", () => {
  const graph: GraphState = {
    logical_node_ids: ["planner", "research", "data", "writer"],
    instance_ids: ["planner#1", "research#1", "data#1", "writer#1"],
    edges: [
      edge(null, "planner#1", "evt_p", 2),
      edge("planner#1", "research#1", "evt_r", 3),
      edge("planner#1", "data#1", "evt_d", 4),
      edge("planner#1", "writer#1", "evt_w", 5),
    ],
  };
  const projected = [
    node("planner", "planner#1", "started", { node_type: "agent" }),
    node("research", "research#1", "completed", { node_type: "agent" }),
    node("data", "data#1", "completed", { node_type: "agent" }),
    node("writer", "writer#1", "completed", { node_type: "agent" }),
  ];
  const { el } = mount(graph, projected);
  expect(cardIds(el)).toEqual(["planner#1", "research#1", "data#1", "writer#1"]);
  const { pairs, positions } = laidOut(graph, projected);
  expect(pairs).toEqual([
    { source: "planner#1", target: "research#1" },
    { source: "planner#1", target: "data#1" },
    { source: "planner#1", target: "writer#1" },
  ]);
  expect(pairs).not.toContainEqual({ source: "research#1", target: "writer#1" });
  expect(pairs).not.toContainEqual({ source: "data#1", target: "writer#1" });
  const research = positions.get("research#1")!;
  const data = positions.get("data#1")!;
  const writer = positions.get("writer#1")!;
  expect(positions.get("planner#1")!.x).toBeLessThan(research.x);
  expect(research.x).toBe(data.x);
  expect(data.x).toBe(writer.x);
  expect(new Set([research.y, data.y, writer.y]).size).toBe(3);
});

test("retry keeps attempt labels and does not edge the two attempts", () => {
  const graph: GraphState = {
    logical_node_ids: ["planner", "research"],
    instance_ids: ["planner#1", "research#1", "research#2"],
    edges: [
      edge(null, "planner#1", "evt_p", 2),
      edge("planner#1", "research#1", "evt_a1", 3),
      edge("planner#1", "research#2", "evt_a2", 4),
    ],
  };
  const projected = [
    node("planner", "planner#1", "completed", { node_type: "agent" }),
    node("research", "research#1", "failed", { node_type: "agent" }),
    node("research", "research#2", "completed", { node_type: "agent" }),
  ];
  const { el } = mount(graph, projected);
  expect(el.textContent).toContain("Attempt 1");
  expect(el.textContent).toContain("Attempt 2");
  const { pairs } = laidOut(graph, projected);
  expect(pairs).toEqual([
    { source: "planner#1", target: "research#1" },
    { source: "planner#1", target: "research#2" },
  ]);
  expect(pairs).not.toContainEqual({ source: "research#1", target: "research#2" });
  const ids = [...el.querySelectorAll("[data-execution-instance-id]")].map((n) =>
    n.getAttribute("data-execution-instance-id"),
  );
  expect(ids).toEqual(["planner#1", "research#1", "research#2"]);
});

test("nested summarize stays a child of the researcher", () => {
  const graph: GraphState = {
    logical_node_ids: ["researcher", "specialist", "summarize"],
    instance_ids: ["researcher#1", "specialist#1", "summarize#1"],
    edges: [
      edge(null, "researcher#1", "evt_r", 2),
      edge("researcher#1", "specialist#1", "evt_s", 3),
      edge("researcher#1", "summarize#1", "evt_m", 6),
    ],
  };
  const projected = [
    node("researcher", "researcher#1", "completed", { node_type: "agent" }),
    node("specialist", "specialist#1", "completed", { node_type: "agent" }),
    node("summarize", "summarize#1", "completed", { node_type: "node" }),
  ];
  const { el } = mount(graph, projected);
  expect(cardIds(el)).toEqual(["researcher#1", "specialist#1", "summarize#1"]);
  const { pairs, positions } = laidOut(graph, projected);
  expect(pairs).toEqual([
    { source: "researcher#1", target: "specialist#1" },
    { source: "researcher#1", target: "summarize#1" },
  ]);
  expect(pairs).not.toContainEqual({ source: "specialist#1", target: "summarize#1" });
  expect(positions.get("specialist#1")!.x).toBe(positions.get("summarize#1")!.x);
  expect(positions.get("researcher#1")!.x).toBeLessThan(positions.get("specialist#1")!.x);
});

test("task and agent cards show their types and the existing edge", () => {
  const graph: GraphState = {
    logical_node_ids: ["write_brief", "writer"],
    instance_ids: ["write_brief#1", "writer#1"],
    edges: [edge(null, "write_brief#1", "evt_t", 2), edge("write_brief#1", "writer#1", "evt_a", 3)],
  };
  const projected = [
    node("write_brief", "write_brief#1", "completed", { node_type: "task" }),
    node("writer", "writer#1", "completed", { node_type: "agent" }),
  ];
  const { el } = mount(graph, projected);
  const types = [...el.querySelectorAll("[data-node-type]")].map((card) => card.textContent);
  expect(types).toEqual(["task", "agent"]);
  const { pairs, positions } = laidOut(graph, projected);
  expect(pairs).toEqual([{ source: "write_brief#1", target: "writer#1" }]);
  expect(positions.get("write_brief#1")!.x).toBeLessThan(positions.get("writer#1")!.x);
});

test("empty edges render no connections even when sequences differ", () => {
  const graph: GraphState = {
    logical_node_ids: ["research", "data", "writer"],
    instance_ids: ["research#1", "data#1", "writer#1"],
    edges: [],
  };
  const projected = [
    node("research", "research#1", "completed", { node_type: "agent", last_sequence: 2 }),
    node("data", "data#1", "completed", { node_type: "agent", last_sequence: 9 }),
    node("writer", "writer#1", "completed", { node_type: "agent", last_sequence: 40 }),
  ];
  const { el } = mount(graph, projected);
  expect(laidOut(graph, projected).pairs).toEqual([]);
  expect(el.querySelectorAll(".react-flow__edge")).toHaveLength(0);
});

test("structured-execution siblings stack under gather", () => {
  const graph: GraphState = {
    logical_node_ids: ["research", "gather", "fetch", "merge"],
    instance_ids: ["research#1", "gather#1", "fetch#1", "fetch#2", "merge#1"],
    edges: [
      edge("research#1", "gather#1", "gs", 13),
      edge("gather#1", "fetch#1", "f1", 15),
      edge("gather#1", "fetch#2", "f2", 17),
      edge("gather#1", "merge#1", "m", 19),
    ],
  };
  const projected = graph.instance_ids.map((id) => node(id.split("#")[0], id, "completed"));
  const { el } = mount(graph, projected);
  expect(cardIds(el)).toEqual(graph.instance_ids);
  const { pairs, positions } = laidOut(graph, projected);
  expect(pairs).toEqual([
    { source: "research#1", target: "gather#1" },
    { source: "gather#1", target: "fetch#1" },
    { source: "gather#1", target: "fetch#2" },
    { source: "gather#1", target: "merge#1" },
  ]);
  expect(positions.get("fetch#1")!.x).toBe(positions.get("fetch#2")!.x);
  expect(positions.get("fetch#2")!.x).toBe(positions.get("merge#1")!.x);
  expect(positions.get("gather#1")!.x).toBeLessThan(positions.get("fetch#1")!.x);
});
