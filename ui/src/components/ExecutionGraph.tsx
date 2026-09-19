import { Background, Position, ReactFlow, type Edge, type Node } from "@xyflow/react";
import { useMemo } from "react";

import type { GraphState } from "../types/projection";

import "@xyflow/react/dist/style.css";

export function ExecutionGraph({ graph }: { graph: GraphState }) {
  const { nodes, edges } = useMemo(() => toFlow(graph), [graph]);
  return (
    <section>
      <h2>Graph</h2>
      <div className="graph-canvas">
        <ReactFlow nodes={nodes} edges={edges} fitView nodesConnectable={false} elementsSelectable={false}>
          <Background />
        </ReactFlow>
      </div>
    </section>
  );
}

function toFlow(graph: GraphState): { nodes: Node[]; edges: Edge[] } {
  const useInstances = graph.instance_ids.length > 0;
  const ids = useInstances ? graph.instance_ids : graph.logical_node_ids;
  const idSet = new Set(ids);
  const nodes: Node[] = ids.map((id, index) => ({
    id,
    position: { x: (index % 4) * 200, y: Math.floor(index / 4) * 100 },
    data: { label: id },
    sourcePosition: Position.Right,
    targetPosition: Position.Left,
  }));
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
