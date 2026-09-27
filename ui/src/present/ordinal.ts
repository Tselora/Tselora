import type { NodeState } from "../types/projection";

/** 1-based position among nodes sharing ``logicalNodeId``, in existing array order. 0 if missing. */

export function ordinalAmongLogical(
  nodes: NodeState[],
  logicalNodeId: string,
  executionInstanceId: string,
): number {
  const family = nodes.filter((node) => node.logical_node_id === logicalNodeId);
  const index = family.findIndex((node) => node.execution_instance_id === executionInstanceId);
  return index < 0 ? 0 : index + 1;
}

export function totalAmongLogical(nodes: NodeState[], logicalNodeId: string): number {
  return nodes.filter((node) => node.logical_node_id === logicalNodeId).length;
}
