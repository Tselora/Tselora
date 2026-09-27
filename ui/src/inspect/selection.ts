import type { NodeState, TimelineEntry } from "../types/projection";

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
  return nodeByInstanceId(nodes, executionInstanceId)?.execution_instance_id ?? null;
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
