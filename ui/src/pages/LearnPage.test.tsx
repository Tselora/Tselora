import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, vi } from "vitest";

import { LearnPage } from "./LearnPage";
import type { Experience } from "../types/experience";

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function experience(runId: string, overrides: Partial<Experience> = {}): Experience {
  return {
    experience_id: `exp_${runId}`,
    run_id: runId,
    schema_version: "0.1",
    created_at: "2026-09-26T00:00:00Z",
    source_last_sequence: 2,
    status: "completed",
    started_event_id: "e1",
    logical_node_ids: [],
    node_types: [],
    instance_count: 0,
    edge_count: 0,
    retry_family_counts: {},
    decisions: [{ decision: "accept" }],
    failed_instances: [],
    had_pause: false,
    had_resume: false,
    terminal_cancelled: false,
    event_count: 2,
    last_sequence: 2,
    first_timestamp: null,
    last_timestamp: null,
    structure_fingerprint: "sha256:same",
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
          <Route path="/learn" element={<LearnPage />} />
        </Routes>
      </MemoryRouter>,
    );
  });
  return el;
}

async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

test("LearnPage prompts for run_id and does not call the API", () => {
  const fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  const el = renderAt("/learn");
  expect(el.textContent).toContain("Set run_id to load an exact structure cohort");
  expect(fetchMock).not.toHaveBeenCalled();
});

test("LearnPage loads the anchor then queries its exact fingerprint in server order", async () => {
  const anchor = experience("run_anchor", { created_at: "2026-09-26T00:00:03Z" });
  const older = experience("run_older", { created_at: "2026-09-26T00:00:02Z" });
  const newest = experience("run_newest", { created_at: "2026-09-26T00:00:04Z" });
  const cohort = [newest, anchor, older];
  const fetchMock = vi.fn();
  fetchMock.mockImplementation(async (url: string) => {
    if (String(url).includes("/v1/experiences/query")) {
      return { ok: true, status: 200, json: async () => cohort };
    }
    return { ok: true, status: 200, json: async () => anchor };
  });
  vi.stubGlobal("fetch", fetchMock);

  const el = renderAt("/learn?run_id=run_anchor");
  await flush();

  expect(String(fetchMock.mock.calls[0][0])).toBe("/v1/experiences/exp_run_anchor");
  const queryCall = fetchMock.mock.calls[1];
  expect(String(queryCall[0])).toBe("/v1/experiences/query");
  expect(queryCall[1]?.method).toBe("POST");
  expect(JSON.parse(String(queryCall[1]?.body))).toEqual({
    structure_fingerprint: "sha256:same",
  });

  expect(el.querySelector('[data-testid="cohort-count"]')?.textContent).toBe("Cohort count: 3");
  const runs = [...el.querySelectorAll('[data-testid="cohort-list"] li')].map((li) => li.textContent ?? "");
  expect(runs).toHaveLength(3);
  expect(runs[0]).toContain("run_newest");
  expect(runs[1]).toContain("run_anchor");
  expect(runs[1]).toContain("anchor");
  expect(runs[2]).toContain("run_older");
  expect(el.textContent).not.toContain("other experiences");

  const compare = [...el.querySelectorAll("a")].find((a) => a.textContent === "Compare with anchor");
  expect(compare?.getAttribute("href")).toBe(
    "/compare?left_run_id=run_anchor&right_run_id=run_newest",
  );
  const anchorRow = el.querySelectorAll('[data-testid="cohort-list"] li')[1];
  expect(anchorRow?.textContent).not.toContain("Compare with anchor");

  const text = (el.textContent ?? "").toLowerCase();
  expect(text).not.toContain("similar");
  expect(text).not.toContain("better");
  expect(text).not.toContain("recommended");
  expect(text).not.toContain("winner");
  expect(text).not.toContain("preferred");
});

test("LearnPage reports the full cohort count when the anchor is included", async () => {
  const anchor = experience("run_anchor");
  const others = ["r1", "r2", "r3", "r4", "r5", "r6"].map((id) => experience(id));
  const cohort = [anchor, ...others];
  expect(cohort).toHaveLength(7);
  const fetchMock = vi.fn();
  fetchMock.mockImplementation(async (url: string) => {
    if (String(url).includes("/query")) {
      return { ok: true, status: 200, json: async () => cohort };
    }
    return { ok: true, status: 200, json: async () => anchor };
  });
  vi.stubGlobal("fetch", fetchMock);

  const el = renderAt("/learn?run_id=run_anchor");
  await flush();

  expect(el.querySelector('[data-testid="cohort-count"]')?.textContent).toBe("Cohort count: 7");
  expect(el.querySelectorAll('[data-testid="cohort-list"] li')).toHaveLength(7);
  expect(el.querySelectorAll('[data-testid="anchor-marker"]')).toHaveLength(1);
});

