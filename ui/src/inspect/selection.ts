import type { NodeState, TimelineEntry } from "../types/projection";

/** Same allowlist as Explorer Why? / sdk.WHY_FIELD_KEYS. */
export const WHY_FIELD_KEYS = [
  "trigger",
  "evidence",
  "threshold",
  "score",
  "decision",
  "selected_strategy",
  "failure_category",
  "action",
] as const;

function payloadHasWhy(payload: Record<string, unknown> | null): boolean {
  if (payload == null) {
    return false;
  }
  return WHY_FIELD_KEYS.some((key) => Object.prototype.hasOwnProperty.call(payload, key));
}

export function nodeByInstanceId(
  nodes: NodeState[],
  executionInstanceId: string | null,
): NodeState | null {
  if (executionInstanceId == null) {
    return null;
  }
  return nodes.find((node) => node.execution_instance_id === executionInstanceId) ?? null;
}

export function resolveSelection(
  nodes: NodeState[],
  executionInstanceId: string | null,
): string | null {
  const kept = nodeByInstanceId(nodes, executionInstanceId)?.execution_instance_id ?? null;
  if (kept != null) {
    return kept;
  }
  const withWhy = nodes.filter((node) => payloadHasWhy(node.payload));
  if (withWhy.length === 1) {
    return withWhy[0].execution_instance_id;
  }
  return null;
}

export function timelineForInstance(
  entries: TimelineEntry[],
  executionInstanceId: string | null,
): TimelineEntry[] {
  if (executionInstanceId == null) {
    return [];
  }
  return entries.filter((entry) => entry.execution_instance_id === executionInstanceId);
}
