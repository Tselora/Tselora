import type { TimelineState } from "../types/projection";

export function Timeline({ timeline }: { timeline: TimelineState }) {
  return (
    <section>
      <h2>Timeline</h2>
      {timeline.entries.length === 0 ? (
        <p className="muted">No timeline entries.</p>
      ) : (
        <ol className="timeline">
          {timeline.entries.map((entry) => (
            <li key={entry.event_id}>
              <span className="seq">{entry.sequence}</span>
              <span>{entry.type}</span>
              <span className="muted">{entry.event_id}</span>
              {entry.status ? <span>{entry.status}</span> : null}
              {entry.node_id ? <span>{entry.node_id}</span> : null}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
