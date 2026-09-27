import type { NodeState } from "../types/projection";

import { titleCaseLogicalNodeId } from "./titleCase";

/** Display name from the first agent node, else first node, else run id. No invented titles. */

export function runDisplayName(nodes: NodeState[], runId: string | null | undefined): string {
  const agent = nodes.find((node) => node.node_type === "agent");
  const source = agent ?? nodes[0];
  if (source != null) {
    return titleCaseLogicalNodeId(source.logical_node_id);
  }
  if (runId != null && runId.length > 0) {
    return runId;
  }
  return "Run";
}

export function humanizeStatus(status: string | null): string {
  if (status == null || status.length === 0) {
    return "Unknown";
  }
  return titleCaseLogicalNodeId(status.replace(/\s+/g, "_"));
}
