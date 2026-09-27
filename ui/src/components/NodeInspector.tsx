import { Fragment } from "react";

import { executionPresentation, humanizeStatus } from "../present";
import type { NodeState, TimelineEntry } from "../types/projection";

const WHY_FIELDS: { key: string; label: string }[] = [
  // Keep keys aligned with docs/architecture/decision-evidence.md and sdk.WHY_FIELD_KEYS.
  { key: "trigger", label: "Trigger" },
  { key: "evidence", label: "Evidence" },
  { key: "threshold", label: "Threshold" },
  { key: "score", label: "Score" },
  { key: "decision", label: "Decision" },
  { key: "selected_strategy", label: "Selected strategy" },
  { key: "failure_category", label: "Failure category" },
  { key: "action", label: "Action" },
];

function isScalar(value: unknown): value is string | number | boolean {
  return typeof value === "string" || typeof value === "number" || typeof value === "boolean";
}

function formatWhyValue(value: unknown): string {
  if (isScalar(value)) {
    return String(value);
  }
  return JSON.stringify(value);
}

function whyEntries(payload: Record<string, unknown> | null): { label: string; value: string }[] {
  if (payload == null) {
    return [];
  }
  const rows: { label: string; value: string }[] = [];
  for (const field of WHY_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(payload, field.key)) {
      rows.push({ label: field.label, value: formatWhyValue(payload[field.key]) });
    }
  }
  return rows;
}

export function NodeInspector({
  node,
  nodes,
  timelineEntries,
}: {
  node: NodeState | null;
  nodes: NodeState[];
  timelineEntries: TimelineEntry[];
}) {
  const why = node != null ? whyEntries(node.payload) : [];
  const present = node != null ? executionPresentation(nodes, node.execution_instance_id) : null;
  return (
    <section className="details-panel">
      <h2>Details</h2>
      {node == null ? (
        <p className="muted">Select an execution from the graph, Executions, or Activity Timeline.</p>
      ) : (
        <>
          <div className="details-header">
            <h3 className="details-title">{present?.title ?? ""}</h3>
            {present?.displayLabel ? <p className="details-label">{present.displayLabel}</p> : null}
            <p className={`details-status exec-status exec-status-${(node.status ?? "unknown").toLowerCase()}`}>
              {humanizeStatus(node.status)}
            </p>
          </div>
          <div className="why">
            <h3>Why?</h3>
            {why.length === 0 ? (
              <p className="muted">No structured decision fields were emitted.</p>
            ) : (
              <dl className="kv">
                {why.map((row) => (
                  <Fragment key={row.label}>
                    <dt>{row.label}</dt>
                    <dd>{row.value}</dd>
                  </Fragment>
                ))}
              </dl>
            )}
          </div>
          <details className="tech-details">
            <summary>Technical details</summary>
            <dl className="kv">
              <dt>logical_node_id</dt>
              <dd>{node.logical_node_id}</dd>
              <dt>node_type</dt>
              <dd>{node.node_type ?? "—"}</dd>
              <dt>execution_instance_id</dt>
              <dd>{node.execution_instance_id}</dd>
              <dt>started_event_id</dt>
              <dd>{node.started_event_id ?? "—"}</dd>
              <dt>parent_event_id</dt>
              <dd>{node.parent_event_id ?? "—"}</dd>
              <dt>last_sequence</dt>
              <dd>{node.last_sequence}</dd>
              <dt>payload</dt>
              <dd>
                {node.payload == null ? (
                  <span className="muted">—</span>
                ) : (
                  <pre>{JSON.stringify(node.payload)}</pre>
                )}
              </dd>
              <dt>metadata</dt>
              <dd>
                {node.metadata == null ? (
                  <span className="muted">—</span>
                ) : (
                  <pre>{JSON.stringify(node.metadata)}</pre>
                )}
              </dd>
            </dl>
            <h3>Timeline for instance</h3>
            {timelineEntries.length === 0 ? (
              <p className="muted">No timeline entries for this instance.</p>
            ) : (
              <ol className="timeline">
                {timelineEntries.map((entry) => (
                  <li key={entry.event_id}>
                    <span className="seq">{entry.sequence}</span>
                    <span>{entry.type}</span>
                    <span className="muted">{entry.event_id}</span>
                    {entry.status ? <span>{entry.status}</span> : null}
                  </li>
                ))}
              </ol>
            )}
          </details>
        </>
      )}
    </section>
  );
}
