import { Background, Position, ReactFlow, type Edge, type Node } from "@xyflow/react";
import { useMemo } from "react";

import { executionPresentation, siblingGroups, titleCaseLogicalNodeId } from "../present";
import type { GraphEdge, GraphState, NodeState } from "../types/projection";
import { ExecutionFlowNode, type ExecutionFlowNodeData } from "./ExecutionFlowNode";

import "@xyflow/react/dist/style.css";

const nodeTypes = { execution: ExecutionFlowNode };

const COLUMN = 220;
const ROW = 120;

export function ExecutionGraph({
  graph,
  projectedNodes,
  selectedInstanceId,
  onSelectInstance,
}: {
  graph: GraphState;
  projectedNodes: NodeState[];
  selectedInstanceId: string | null;
  onSelectInstance: (executionInstanceId: string) => void;
}) {
  const useInstances = graph.instance_ids.length > 0;
  const { nodes, edges } = useMemo(
    () => toFlow(graph, projectedNodes, selectedInstanceId),
    [graph, projectedNodes, selectedInstanceId],
  );
  return (
    <section>
      <h2>Execution Flow</h2>
      <div className="graph-canvas">
        {useInstances ? (
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            fitView
            nodesConnectable={false}
            onNodeClick={(_event, node) => {
              onSelectInstance(node.id);
            }}
          >
            <Background />
          </ReactFlow>
        ) : null}
      </div>
    </section>
  );
}

export function toFlow(
  graph: GraphState,
  projectedNodes: NodeState[],
  selectedInstanceId: string | null,
): { nodes: Node[]; edges: Edge[] } {
  const useInstances = graph.instance_ids.length > 0;
  const ids = useInstances ? graph.instance_ids : graph.logical_node_ids;
  const idSet = new Set(ids);
  const positions = layoutFromEdges(ids, graph.edges);
  const byInstance = new Map(projectedNodes.map((node) => [node.execution_instance_id, node]));
  const nodes: Node[] = ids.map((id, index) => {
    const projected = byInstance.get(id);
    const present = executionPresentation(projectedNodes, id);
    const title =
      present?.title ?? titleCaseLogicalNodeId(projected?.logical_node_id ?? logicalFromInstanceId(id));
    const displayLabel = present?.displayLabel ?? "";
    const data: ExecutionFlowNodeData = {
      title,
      displayLabel,
      nodeType: projected?.node_type ?? null,
      status: projected?.status ?? null,
      executionInstanceId: id,
    };
    const position = positions.get(id) ?? { x: 0, y: index * ROW };
    return {
      id,
      type: "execution",
      position,
      data,
      selected: useInstances && id === selectedInstanceId,
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
    };
  });
  const edges: Edge[] = [];
  for (const edge of graph.edges) {
    const source = useInstances ? edge.parent_instance_id : edge.parent_logical_id;
    const target = useInstances ? edge.child_instance_id : edge.child_logical_id;
    if (source == null || target == null || !idSet.has(source) || !idSet.has(target)) {
      continue;
    }
    edges.push({
      id: edge.child_event_id,
      source,
      target,
    });
  }
  return { nodes, edges };
}

/** Place each instance from existing edges. Sibling groups stack; missing parents stay roots. */
function layoutFromEdges(ids: string[], edges: GraphEdge[]): Map<string, { x: number; y: number }> {
  const idSet = new Set(ids);
  const graph: GraphState = { logical_node_ids: [], instance_ids: ids, edges };
  const childrenByParent = new Map<string, string[]>();
  for (const edge of edges) {
    const parent = edge.parent_instance_id;
    const child = edge.child_instance_id;
    if (parent == null || child == null || !idSet.has(parent) || !idSet.has(child)) {
      continue;
    }
    const list = childrenByParent.get(parent) ?? [];
    if (!list.includes(child)) {
      list.push(child);
    }
    childrenByParent.set(parent, list);
  }
  const grouped = new Map(
    siblingGroups(graph)
      .filter((group) => idSet.has(group.parentInstanceId))
      .map((group) => [group.parentInstanceId, group.childInstanceIds.filter((id) => idSet.has(id))]),
  );
  const childrenOf = (id: string): string[] => grouped.get(id) ?? childrenByParent.get(id) ?? [];
  const childIds = new Set<string>();
  for (const children of childrenByParent.values()) {
    for (const child of children) {
      childIds.add(child);
    }
  }
  const roots = ids.filter((id) => !childIds.has(id));
  const positions = new Map<string, { x: number; y: number }>();
  const placed = new Set<string>();

  function place(id: string, x: number, top: number): number {
    if (placed.has(id)) {
      return ROW;
    }
    placed.add(id);
    const children = childrenOf(id).filter((child) => !placed.has(child));
    if (children.length === 0) {
      positions.set(id, { x, y: top });
      return ROW;
    }
    let cursor = top;
    const childYs: number[] = [];
    for (const child of children) {
      const height = place(child, x + COLUMN, cursor);
      const childPosition = positions.get(child);
      if (childPosition != null) {
        childYs.push(childPosition.y);
      }
      cursor += height;
    }
    const y = childYs.length === 0 ? top : childYs.reduce((sum, value) => sum + value, 0) / childYs.length;
    positions.set(id, { x, y });
    return Math.max(cursor - top, ROW);
  }

  let top = 0;
  for (const root of roots) {
    top += place(root, 0, top);
  }
  for (const id of ids) {
    if (!positions.has(id)) {
      positions.set(id, { x: 0, y: top });
      top += ROW;
    }
  }
  return positions;
}

function logicalFromInstanceId(id: string): string {
  const hash = id.lastIndexOf("#");
  return hash === -1 ? id : id.slice(0, hash);
}
