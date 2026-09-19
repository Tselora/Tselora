import { FormEvent, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { ExecutionGraph } from "../components/ExecutionGraph";
import { NodeList } from "../components/NodeList";
import { RunStatus } from "../components/RunStatus";
import { Timeline } from "../components/Timeline";
import { useRunSession } from "../state/runSession";

export function RunPage() {
  const { runId } = useParams();
  const navigate = useNavigate();
  const [draft, setDraft] = useState(runId ?? "");
  const session = useRunSession(runId);

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const next = draft.trim();
    if (next) {
      navigate(`/runs/${encodeURIComponent(next)}`);
    }
  }

  return (
    <main className="page">
      <header>
        <h1>Tselora</h1>
        <form onSubmit={onSubmit}>
          <label>
            run_id
            <input value={draft} onChange={(e) => setDraft(e.target.value)} />
          </label>
          <button type="submit">Open</button>
        </form>
        <p className="muted">
          connection: <strong>{session.status}</strong>
          {session.error ? ` — ${session.error}` : null}
        </p>
      </header>
      {session.state ? (
        <>
          <RunStatus run={session.state.run} />
          <ExecutionGraph graph={session.state.graph} />
          <NodeList nodes={session.state.nodes} />
          <Timeline timeline={session.state.timeline} />
        </>
      ) : (
        <p className="muted">Load a run to see projected state.</p>
      )}
    </main>
  );
}
