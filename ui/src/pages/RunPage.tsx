import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { ExecutionGraph } from "../components/ExecutionGraph";
import { LineageChrome } from "../components/LineageChrome";
import { NodeInspector } from "../components/NodeInspector";
import { NodeList } from "../components/NodeList";
import { ReplayScrubber } from "../components/ReplayScrubber";
import { RunHeader } from "../components/RunHeader";
import { Timeline } from "../components/Timeline";
import { nodeByInstanceId, resolveSelection, timelineForInstance } from "../inspect/selection";
import { useRunSession } from "../state/runSession";

export function RunPage() {
  const { runId } = useParams();
  const navigate = useNavigate();
  const [draft, setDraft] = useState(runId ?? "");
  const [selectedInstanceId, setSelectedInstanceId] = useState<string | null>(null);
  const session = useRunSession(runId);

  useEffect(() => {
    if (session.runId !== runId || session.state == null) {
      setSelectedInstanceId(null);
      return;
    }
    setSelectedInstanceId((current) => resolveSelection(session.state!.nodes, current));
  }, [runId, session.runId, session.state]);

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const next = draft.trim();
    if (next) {
      navigate(`/runs/${encodeURIComponent(next)}`);
    }
  }

  const selectedNode = session.state
    ? nodeByInstanceId(session.state.nodes, selectedInstanceId)
    : null;
  const instanceTimeline = session.state
    ? timelineForInstance(session.state.timeline.entries, selectedNode?.execution_instance_id ?? null)
    : [];

  return (
    <main className="page explorer">
      <header className="explorer-chrome">
        <h1>Tselora</h1>
        <form onSubmit={onSubmit}>
          <label>
            run_id
            <input value={draft} onChange={(e) => setDraft(e.target.value)} />
          </label>
          <button type="submit">Open</button>
        </form>
        <p className="muted">
          <Link to="/compare">Compare runs</Link>
          {runId ? (
            <>
              {" · "}
              <Link to={`/learn?run_id=${encodeURIComponent(runId)}`}>Exact structure cohort</Link>
            </>
          ) : (
            <>
              {" · "}
              <Link to="/learn">Exact structure cohort</Link>
            </>
          )}
        </p>
        {session.error ? <p className="muted">{session.error}</p> : null}
      </header>
      {session.state ? (
        <>
          <div className="explorer-header">
            <RunHeader
              run={session.state.run}
              nodes={session.state.nodes}
              timeline={session.state.timeline}
              view={session.view}
              status={session.status}
            />
            <LineageChrome run={session.state.run} />
            <ReplayScrubber
              view={session.view}
              throughSequence={session.throughSequence}
              tipLastSequence={session.tipLastSequence}
              onHistorical={session.showHistorical}
              onLive={session.showLive}
            />
          </div>
          <div className="explorer-body">
            <div className="explorer-main">
              <div className="explorer-flow">
                <ExecutionGraph
                  graph={session.state.graph}
                  projectedNodes={session.state.nodes}
                  selectedInstanceId={selectedInstanceId}
                  onSelectInstance={setSelectedInstanceId}
                />
              </div>
              <div className="explorer-activity">
                <Timeline
                  timeline={session.state.timeline}
                  nodes={session.state.nodes}
                  selectedInstanceId={selectedInstanceId}
                  onSelectInstance={setSelectedInstanceId}
                />
              </div>
            </div>
            <aside className="explorer-rail">
              <NodeList
                nodes={session.state.nodes}
                selectedInstanceId={selectedInstanceId}
                onSelectInstance={setSelectedInstanceId}
              />
              <NodeInspector
                node={selectedNode}
                nodes={session.state.nodes}
                timelineEntries={instanceTimeline}
              />
            </aside>
          </div>
        </>
      ) : (
        <p className="muted">Load a run to see projected state.</p>
      )}
    </main>
  );
}
