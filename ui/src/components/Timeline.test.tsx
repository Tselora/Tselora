import { act, type ReactElement } from "react";
import { createRoot } from "react-dom/client";
import { vi } from "vitest";

import { Timeline } from "./Timeline";
import type { NodeState, TimelineEntry, TimelineState } from "../types/projection";

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

function render(ui: ReactElement): HTMLDivElement {
  const el = document.createElement("div");
  document.body.appendChild(el);
  act(() => {
    createRoot(el).render(ui);
  });
  return el;
}

function node(logical: string, instance: string, status: string): NodeState {
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
  };
}

function entry(overrides: Partial<TimelineEntry> & Pick<TimelineEntry, "event_id" | "sequence" | "type">): TimelineEntry {
  return {
    status: null,
    node_id: null,
    execution_instance_id: null,
    parent_event_id: null,
    ...overrides,
  };
}

test("Activity Timeline humanizes executions, keeps event chronology, and does not infer structure", () => {
  const timeline: TimelineState = {
    entries: [
      entry({ event_id: "e1", sequence: 1, type: "run.started", status: "started" }),
      entry({
        event_id: "e6",
        sequence: 6,
        type: "tool.failed",
        status: "failed",
        node_id: "search_web",
        execution_instance_id: "search_web#1",
        parent_event_id: "e5",
      }),
      entry({
        event_id: "e8",
        sequence: 8,
        type: "tool.completed",
        status: "completed",
        node_id: "search_web",
        execution_instance_id: "search_web#2",
      }),
      entry({
        event_id: "e10",
        sequence: 10,
        type: "node.completed",
        status: "completed",
        node_id: "plan",
        execution_instance_id: "plan#1",
      }),
      entry({
        event_id: "e12",
        sequence: 12,
        type: "node.completed",
        status: "completed",
        node_id: "plan",
        execution_instance_id: "plan#2",
      }),
    ],
  };
  const nodes = [
    node("search_web", "search_web#1", "failed"),
    node("search_web", "search_web#2", "completed"),
    node("plan", "plan#1", "completed"),
    node("plan", "plan#2", "completed"),
  ];
  const onSelect = vi.fn();
  const el = render(
    <Timeline timeline={timeline} nodes={nodes} selectedInstanceId={null} onSelectInstance={onSelect} />,
  );

  expect(el.querySelector("h2")?.textContent).toBe("Activity Timeline");
  const items = [...el.querySelectorAll("li")];
  expect(items.map((li) => li.getAttribute("data-sequence"))).toEqual(["1", "6", "8", "10", "12"]);
  expect(items).toHaveLength(5);

  const titles = [...el.querySelectorAll(".activity-title")].map((n) => n.textContent);
  expect(titles[0]).toBe("Run Started");
  expect(titles).toContain("Search Web");
  expect(titles).toContain("Plan");

  expect(el.textContent).toContain("Attempt 1");
  expect(el.textContent).toContain("Attempt 2");
  expect(el.textContent).toContain("Execution 1 of 2");
  expect(el.textContent).toContain("Execution 2 of 2");
  expect(el.textContent).toContain("Failed");
  expect(el.textContent).toContain("Completed");
  expect(el.textContent).toContain("Started");
  expect(el.textContent).not.toMatch(/\bLoop\b|\bIteration\b|\bParallel\b|\bRetry\b/);

  const search = el.querySelector('[data-event-id="e6"]');
  expect(search?.querySelector(".activity-title")?.textContent).toBe("Search Web");
  expect(search?.querySelector(".activity-tech")?.textContent).toContain("tool.failed");
  expect(search?.querySelector(".activity-tech")?.textContent).toContain("e6");
  expect(search?.querySelector(".activity-tech")?.textContent).toContain("e5");
  expect(search?.querySelector(".activity-title")?.className).not.toContain("muted");
  expect(search?.querySelector(".activity-tech")?.className).toContain("muted");

  const runRow = el.querySelector('[data-event-id="e1"]');
  expect(runRow?.getAttribute("data-selectable")).toBe("false");
  expect(runRow?.getAttribute("data-execution-instance-id")).toBe("");
  act(() => {
    runRow?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  expect(onSelect).not.toHaveBeenCalled();

  act(() => {
    search?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  expect(onSelect).toHaveBeenCalledWith("search_web#1");
  act(() => {
    search?.dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true }));
  });
  expect(onSelect).toHaveBeenCalledTimes(2);
  act(() => {
    runRow?.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
  });
  expect(onSelect).toHaveBeenCalledTimes(2);
});

test("empty timeline keeps the empty copy", () => {
  const el = render(<Timeline timeline={{ entries: [] }} nodes={[]} />);
  expect(el.textContent).toContain("No timeline entries.");
});
