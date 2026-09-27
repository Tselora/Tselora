import { humanizeStatus, timelinePresentation, titleCaseLogicalNodeId } from "../present";
import type { NodeState, TimelineState } from "../types/projection";

function activateOnKey(
  event: { key: string; preventDefault: () => void },
  action: () => void,
) {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    action();
  }
}

export function Timeline({
  timeline,
  nodes,
  selectedInstanceId,
  onSelectInstance,
}: {
  timeline: TimelineState;
  nodes: NodeState[];
  selectedInstanceId?: string | null;
  onSelectInstance?: (executionInstanceId: string) => void;
}) {
  const rows = timelinePresentation(timeline.entries, nodes);
  return (
    <section>
      <h2>Activity Timeline</h2>
      {rows.length === 0 ? (
        <p className="muted">No timeline entries.</p>
      ) : (
        <ol className="activity-timeline">
          {rows.map((row) => {
            const selectable = row.executionInstanceId != null;
            const selected = selectable && row.executionInstanceId === selectedInstanceId;
            const title = row.title ?? titleCaseLogicalNodeId(row.type);
            return (
              <li
                key={row.eventId}
                className={selected ? "selected" : undefined}
                data-event-id={row.eventId}
                data-sequence={String(row.sequence)}
                data-execution-instance-id={row.executionInstanceId ?? ""}
                data-selectable={selectable ? "true" : "false"}
                aria-selected={selected}
                tabIndex={selectable ? 0 : undefined}
                onClick={() => {
                  if (row.executionInstanceId != null && onSelectInstance != null) {
                    onSelectInstance(row.executionInstanceId);
                  }
                }}
                onKeyDown={(event) => {
                  if (row.executionInstanceId != null && onSelectInstance != null) {
                    activateOnKey(event, () => onSelectInstance(row.executionInstanceId!));
                  }
                }}
              >
                <div className="activity-primary">
                  <span className="seq">{row.sequence}</span>
                  <span className="activity-title">{title}</span>
                  {row.displayLabel ? <span className="activity-label">{row.displayLabel}</span> : null}
                  {row.status ? (
                    <span className={`exec-status exec-status-${row.status.toLowerCase()}`}>
                      {humanizeStatus(row.status)}
                    </span>
                  ) : null}
                </div>
                <div className="activity-tech muted">
                  <span>{row.type}</span>
                  <span>{row.eventId}</span>
                  {row.parentEventId ? <span>{row.parentEventId}</span> : null}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
