import type { NodeState } from "../types/projection";

export function NodeList({ nodes }: { nodes: NodeState[] }) {
  return (
    <section>
      <h2>Nodes</h2>
      {nodes.length === 0 ? (
        <p className="muted">No node instances.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>logical_node_id</th>
              <th>execution_instance_id</th>
              <th>type</th>
              <th>status</th>
              <th>last_sequence</th>
            </tr>
          </thead>
          <tbody>
            {nodes.map((node) => (
              <tr key={node.execution_instance_id}>
                <td>{node.logical_node_id}</td>
                <td>{node.execution_instance_id}</td>
                <td>{node.node_type ?? "—"}</td>
                <td>{node.status ?? "—"}</td>
                <td>{node.last_sequence}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
