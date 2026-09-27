import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";

import type { RunState } from "../types/projection";

export function LineageChrome({ run }: { run: RunState }) {
  const parentId = run.forked_from_run_id;
  const children = run.child_run_ids ?? [];
  const checkpoints = run.checkpoints ?? [];
  const thisRunId = run.run_id;

  const [childDraft, setChildDraft] = useState(children[0] ?? "");

  if (!parentId && children.length === 0 && checkpoints.length === 0) {
    return null;
  }

  function compareHref(left: string, right: string): string {
    return `/compare?left_run_id=${encodeURIComponent(left)}&right_run_id=${encodeURIComponent(right)}`;
  }

  function onChooseChild(event: FormEvent) {
    event.preventDefault();
  }

  return (
    <section className="lineage-chrome" aria-label="Run lineage">
      <h3>Lineage</h3>
      {parentId && thisRunId ? (
        <p>
          Forked from{" "}
          <Link to={`/runs/${encodeURIComponent(parentId)}`}>{parentId}</Link>
          {run.fork_source_checkpoint_id ? (
            <>
              {" "}
              @ <code>{run.fork_source_checkpoint_id}</code>
            </>
          ) : null}
          {" · "}
          <Link to={compareHref(parentId, thisRunId)}>Compare with parent</Link>
        </p>
      ) : null}
      {children.length === 1 && thisRunId ? (
        <p>
          Child run{" "}
          <Link to={`/runs/${encodeURIComponent(children[0])}`}>{children[0]}</Link>
          {" · "}
          <Link to={compareHref(thisRunId, children[0])}>Compare with child</Link>
        </p>
      ) : null}
      {children.length > 1 && thisRunId ? (
        <div>
          <p>Child runs:</p>
          <ul>
            {children.map((id) => (
              <li key={id}>
                <Link to={`/runs/${encodeURIComponent(id)}`}>{id}</Link>
              </li>
            ))}
          </ul>
          <form className="lineage-compare-pick" onSubmit={onChooseChild}>
            <label>
              Compare with child
              <select
                value={childDraft}
                onChange={(e) => setChildDraft(e.target.value)}
                aria-label="Child run to compare"
              >
                {children.map((id) => (
                  <option key={id} value={id}>
                    {id}
                  </option>
                ))}
              </select>
            </label>
            {childDraft ? (
              <Link to={compareHref(thisRunId, childDraft)}>Compare</Link>
            ) : (
              <Link to={`/compare?left_run_id=${encodeURIComponent(thisRunId)}`}>
                Open compare
              </Link>
            )}
          </form>
        </div>
      ) : null}
      {checkpoints.length > 0 ? (
        <div>
          <p>Checkpoints:</p>
          <ul>
            {checkpoints.map((cp) => (
              <li key={cp.checkpoint_id}>
                <code>{cp.checkpoint_id}</code>
                {cp.label ? <> — {cp.label}</> : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
