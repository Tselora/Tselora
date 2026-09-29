import { useState } from "react";

import { postCommand, type ControlCommandType, RestError } from "../api/rest";
import type { NodeState, RunState, TimelineState } from "../types/projection";
import { CopyButton } from "./CopyButton";
import { LiveBadge } from "./LiveBadge";
import { humanizeStatus, runDisplayName } from "../present";

export function RunHeader({
  run,
  nodes,
  timeline,
  view,
  status,
}: {
  run: RunState;
  nodes: NodeState[];
  timeline: TimelineState;
  view: "live" | "historical";
  status: "loading" | "live" | "resyncing" | "error";
}) {
  const [controlMessage, setControlMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const liveControls = view === "live";
  const runStatus = run.status ?? "";
  const terminal =
    runStatus === "completed" || runStatus === "failed" || runStatus === "cancelled";
  const showControls = liveControls && !terminal;
  const canPause = showControls && (runStatus === "started" || runStatus === "running");
  const canResume = showControls && runStatus === "paused";
  const canStop =
    showControls && (runStatus === "started" || runStatus === "running" || runStatus === "paused");

  async function send(type: ControlCommandType) {
    if (!showControls || run.run_id == null || pending) {
      return;
    }
    setPending(true);
    setControlMessage(null);
    try {
      const result = await postCommand(run.run_id, type);
      if (result.status === "no_active_runtime") {
        setControlMessage("No active runtime for this run.");
      } else if (result.status === "duplicate") {
        setControlMessage("Command already submitted.");
      } else {
        setControlMessage(null);
      }
    } catch (err) {
      const message = err instanceof RestError ? err.message : "Command failed";
      setControlMessage(message);
    } finally {
      setPending(false);
    }
  }

  return (
    <section>
      <h2>{runDisplayName(nodes, run.run_id)}</h2>
      <p>
        <LiveBadge view={view} status={status} />
      </p>
      <dl className="kv">
        {run.run_id ? (
          <>
            <dt>run_id</dt>
            <dd className="copy-row">
              <code>{run.run_id}</code>
              <CopyButton value={run.run_id} label="Copy run id" />
            </dd>
          </>
        ) : null}
        <dt>Status</dt>
        <dd>
          <span className={`status-badge status-badge-${(run.status ?? "unknown").toLowerCase()}`}>
            {humanizeStatus(run.status)}
          </span>
        </dd>
        <dt>Executions</dt>
        <dd>{nodes.length}</dd>
        <dt>Events</dt>
        <dd>{timeline.entries.length}</dd>
      </dl>
      {showControls ? (
        <div className="run-controls" role="group" aria-label="Runtime control">
          <button type="button" disabled={!canPause || pending} onClick={() => void send("pause")}>
            Pause
          </button>
          <button type="button" disabled={!canResume || pending} onClick={() => void send("resume")}>
            Resume
          </button>
          <button type="button" disabled={!canStop || pending} onClick={() => void send("stop")}>
            Stop
          </button>
        </div>
      ) : null}
      {controlMessage ? <p className="muted">{controlMessage}</p> : null}
    </section>
  );
}
