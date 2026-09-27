import { act, type ReactElement } from "react";
import { createRoot } from "react-dom/client";
import { vi } from "vitest";

import { LiveBadge } from "./LiveBadge";
import { ReplayScrubber } from "./ReplayScrubber";
import { RunHeader } from "./RunHeader";
import type { NodeState, RunState, TimelineState } from "../types/projection";

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

function node(logical: string, type: string): NodeState {
  return {
    logical_node_id: logical,
    node_type: type,
    execution_instance_id: `${logical}#1`,
    status: "completed",
    started_event_id: "s",
    parent_event_id: "p",
    last_sequence: 2,
    payload: null,
    metadata: null,
  };
}

test("RunHeader humanizes agent name and counts without raw sequence as summary", () => {
  const run: RunState = {
    run_id: "run_abc",
    status: "completed",
    started_event_id: "e1",
    last_sequence: 22,
    checkpoints: [],
    forked_from_run_id: null,
    fork_source_checkpoint_id: null,
    fork_source_event_id: null,
    child_run_ids: [],
  };
  const timeline: TimelineState = {
    entries: [
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
        event_id: "e2",
        sequence: 2,
        type: "agent.started",
        status: "started",
        node_id: "research",
        execution_instance_id: "research#1",
        parent_event_id: "e1",
      },
    ],
  };
  const el = render(
    <RunHeader
      run={run}
      nodes={[node("research", "agent"), node("plan", "node")]}
      timeline={timeline}
      view="live"
      status="live"
    />,
  );
  expect(el.textContent).toContain("Research");
  expect(el.textContent).toContain("Completed");
  expect(el.textContent).toContain("Executions");
  expect(el.textContent).toContain("2");
  expect(el.textContent).toContain("Events");
  expect(el.querySelector("h2")?.textContent).toBe("Research");
  expect(el.textContent).not.toContain("last_sequence");
  expect(el.textContent).not.toContain("started_event_id");
  // Terminal live run: control strip hidden.
  expect(el.querySelector(".run-controls")).toBeNull();
  expect(el.textContent).not.toContain("Pause");
});

test("RunHeader shows live controls for running status and posts commands", async () => {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ status: "accepted", command_id: "cmd_1", run_id: "run_live" }),
  });
  vi.stubGlobal("fetch", fetchMock);
  const run: RunState = {
    run_id: "run_live",
    status: "running",
    started_event_id: "e1",
    last_sequence: 3,
    checkpoints: [],
    forked_from_run_id: null,
    fork_source_checkpoint_id: null,
    fork_source_event_id: null,
    child_run_ids: [],
  };
  const timeline: TimelineState = { entries: [] };
  const el = render(
    <RunHeader run={run} nodes={[]} timeline={timeline} view="live" status="live" />,
  );
  const pause = [...el.querySelectorAll("button")].find((b) => b.textContent === "Pause") as HTMLButtonElement;
  const resume = [...el.querySelectorAll("button")].find((b) => b.textContent === "Resume") as HTMLButtonElement;
  const stop = [...el.querySelectorAll("button")].find((b) => b.textContent === "Stop") as HTMLButtonElement;
  expect(pause.disabled).toBe(false);
  expect(resume.disabled).toBe(true);
  expect(stop.disabled).toBe(false);
  await act(async () => {
    pause.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  expect(fetchMock).toHaveBeenCalledTimes(1);
  const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
  expect(String(fetchMock.mock.calls[0][0])).toContain("/v1/runs/run_live/commands");
  const body = JSON.parse(String(init.body)) as { type: string; command_id: string; run_id: string };
  expect(body.type).toBe("pause");
  expect(body.run_id).toBe("run_live");
  expect(body.command_id.startsWith("cmd_")).toBe(true);
  // No optimistic status change — still shows Running from props.
  expect(el.textContent).toContain("Running");
  vi.unstubAllGlobals();
});

