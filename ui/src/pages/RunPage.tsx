import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { getRunList, type RunSummary } from "../api/rest";
import { CopyButton } from "../components/CopyButton";
import { ExecutionGraph } from "../components/ExecutionGraph";
import { LineageChrome } from "../components/LineageChrome";
import { NodeInspector } from "../components/NodeInspector";
import { NodeList } from "../components/NodeList";
import { ReplayScrubber } from "../components/ReplayScrubber";
import { RunHeader } from "../components/RunHeader";
import { Timeline } from "../components/Timeline";
import { nodeByInstanceId, resolveSelection, timelineForInstance } from "../inspect/selection";
import { humanizeStatus } from "../present";
import { useRunSession } from "../state/runSession";

function RecentRuns() {
  const [runs, setRuns] = useState<RunSummary[] | null>(null);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getRunList()
      .then((rows) => {
        if (!cancelled) {
          setRuns(rows);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setUnavailable(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="recent-runs" aria-label="Recent runs">
      <h2>Recent runs</h2>
      {unavailable ? <p className="muted">Recent runs are unavailable.</p> : null}
      {runs != null && runs.length === 0 ? <p className="muted">No runs on this collector yet.</p> : null}
      {runs != null && runs.length > 0 ? (
        <ul>
          {runs.map((run) => (
            <li key={run.run_id}>
              <Link to={`/runs/${encodeURIComponent(run.run_id)}`}>
                <code>{run.run_id}</code>
              </Link>
              <span className={`status-badge status-badge-${(run.status ?? "unknown").toLowerCase()}`}>
                {humanizeStatus(run.status)}
              </span>
              <CopyButton value={run.run_id} label={`Copy ${run.run_id}`} />
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

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
            Open by run id
            <input value={draft} onChange={(e) => setDraft(e.target.value)} />
          </label>
          <button type="submit">Open</button>
        </form>
        <p className="product-actions">
          <Link className="product-action" to="/compare">
            Compare runs
          </Link>
          {runId ? (
            <Link className="product-action" to={`/learn?run_id=${encodeURIComponent(runId)}`}>
              Learn
            </Link>
          ) : (
            <Link className="product-action" to="/learn">
              Learn
            </Link>
          )}
        </p>
        {runId && session.error ? <p className="muted">{session.error}</p> : null}
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
        runId ? (
          <p className="muted">
            {session.status === "loading"
              ? "Loading projected state…"
              : "No projected state for this run_id yet."}
          </p>
        ) : (
          <RecentRuns />
        )
      )}
    </main>
  );
}
