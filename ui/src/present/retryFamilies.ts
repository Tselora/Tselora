import type { NodeState } from "../types/projection";

const TERMINAL_RETRY = new Set(["failed", "cancelled"]);

function isRetryStatus(status: string | null): boolean {
  return status != null && TERMINAL_RETRY.has(status.toLowerCase());
}

/** Logical ids where a failed/cancelled instance is followed by a later instance of the same id. */

export function retryFamilyLogicalIds(nodes: NodeState[]): Set<string> {
  const ids = new Set<string>();
  const byLogical = new Map<string, NodeState[]>();
  for (const node of nodes) {
    const list = byLogical.get(node.logical_node_id) ?? [];
    list.push(node);
    byLogical.set(node.logical_node_id, list);
  }
  for (const [logicalId, family] of byLogical) {
    for (let i = 0; i < family.length; i += 1) {
      if (isRetryStatus(family[i].status) && i < family.length - 1) {
        ids.add(logicalId);
        break;
      }
    }
  }
  return ids;
}

export function retryFamilies(nodes: NodeState[]): { logicalNodeId: string; instanceIds: string[] }[] {
  const ids = retryFamilyLogicalIds(nodes);
  const families: { logicalNodeId: string; instanceIds: string[] }[] = [];
  for (const logicalNodeId of ids) {
    families.push({
      logicalNodeId,
      instanceIds: nodes
        .filter((node) => node.logical_node_id === logicalNodeId)
        .map((node) => node.execution_instance_id),
    });
  }
  return families;
}