test("RunHeader hides controls in historical view", () => {
  const run: RunState = {
    run_id: "run_hist",
    status: "running",
    started_event_id: "e1",
    last_sequence: 3,
    checkpoints: [],
    forked_from_run_id: null,
    fork_source_checkpoint_id: null,
    fork_source_event_id: null,
    child_run_ids: [],
  };
  const el = render(
    <RunHeader
      run={run}
      nodes={[]}
      timeline={{ entries: [] }}
      view="historical"
      status="live"
    />,
  );
  expect(el.querySelector(".run-controls")).toBeNull();
  expect(el.textContent).not.toContain("Pause");
});

test("RunHeader shows no_active_runtime message", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        status: "no_active_runtime",
        command_id: "cmd_x",
        run_id: "run_x",
      }),
    }),
  );
  const el = render(
    <RunHeader
      run={{
        run_id: "run_x",
        status: "running",
        started_event_id: "e1",
        last_sequence: 1,
        checkpoints: [],
        forked_from_run_id: null,
        fork_source_checkpoint_id: null,
        fork_source_event_id: null,
        child_run_ids: [],
      }}
      nodes={[]}
      timeline={{ entries: [] }}
      view="live"
      status="live"
    />,
  );
  const pause = [...el.querySelectorAll("button")].find((b) => b.textContent === "Pause")!;
  await act(async () => {
    pause.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  expect(el.textContent).toContain("No active runtime for this run.");
  expect(el.textContent).toContain("Running");
  vi.unstubAllGlobals();
});

test("LiveBadge shows Live, Historical, and Reconnecting", () => {
  expect(render(<LiveBadge view="live" status="live" />).textContent).toMatch(/●\s*Live/);
  expect(render(<LiveBadge view="historical" status="live" />).textContent).toMatch(/◷\s*Historical/);
  expect(render(<LiveBadge view="live" status="resyncing" />).textContent).toMatch(/○\s*Reconnecting/);
  expect(render(<LiveBadge view="live" status="loading" />).textContent).toMatch(/○\s*Reconnecting/);
  expect(render(<LiveBadge view="historical" status="resyncing" />).textContent).toMatch(/◷\s*Historical/);
});

test("ReplayScrubber copy and Previous/Next/Live behavior", () => {
  const onHistorical = vi.fn();
  const onLive = vi.fn();
  const el = render(
    <ReplayScrubber
      view="historical"
      throughSequence={12}
      tipLastSequence={22}
      onHistorical={onHistorical}
      onLive={onLive}
    />,
  );
  expect(el.textContent).toContain("Execution Replay");
  expect(el.textContent).toContain("This does not re-run the agent.");
  expect(el.textContent).toContain("Viewing execution at event 12 of 22");
  expect(el.textContent).not.toContain("through_sequence");
  const buttons = [...el.querySelectorAll("button")];
  expect(buttons.map((b) => b.textContent)).toEqual(["Previous", "Next", "Live"]);
  act(() => {
    buttons[0].dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  expect(onHistorical).toHaveBeenCalledWith(11);
  act(() => {
    buttons[1].dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  expect(onHistorical).toHaveBeenCalledWith(13);
  act(() => {
    buttons[2].dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  expect(onLive).toHaveBeenCalledTimes(1);
});

test("ReplayScrubber live uses tip as N of M and disables Live", () => {
  const onHistorical = vi.fn();
  const el = render(
    <ReplayScrubber
      view="live"
      throughSequence={null}
      tipLastSequence={22}
      onHistorical={onHistorical}
      onLive={() => undefined}
    />,
  );
  expect(el.textContent).toContain("Viewing execution at event 22 of 22");
  const live = [...el.querySelectorAll("button")].find((b) => b.textContent === "Live");
  expect((live as HTMLButtonElement).disabled).toBe(true);
  const prev = [...el.querySelectorAll("button")].find((b) => b.textContent === "Previous");
  act(() => {
    prev!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  expect(onHistorical).toHaveBeenCalledWith(21);
});