test("LearnPage shows no Experience on 404 and does not query", async () => {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: false,
    status: 404,
    json: async () => ({ detail: "unknown experience: exp_run_missing" }),
  });
  vi.stubGlobal("fetch", fetchMock);

  const el = renderAt("/learn?run_id=run_missing");
  await flush();

  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(el.textContent).toContain("no Experience for this run");
  expect(el.querySelector('[data-testid="cohort-count"]')).toBeNull();
  expect(el.querySelector('[data-testid="learn-anchor"]')).toBeNull();
});

test("LearnPage rejects an unsafe run_id without calling the API", async () => {
  const fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  const el = renderAt("/learn?run_id=../x");
  await flush();
  expect(fetchMock).not.toHaveBeenCalled();
  expect(el.querySelector(".compare-error")?.textContent).toContain("unsafe run_id");
});

test("LearnPage applies filters as the query body and refresh repeats that body", async () => {
  const anchor = experience("run_anchor");
  const fetchMock = vi.fn();
  fetchMock.mockImplementation(async (url: string) => {
    if (String(url).includes("/query")) {
      return { ok: true, status: 200, json: async () => [anchor] };
    }
    return { ok: true, status: 200, json: async () => anchor };
  });
  vi.stubGlobal("fetch", fetchMock);

  const el = renderAt("/learn?run_id=run_anchor");
  await flush();

  const status = el.querySelector('select[name="status"]') as HTMLSelectElement;
  const limit = el.querySelector('input[name="limit"]') as HTMLInputElement;
  const decision = el.querySelector('input[name="decision"]') as HTMLInputElement;
  function setValue(node: HTMLInputElement | HTMLSelectElement, value: string) {
    const prototype =
      node instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, "value")?.set?.call(node, value);
    node.dispatchEvent(new Event("input", { bubbles: true }));
    node.dispatchEvent(new Event("change", { bubbles: true }));
  }
  await act(async () => {
    setValue(status, "completed");
    setValue(limit, "7");
    setValue(decision, "accept");
  });
  const apply = [...el.querySelectorAll("button")].find((b) => b.textContent === "Apply filters");
  await act(async () => {
    apply?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await Promise.resolve();
    await Promise.resolve();
  });

  const queryBodies = fetchMock.mock.calls
    .filter((call) => String(call[0]).includes("/query"))
    .map((call) => JSON.parse(String((call[1] as RequestInit | undefined)?.body)));
  expect(queryBodies.at(-1)).toEqual({
    structure_fingerprint: "sha256:same",
    status: "completed",
    decision: "accept",
    limit: 7,
  });
  expect(el.querySelector('[data-testid="cohort-count"]')?.textContent).toContain("showing up to 7");

  const refresh = [...el.querySelectorAll("button")].find((b) => b.textContent === "Refresh");
  await act(async () => {
    refresh?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await Promise.resolve();
    await Promise.resolve();
  });
  const afterRefresh = fetchMock.mock.calls
    .filter((call) => String(call[0]).includes("/query"))
    .map((call) => JSON.parse(String((call[1] as RequestInit | undefined)?.body)));
  expect(afterRefresh.at(-1)).toEqual(queryBodies.at(-1));
});

test("LearnPage keeps the anchor visible when the cohort is empty", async () => {
  const anchor = experience("run_anchor");
  const fetchMock = vi.fn();
  fetchMock.mockImplementation(async (url: string) => {
    if (String(url).includes("/query")) {
      return { ok: true, status: 200, json: async () => [] };
    }
    return { ok: true, status: 200, json: async () => anchor };
  });
  vi.stubGlobal("fetch", fetchMock);

  const el = renderAt("/learn?run_id=run_anchor");
  await flush();

  expect(el.querySelector('[data-testid="learn-anchor"]')?.textContent).toContain("exp_run_anchor");
  expect(el.querySelector('[data-testid="cohort-count"]')?.textContent).toBe("Cohort count: 0");
  expect(el.textContent).toContain("No experiences in this cohort.");
});
