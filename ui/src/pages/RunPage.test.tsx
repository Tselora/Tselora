import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { vi } from "vitest";

import { RunPage } from "./RunPage";
import type { RunSession } from "../state/runSession";
import { emptyProjection } from "../types/projection";

vi.mock("../state/runSession", () => ({
  useRunSession: () => mockSession,
}));

let mockSession: RunSession;

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

function renderPage(): HTMLDivElement {
  const el = document.createElement("div");
  document.body.appendChild(el);
  act(() => {
    createRoot(el).render(
      <MemoryRouter initialEntries={["/runs/run_a"]}>
        <Routes>
          <Route path="/runs/:runId" element={<RunPage />} />
        </Routes>
      </MemoryRouter>,
    );
  });
  return el;
}

test("explorer composition: header, flow+timeline main, executions+details rail", () => {
  const state = emptyProjection();
  state.run = { run_id: "run_a", status: "completed", started_event_id: "e1", last_sequence: 1, checkpoints: [], forked_from_run_id: null, fork_source_checkpoint_id: null, fork_source_event_id: null, child_run_ids: []};
  mockSession = {
    runId: "run_a",
    state,
    status: "live",
    error: null,
    view: "live",
    throughSequence: null,
    tipLastSequence: 1,
    showHistorical: () => undefined,
    showLive: () => undefined,
  };
  const el = renderPage();
  expect(el.querySelector(".explorer-header")?.textContent).toContain("Execution Replay");
  expect(el.querySelector(".explorer-flow")?.textContent).toContain("Execution Flow");
  expect(el.querySelector(".explorer-activity")?.textContent).toContain("Activity Timeline");
  const rail = el.querySelector(".explorer-rail");
  expect(rail?.textContent).toContain("Executions");
  expect(rail?.textContent).toContain("Details");
  const headings = [...el.querySelectorAll("h2")].map((n) => n.textContent);
  expect(headings).toContain("Execution Replay");
  expect(headings).toContain("Execution Flow");
  expect(headings).toContain("Executions");
  expect(headings).toContain("Details");
  expect(headings).toContain("Activity Timeline");
  const flow = el.querySelector(".explorer-flow");
  const activity = el.querySelector(".explorer-activity");
  const executions = [...el.querySelectorAll("h2")].find((n) => n.textContent === "Executions");
  const details = [...el.querySelectorAll("h2")].find((n) => n.textContent === "Details");
  expect(flow!.compareDocumentPosition(activity as Node) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(executions!.compareDocumentPosition(details as Node) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(el.querySelector(".explorer-main")).not.toBeNull();
});
