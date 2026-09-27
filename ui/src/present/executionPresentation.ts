import type { NodeState } from "../types/projection";

import { ordinalAmongLogical, totalAmongLogical } from "./ordinal";
import { retryFamilyLogicalIds } from "./retryFamilies";
import { titleCaseLogicalNodeId } from "./titleCase";

export type ExecutionPresentation = {
  executionInstanceId: string;
  logicalNodeId: string;
  title: string;
  executionOrdinal: number;
  totalExecutions: number;
  inRetryFamily: boolean;
  attemptNumber: number | null;
  displayLabel: string;
};

export function executionPresentations(nodes: NodeState[]): ExecutionPresentation[] {
  const retryIds = retryFamilyLogicalIds(nodes);
  return nodes.map((node) => presentationFor(node, nodes, retryIds));
}

export function executionPresentation(
  nodes: NodeState[],
  executionInstanceId: string,
): ExecutionPresentation | null {
  return executionPresentations(nodes).find((row) => row.executionInstanceId === executionInstanceId) ?? null;
}

function presentationFor(
  node: NodeState,
  nodes: NodeState[],
  retryIds: Set<string>,
): ExecutionPresentation {
  const executionOrdinal = ordinalAmongLogical(nodes, node.logical_node_id, node.execution_instance_id);
  const totalExecutions = totalAmongLogical(nodes, node.logical_node_id);
  const inRetryFamily = retryIds.has(node.logical_node_id);
  return {
    executionInstanceId: node.execution_instance_id,
    logicalNodeId: node.logical_node_id,
    title: titleCaseLogicalNodeId(node.logical_node_id),
    executionOrdinal,
    totalExecutions,
    inRetryFamily,
    attemptNumber: inRetryFamily ? executionOrdinal : null,
    displayLabel: inRetryFamily
      ? `Attempt ${executionOrdinal}`
      : `Execution ${executionOrdinal} of ${totalExecutions}`,
  };
}
