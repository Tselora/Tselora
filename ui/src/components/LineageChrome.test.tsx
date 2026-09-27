import { act, type ReactElement } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";

import { LineageChrome } from "./LineageChrome";
import type { RunState } from "../types/projection";

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

function render(ui: ReactElement): HTMLDivElement {
  const el = document.createElement("div");
  document.body.appendChild(el);
  act(() => {
    createRoot(el).render(<MemoryRouter>{ui}</MemoryRouter>);
  });
  return el;
}

function baseRun(overrides: Partial<RunState> = {}): RunState {
  return {
    run_id: "run_child",
    status: "completed",
    started_event_id: "e1",
    last_sequence: 2,
    checkpoints: [],
    forked_from_run_id: null,
    fork_source_checkpoint_id: null,
    fork_source_event_id: null,
    child_run_ids: [],
    ...overrides,
  };
}

test("LineageChrome is absent without lineage fields", () => {
  const el = render(<LineageChrome run={baseRun()} />);
  expect(el.querySelector(".lineage-chrome")).toBeNull();
});

test("LineageChrome links parent and compare with parent", () => {
  const el = render(
    <LineageChrome
      run={baseRun({
        forked_from_run_id: "run_parent",
        fork_source_checkpoint_id: "cp_1",
      })}
    />,
  );
  const text = el.textContent ?? "";
  expect(text).toContain("run_parent");
  expect(text).toContain("Compare with parent");
  expect(text).toContain("cp_1");
  const compare = [...el.querySelectorAll("a")].find((a) => a.textContent === "Compare with parent");
  expect(compare?.getAttribute("href")).toBe(
    "/compare?left_run_id=run_parent&right_run_id=run_child",
  );
  expect(text.toLowerCase()).not.toContain("app_restore_ref");
  expect(text.toLowerCase()).not.toContain("better");
});

test("LineageChrome single child offers compare with child", () => {
  const el = render(
    <LineageChrome run={baseRun({ run_id: "run_parent", child_run_ids: ["run_kid"] })} />,
  );
  const compare = [...el.querySelectorAll("a")].find((a) => a.textContent === "Compare with child");
  expect(compare?.getAttribute("href")).toBe(
    "/compare?left_run_id=run_parent&right_run_id=run_kid",
  );
});

test("LineageChrome multiple children require explicit pair choice", () => {
  const el = render(
    <LineageChrome
      run={baseRun({ run_id: "run_parent", child_run_ids: ["run_a", "run_b"] })}
    />,
  );
  expect(el.querySelector("select")).not.toBeNull();
  expect(el.textContent).toContain("Compare with child");
  const compare = [...el.querySelectorAll("a")].find((a) => a.textContent === "Compare");
  expect(compare?.getAttribute("href")).toBe(
    "/compare?left_run_id=run_parent&right_run_id=run_a",
  );
});

test("LineageChrome lists checkpoints without restore refs", () => {
  const el = render(
    <LineageChrome
      run={baseRun({
        checkpoints: [
          {
            checkpoint_id: "cp_x",
            event_id: "e9",
            sequence: 9,
            label: "after_plan",
            execution_instance_id: null,
          },
        ],
      })}
    />,
  );
  expect(el.textContent).toContain("cp_x");
  expect(el.textContent).toContain("after_plan");
  expect(JSON.stringify(el.innerHTML)).not.toContain("app_restore_ref");
});
