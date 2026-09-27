import { act, type ReactElement } from "react";
import { createRoot } from "react-dom/client";
import { vi } from "vitest";

import { NodeList } from "./NodeList";
import type { NodeState } from "../types/projection";

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
    last_sequence: 3,
    payload: null,
    metadata: null,
  };
}

test("NodeList humanizes titles and uses executionPresentation", () => {
  const el = render(
    <NodeList
      nodes={[
        node("search_web", "search_web#1", "failed"),
        node("search_web", "search_web#2", "completed"),
        node("plan", "plan#1", "completed"),
      ]}
      selectedInstanceId="search_web#2"
      onSelectInstance={() => undefined}
    />,
  );
  expect(el.querySelector("h2")?.textContent).toBe("Executions");
  expect(el.textContent).toContain("Search Web");
  expect(el.textContent).toContain("Attempt 1");
  expect(el.textContent).toContain("Attempt 2");
  expect(el.textContent).toContain("Plan");
  expect(el.textContent).toContain("Execution 1 of 1");
  expect(el.textContent).toContain("Failed");
  expect(el.textContent).toContain("Completed");
  expect(el.textContent).not.toMatch(/\bLoop\b|\bIteration\b|\bParallel\b|\bRetry\b/);
  const selected = el.querySelector("tr.selected");
  expect(selected?.getAttribute("data-execution-instance-id")).toBe("search_web#2");
  expect(el.querySelector('[data-status="failed"]')?.textContent).toContain("Failed");
  expect(el.querySelectorAll("th").length).toBe(3);
});

test("NodeList selection still uses executionInstanceId", () => {
  const onSelect = vi.fn();
  const el = render(
    <NodeList
      nodes={[node("plan", "plan#1", "completed"), node("plan", "plan#2", "completed")]}
      selectedInstanceId={null}
      onSelectInstance={onSelect}
    />,
  );
  expect(el.textContent).toContain("Execution 1 of 2");
  expect(el.textContent).toContain("Execution 2 of 2");
  const second = el.querySelector('[data-execution-instance-id="plan#2"]');
  act(() => {
    second?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  expect(onSelect).toHaveBeenCalledWith("plan#2");
  act(() => {
    second?.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
  });
  expect(onSelect).toHaveBeenCalledTimes(2);
});
