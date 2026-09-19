import type { RunState } from "../types/projection";

export function RunStatus({ run }: { run: RunState }) {
  return (
    <section>
      <h2>Run</h2>
      <dl className="kv">
        <dt>run_id</dt>
        <dd>{run.run_id ?? "—"}</dd>
        <dt>status</dt>
        <dd>{run.status ?? "—"}</dd>
        <dt>started_event_id</dt>
        <dd>{run.started_event_id ?? "—"}</dd>
        <dt>last_sequence</dt>
        <dd>{run.last_sequence}</dd>
      </dl>
    </section>
  );
}
