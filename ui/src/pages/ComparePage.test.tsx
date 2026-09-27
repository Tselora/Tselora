import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, vi } from "vitest";

import { ComparePage } from "./ComparePage";
import type { ComparisonDocument } from "../types/comparison";

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function sampleDoc(overrides: Partial<ComparisonDocument> = {}): ComparisonDocument {
  return {
    schema_version: "0.1",
    comparison_id: "cmp_run_a__run_b",
    left_run_id: "run_a",
    right_run_id: "run_b",
    completeness: "full",
    lineage: null,
    outcome: {
      status: { left: "completed", right: "failed", equal: false },
      terminal: { left: true, right: true, equal: true },
      failure_category: { only_left: [], only_right: ["timeout"], both: [] },
    },
    why: {
      instances: [
        {
          logical_node_id: "critic",
          index: 0,
          left_execution_instance_id: "critic#1",
          right_execution_instance_id: "critic#1",
          presence: "paired",
          keys: { decision: "changed" },
        },
      ],
    },
    topology: {
      logical_node_ids: { only_left: [], only_right: [], both: ["critic"] },
      node_type_mismatches: [],
      instance_count: { left: 1, right: 1, delta: 0 },
      edge_count: { left: 1, right: 1, delta: 0 },
      logical_family_counts: {},
      edges: { only_left: [], only_right: [], both: ["a|b|1"] },
      retry_family_counts: {},
    },
    timing: {
      event_count: { left: 4, right: 4, delta: 0 },
      last_sequence: { left: 4, right: 4, delta: 0 },
      instance_count: { left: 1, right: 1, delta: 0 },
    },
    control: {
      had_pause: { left: false, right: false, equal: true },
      had_resume: { left: false, right: false, equal: true },
      terminal_cancelled: { left: false, right: false, equal: true },
    },
    experience: {
      left_present: false,
      right_present: false,
      left_experience_id: null,
      right_experience_id: null,
      structure_fingerprint: null,
      retry_family_counts_equal: null,
      decisions: null,
      failed_instance_count: null,
      failure_category: null,
    },
    ...overrides,
  };
}

function renderAt(path: string): HTMLDivElement {
  const el = document.createElement("div");
  document.body.appendChild(el);
  act(() => {
    createRoot(el).render(
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/compare" element={<ComparePage />} />
        </Routes>
      </MemoryRouter>,
    );
  });
  return el;
}

test("ComparePage prompts for ids when query params missing", () => {
  const el = renderAt("/compare");
  expect(el.textContent).toContain("Set left_run_id and right_run_id");
  expect(el.querySelector(".compare-document")).toBeNull();
});

test("ComparePage POSTs comparisons and renders document sections", async () => {
  const doc = sampleDoc();
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => doc,
  });
  vi.stubGlobal("fetch", fetchMock);

  const el = renderAt("/compare?left_run_id=run_a&right_run_id=run_b");
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });

  expect(fetchMock).toHaveBeenCalled();
  const [url, init] = fetchMock.mock.calls[0];
  expect(String(url)).toBe("/v1/comparisons");
  expect(init?.method).toBe("POST");
  expect(JSON.parse(String(init?.body))).toEqual({
    left_run_id: "run_a",
    right_run_id: "run_b",
  });

  const text = el.textContent ?? "";
  expect(text).toContain("cmp_run_a__run_b");
  expect(text).toContain("completeness");
  expect(text).toContain("full");
  expect(text).toContain("Outcome");
  expect(text).toContain("Why?");
  expect(text).toContain("decision: changed");
  expect(text).toContain("Topology");
  expect(text).toContain("Timing");
  expect(text).toContain("Control");
  expect(text).toContain("Experience");
  expect(text.toLowerCase()).not.toContain("better");
  expect(text.toLowerCase()).not.toContain("winner");
  expect(text.toLowerCase()).not.toContain("preferred");
  expect(el.querySelector('[data-testid="fetched-at"]')).not.toBeNull();
});

test("ComparePage surfaces API errors without inventing a document", async () => {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: false,
    status: 404,
    json: async () => ({ detail: "unknown run: run_missing" }),
  });
  vi.stubGlobal("fetch", fetchMock);

  const el = renderAt("/compare?left_run_id=run_a&right_run_id=run_missing");
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });

  expect(el.querySelector(".compare-error")?.textContent).toContain("unknown run: run_missing");
  expect(el.querySelector(".compare-document")).toBeNull();
});

test("ComparePage rejects identical ids client-side", async () => {
  const fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);

  const el = renderAt("/compare?left_run_id=run_a&right_run_id=run_a");
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });

  expect(fetchMock).not.toHaveBeenCalled();
  expect(el.querySelector(".compare-error")?.textContent).toContain("must differ");
});
