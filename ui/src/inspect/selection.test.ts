import type { NodeState, TimelineEntry } from "../types/projection";
import { nodeByInstanceId, resolveSelection, timelineForInstance } from "./selection";

function node(id: string): NodeState {
  return {
    logical_node_id: `logical-${id}`,
    node_type: "tool",
    execution_instance_id: id,
    status: "completed",
    started_event_id: `start-${id}`,
    parent_event_id: `parent-${id}`,
    last_sequence: 3,
    payload: null,
    metadata: null,
  };
}

function entry(
  eventId: string,
  sequence: number,
  instanceId: string | null,
): TimelineEntry {
  return {
    event_id: eventId,
    sequence,
    type: "tool.started",
    status: "started",
    node_id: instanceId,
    execution_instance_id: instanceId,
    parent_event_id: null,
  };
}

test("empty selection returns no node", () => {
  expect(nodeByInstanceId([node("i1")], null)).toBeNull();
});

test("selecting an instance returns that NodeState", () => {
  const nodes = [node("i1"), node("i2")];
  expect(nodeByInstanceId(nodes, "i2")).toEqual(nodes[1]);
});

test("timeline entries are filtered by execution_instance_id and keep ProjectionState order", () => {
  const entries = [
    entry("e1", 1, null),
    entry("e2", 2, "i1"),
    entry("e3", 3, "i2"),
    entry("e4", 4, "i1"),
  ];
  expect(timelineForInstance(entries, "i1").map((e) => e.event_id)).toEqual(["e2", "e4"]);
});

test("unknown instance has no timeline rows", () => {
  expect(timelineForInstance([entry("e1", 1, "i1")], "missing")).toEqual([]);
});

test("selection is cleared when the instance is gone after a patch", () => {
  expect(resolveSelection([node("i2")], "i1")).toBeNull();
  expect(resolveSelection([node("i1"), node("i2")], "i1")).toBe("i1");
});

test("empty selection prefers the single instance that carries Why? keys", () => {
  const plan = node("plan#1");
  const research = node("research#1");
  research.payload = { decision: "retry", action: "retry_search" };
  expect(resolveSelection([plan, research], null)).toBe("research#1");
});

test("empty selection stays empty when zero or several instances carry Why?", () => {
  expect(resolveSelection([node("a"), node("b")], null)).toBeNull();
  const left = node("a");
  const right = node("b");
  left.payload = { decision: "retry" };
  right.payload = { decision: "continue" };
  expect(resolveSelection([left, right], null)).toBeNull();
});
