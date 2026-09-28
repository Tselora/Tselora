import { Handle, Position, type NodeProps } from "@xyflow/react";
import { memo } from "react";

import { humanizeStatus } from "../present";

export type ExecutionFlowNodeData = {
  title: string;
  displayLabel: string;
  nodeType: string | null;
  status: string | null;
  executionInstanceId: string;
};

function statusClass(status: string | null): string {
  const key = (status ?? "").toLowerCase();
  if (key === "failed") {
    return "failed";
  }
  if (key === "cancelled") {
    return "cancelled";
  }
  if (key === "completed") {
    return "completed";
  }
  if (key === "started" || key === "running") {
    return "running";
  }
  return "other";
}

function ExecutionFlowNodeComponent({ data, selected }: NodeProps) {
  const payload = data as ExecutionFlowNodeData;
  const kind = statusClass(payload.status);
  return (
    <div
      className={`exec-node exec-node-${kind}${selected ? " selected" : ""}`}
      data-execution-instance-id={payload.executionInstanceId}
      data-status={payload.status ?? ""}
      title={payload.executionInstanceId}
    >
      <Handle type="target" position={Position.Left} />
      <div className="exec-node-title">{payload.title}</div>
      {payload.nodeType ? (
        <div className="exec-node-type" data-node-type={payload.nodeType}>
          {payload.nodeType}
        </div>
      ) : null}
      <div className="exec-node-label">{payload.displayLabel}</div>
      <div className="exec-node-status">
        <span className={`status-badge status-badge-${kind}`}>{humanizeStatus(payload.status)}</span>
      </div>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}

export const ExecutionFlowNode = memo(ExecutionFlowNodeComponent);
