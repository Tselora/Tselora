import { act } from "react";
import { createRoot } from "react-dom/client";

import { NodeInspector } from "../components/NodeInspector";
import type { NodeState, TimelineEntry } from "../types/projection";

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

function baseNode(overrides: Partial<NodeState> = {}): NodeState {
  return {
    logical_node_id: "search_web",
    node_type: "tool",
    execution_instance_id: "search_web#1",
    status: "completed",
    started_event_id: "e2",
    parent_event_id: "e1",
    last_sequence: 3,
    payload: null,
    metadata: null,
    ...overrides,
  };
}

function renderInspector(
  node: NodeState | null,
  extra: { nodes?: NodeState[]; timelineEntries?: TimelineEntry[] } = {},
) {
  const el = document.createElement("div");
  document.body.appendChild(el);
  const nodes = extra.nodes ?? (node != null ? [node] : []);
  act(() => {
    createRoot(el).render(
      <NodeInspector node={node} nodes={nodes} timelineEntries={extra.timelineEntries ?? []} />,
    );
  });
  return el;
}

test("NodeInspector renders projected payload", () => {
  const el = renderInspector(baseNode({ payload: { query: "q" } }));
  expect(el.textContent).toContain('{"query":"q"}');
});

test("NodeInspector renders projected metadata", () => {
  const el = renderInspector(baseNode({ metadata: { framework: "custom-python" } }));
  expect(el.textContent).toContain('{"framework":"custom-python"}');
});

test("NodeInspector renders empty state when payload and metadata are absent", () => {
  const el = renderInspector(baseNode());
  const payloadDt = [...el.querySelectorAll("dt")].find((n) => n.textContent === "payload");
  const metadataDt = [...el.querySelectorAll("dt")].find((n) => n.textContent === "metadata");
  expect(payloadDt?.nextElementSibling?.textContent).toBe("—");
  expect(metadataDt?.nextElementSibling?.textContent).toBe("—");
});

test("NodeInspector does not invent values", () => {
  const el = renderInspector(baseNode());
  expect(el.textContent).not.toContain("score");
  expect(el.textContent).not.toContain("threshold");
  expect(el.textContent).not.toContain("error_type");
  expect(el.textContent).not.toContain("insufficient_source_coverage");
});

function whySection(el: HTMLElement): HTMLElement {
  const heading = [...el.querySelectorAll("h3")].find((n) => n.textContent === "Why?");
  expect(heading).toBeTruthy();
  return heading!.parentElement as HTMLElement;
}

test("Why? allowlist matches the official decision-evidence contract keys", () => {
  const el = renderInspector(
    baseNode({
      payload: {
        trigger: "verification_failed",
        evidence: 7,
        threshold: 85,
        score: 63,
        decision: "replan",
        selected_strategy: "research_branch_B",
        failure_category: "insufficient_source_coverage",
        action: "replan",
        query: "not-why",
      },
    }),
  );
  const whyDts = [...whySection(el).querySelectorAll("dt")].map((n) => n.textContent);
  expect(whyDts).toEqual([
    "Trigger",
    "Evidence",
    "Threshold",
    "Score",
    "Decision",
    "Selected strategy",
    "Failure category",
    "Action",
  ]);
  expect(whySection(el).textContent).not.toContain("not-why");
  expect(el.textContent).toContain("not-why");
});

test("Why? renders allowlisted payload fields with labels", () => {
  const el = renderInspector(
    baseNode({
      payload: {
        trigger: "verification_failed",
        evidence: 7,
        threshold: 85,
        score: 63,
        decision: "replan",
        selected_strategy: "research_branch_B",
        failure_category: "insufficient_source_coverage",
        action: "replan",
      },
    }),
  );
  const dts = [...el.querySelectorAll("dt")].map((n) => n.textContent);
  expect(dts).toEqual(
    expect.arrayContaining([
      "Trigger",
      "Evidence",
      "Threshold",
      "Score",
      "Decision",
      "Selected strategy",
      "Failure category",
      "Action",
    ]),
  );
  expect(el.textContent).toContain("verification_failed");
  expect(el.textContent).toContain("7");
  expect(el.textContent).toContain("85");
  expect(el.textContent).toContain("63");
  expect(el.textContent).toContain("research_branch_B");
  expect(el.textContent).toContain("insufficient_source_coverage");
  expect(el.textContent).not.toContain("17/20");
});

test("Why? is empty for unrelated payload fields", () => {
  const el = renderInspector(baseNode({ payload: { query: "q" } }));
  expect(whySection(el).textContent).toContain("No structured decision fields were emitted.");
  expect([...el.querySelectorAll("dt")].map((n) => n.textContent)).not.toContain("Trigger");
  expect(el.textContent).toContain('{"query":"q"}');
  expect(el.textContent).not.toContain("score");
  expect(el.textContent).not.toContain("threshold");
  expect(el.textContent).not.toContain("17/20");
});

