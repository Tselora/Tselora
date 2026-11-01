import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, vi } from "vitest";

import { NearMissPage } from "./NearMissPage";
import type { NearMissList, NearMissRecord } from "../types/nearMiss";

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function record(overrides: Partial<NearMissRecord> = {}): NearMissRecord {
  return {
    run_id: "run_ok",
    logical_node_id: "search_web",
    failed_execution_instance_id: "search_web#1",
    recovery_execution_instance_id: "search_web#2",
    run_status: "completed",
    failure_category: "timeout",
    recovery_action: "retry_search",
    structure_fingerprint: "sha256:same",
    experience_id: "exp_run_ok",
    ...overrides,
  };
}

function envelope(overrides: Partial<NearMissList> = {}): NearMissList {
  return {
    near_misses: [record()],
    failures: [],
    truncated: false,
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
          <Route path="/near-misses" element={<NearMissPage />} />
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

test("NearMissPage loads GET /v1/near-misses with no query", async () => {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => envelope(),
  });
  vi.stubGlobal("fetch", fetchMock);

  const el = renderAt("/near-misses");
  await flush();

  expect(String(fetchMock.mock.calls[0][0])).toBe("/v1/near-misses");
  expect(el.querySelector('[data-testid="near-miss-count"]')?.textContent).toBe("Count: 1");
  expect(el.textContent).toContain("search_web#1");
  expect(el.textContent).toContain("search_web#2");
  const openRun = [...el.querySelectorAll('[data-testid="near-miss-list"] a')].find(
    (a) => a.textContent === "Open run",
  );
  expect(openRun?.getAttribute("href")).toBe("/runs/run_ok");
  const learn = [...el.querySelectorAll('[data-testid="near-miss-list"] a')].find(
    (a) => a.textContent === "Learn",
  );
  expect(learn?.getAttribute("href")).toBe("/learn?run_id=run_ok");
  const text = (el.textContent ?? "").toLowerCase();
  expect(text).not.toContain("similar");
  expect(text).not.toContain("reliability map");
  expect(text).not.toContain("winner");
});

test("NearMissPage sends filter query params from the URL", async () => {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => envelope({ near_misses: [] }),
  });
  vi.stubGlobal("fetch", fetchMock);

  const el = renderAt("/near-misses?run_id=run_ok&failure_category=timeout");
  await flush();

  expect(String(fetchMock.mock.calls[0][0])).toBe(
    "/v1/near-misses?run_id=run_ok&failure_category=timeout",
  );
  expect(el.textContent).toContain("No derived near-misses for these filters.");
});

test("NearMissPage rejects an unsafe run_id without calling the API", async () => {
  const fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  const el = renderAt("/near-misses?run_id=../x");
  await flush();
  expect(fetchMock).not.toHaveBeenCalled();
  expect(el.querySelector(".compare-error")?.textContent).toContain("unsafe run_id");
});

test("NearMissPage shows truncated and projection failures", async () => {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () =>
      envelope({
        truncated: true,
        failures: [{ run_id: "run_bad", message: "malformed event log" }],
      }),
  });
  vi.stubGlobal("fetch", fetchMock);

  const el = renderAt("/near-misses");
  await flush();

  expect(el.querySelector('[data-testid="near-miss-truncated"]')?.textContent).toContain(
    "List truncated at collector cap",
  );
  expect(el.querySelector('[data-testid="near-miss-failures"]')?.textContent).toContain("run_bad");
  expect(el.querySelector('[data-testid="near-miss-failures"]')?.textContent).toContain(
    "malformed event log",
  );
});

test("NearMissPage omits optional Experience fields when the collector leaves them off", async () => {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () =>
      envelope({
        near_misses: [
          record({
            failure_category: undefined,
            recovery_action: undefined,
            structure_fingerprint: undefined,
            experience_id: undefined,
          }),
        ],
      }),
  });
  vi.stubGlobal("fetch", fetchMock);

  const el = renderAt("/near-misses");
  await flush();

  expect(el.textContent).toContain("—");
  expect(el.querySelector('[data-testid="near-miss-list"]')?.textContent).toContain("search_web");
});
