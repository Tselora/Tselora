import { executionPresentations, humanizeStatus } from "../present";
import type { NodeState } from "../types/projection";

function activateOnKey(
  event: { key: string; preventDefault: () => void },
  action: () => void,
) {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    action();
  }
}

export function NodeList({
  nodes,
  selectedInstanceId,
  onSelectInstance,
}: {
  nodes: NodeState[];
  selectedInstanceId: string | null;
  onSelectInstance: (executionInstanceId: string) => void;
}) {
  const rows = executionPresentations(nodes);
  return (
    <section>
      <h2>Executions</h2>
      {nodes.length === 0 ? (
        <p className="muted">No executions.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Title</th>
              <th>Execution</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => {
              const node = nodes[index];
              const selected = row.executionInstanceId === selectedInstanceId;
              const status = node?.status ?? null;
              return (
                <tr
                  key={row.executionInstanceId}
                  className={selected ? "selected" : undefined}
                  aria-selected={selected}
                  tabIndex={0}
                  data-execution-instance-id={row.executionInstanceId}
                  data-status={status ?? ""}
                  title={row.executionInstanceId}
                  onClick={() => onSelectInstance(row.executionInstanceId)}
                  onKeyDown={(event) =>
                    activateOnKey(event, () => onSelectInstance(row.executionInstanceId))
                  }
                >
                  <td>{row.title}</td>
                  <td>{row.displayLabel}</td>
                  <td className={`exec-status exec-status-${(status ?? "unknown").toLowerCase()}`}>
                    {humanizeStatus(status)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </section>
  );
}