test("Why? is empty for null payload and does not invent fields", () => {
  const el = renderInspector(baseNode({ payload: null }));
  expect(el.textContent).toContain("No structured decision fields were emitted.");
  expect(el.textContent).not.toContain("Score");
  expect(el.textContent).not.toContain("Threshold");
  expect(el.textContent).not.toContain("replan");
});

test("Why? ignores metadata-only nodes while metadata JSON remains", () => {
  const el = renderInspector(
    baseNode({
      payload: null,
      metadata: { framework: "custom-python", score: 99 },
    }),
  );
  expect(el.textContent).toContain("No structured decision fields were emitted.");
  expect(el.textContent).toContain('{"framework":"custom-python","score":99}');
  const scoreDt = [...el.querySelectorAll("dt")].find((n) => n.textContent === "Score");
  expect(scoreDt).toBeUndefined();
});

test("Why? does not show historical similar-run copy unless it is in payload", () => {
  const without = renderInspector(baseNode({ payload: { score: 63 } }));
  expect(without.textContent).not.toContain("17/20");
  expect(without.textContent).not.toContain("similar runs");
  const withHist = renderInspector(baseNode({ payload: { evidence: "17/20 similar runs succeeded" } }));
  expect(withHist.textContent).toContain("17/20 similar runs succeeded");
});

test("Why? stringifies non-scalar allowlisted values", () => {
  const el = renderInspector(baseNode({ payload: { evidence: { sources: 7 } } }));
  const evidenceDt = [...el.querySelectorAll("dt")].find((n) => n.textContent === "Evidence");
  expect(evidenceDt?.nextElementSibling?.textContent).toBe('{"sources":7}');
});

test("Details heading and missing selection copy", () => {
  const el = renderInspector(null);
  expect(el.querySelector("h2")?.textContent).toBe("Details");
  expect(el.textContent).toContain("Select an execution from the graph, Executions, or Activity Timeline.");
});

test("selected execution uses executionPresentation and NodeState.status", () => {
  const failed = baseNode({ status: "failed" });
  const completed = baseNode({
    execution_instance_id: "search_web#2",
    status: "completed",
    last_sequence: 8,
  });
  const plan1 = baseNode({
    logical_node_id: "plan",
    execution_instance_id: "plan#1",
    status: "completed",
  });
  const plan2 = baseNode({
    logical_node_id: "plan",
    execution_instance_id: "plan#2",
    status: "completed",
  });
  const retry = renderInspector(completed, { nodes: [failed, completed] });
  expect(retry.querySelector(".details-title")?.textContent).toBe("Search Web");
  expect(retry.textContent).toContain("Attempt 2");
  expect(retry.textContent).toContain("Completed");
  expect(retry.textContent).not.toContain("Attempt 1");
  const failedView = renderInspector(failed, { nodes: [failed, completed] });
  expect(failedView.textContent).toContain("Attempt 1");
  expect(failedView.querySelector(".details-status")?.textContent).toBe("Failed");
  const repeated = renderInspector(plan2, { nodes: [plan1, plan2] });
  expect(repeated.textContent).toContain("Plan");
  expect(repeated.textContent).toContain("Execution 2 of 2");
  expect(repeated.textContent).not.toContain("Attempt");
  const lone = renderInspector(baseNode());
  expect(lone.textContent).toContain("Execution 1 of 1");
  expect(lone.textContent).not.toContain("Attempt");
  expect(retry.textContent).not.toMatch(/\bLoop\b|\bIteration\b|\bParallel\b|\bRetry\b/);
});

test("Why? is above closed Technical details and existing fields remain", () => {
  const entries: TimelineEntry[] = [
    {
      event_id: "e2",
      sequence: 2,
      type: "tool.started",
      status: "started",
      node_id: "search_web",
      execution_instance_id: "search_web#1",
      parent_event_id: "e1",
    },
  ];
  const el = renderInspector(
    baseNode({ payload: { query: "q" }, metadata: { framework: "custom-python" } }),
    { timelineEntries: entries },
  );
  const why = [...el.querySelectorAll("h3")].find((n) => n.textContent === "Why?");
  const tech = el.querySelector("details");
  expect(why).toBeTruthy();
  expect(tech).toBeTruthy();
  expect(tech?.open).toBe(false);
  expect(tech?.querySelector("summary")?.textContent).toBe("Technical details");
  expect(why!.compareDocumentPosition(tech as Node) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(el.textContent).toContain("node_type");
  expect(el.textContent).toContain("tool");
  expect(el.textContent).toContain('{"query":"q"}');
  expect(el.textContent).toContain('{"framework":"custom-python"}');
  expect(tech?.textContent).toContain("tool.started");
  expect(tech?.textContent).toContain("e2");
  expect(tech?.textContent).toContain("Timeline for instance");
});
