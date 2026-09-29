import { FormEvent, useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

import { postComparison, RestError } from "../api/rest";
import { CopyButton } from "../components/CopyButton";
import { isSafeRunId } from "../api/safeId";
import type {
  ComparisonDocument,
  NumericDelta,
  SetDiff,
  SideEqual,
} from "../types/comparison";

function formatValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "—";
  }
  if (typeof value === "boolean" || typeof value === "number") {
    return String(value);
  }
  if (typeof value === "string") {
    return value;
  }
  return JSON.stringify(value);
}

function SideEqualRow({ label, side }: { label: string; side: SideEqual }) {
  return (
    <tr>
      <td>{label}</td>
      <td>{formatValue(side.left)}</td>
      <td>{formatValue(side.right)}</td>
      <td>{side.equal ? "equal" : "changed"}</td>
    </tr>
  );
}

function NumericDeltaRow({ label, delta }: { label: string; delta: NumericDelta }) {
  return (
    <tr>
      <td>{label}</td>
      <td>{delta.left}</td>
      <td>{delta.right}</td>
      <td>{delta.delta}</td>
    </tr>
  );
}

function SetDiffBlock({ title, diff }: { title: string; diff: SetDiff }) {
  return (
    <div className="compare-set">
      <h4>{title}</h4>
      <dl className="kv">
        <dt>only_left</dt>
        <dd>{diff.only_left.length ? formatValue(diff.only_left) : "—"}</dd>
        <dt>only_right</dt>
        <dd>{diff.only_right.length ? formatValue(diff.only_right) : "—"}</dd>
        <dt>both</dt>
        <dd>{diff.both.length ? formatValue(diff.both) : "—"}</dd>
      </dl>
    </div>
  );
}

function ComparisonView({ doc }: { doc: ComparisonDocument }) {
  return (
    <div className="compare-document">
      <section className="compare-section">
        <h2>Header</h2>
        <dl className="kv">
          <dt>comparison_id</dt>
          <dd>
            <code>{doc.comparison_id}</code>
          </dd>
          <dt>left_run_id</dt>
          <dd className="copy-row">
            <Link to={`/runs/${encodeURIComponent(doc.left_run_id)}`}>{doc.left_run_id}</Link>
            <CopyButton value={doc.left_run_id} label="Copy left run id" />
          </dd>
          <dt>right_run_id</dt>
          <dd className="copy-row">
            <Link to={`/runs/${encodeURIComponent(doc.right_run_id)}`}>{doc.right_run_id}</Link>
            <CopyButton value={doc.right_run_id} label="Copy right run id" />
          </dd>
          <dt>completeness</dt>
          <dd>{doc.completeness}</dd>
          {doc.lineage ? (
            <>
              <dt>lineage</dt>
              <dd>
                parent <code>{doc.lineage.parent_run_id}</code> → child{" "}
                <code>{doc.lineage.child_run_id}</code> @ checkpoint{" "}
                <code>{doc.lineage.source_checkpoint_id}</code>
                {doc.lineage.source_event_id ? (
                  <>
                    {" "}
                    (event <code>{doc.lineage.source_event_id}</code>)
                  </>
                ) : null}
              </dd>
            </>
          ) : (
            <>
              <dt>lineage</dt>
              <dd className="muted">no fork lineage</dd>
            </>
          )}
        </dl>
      </section>

      <section className="compare-section">
        <h2>Outcome</h2>
        <table>
          <thead>
            <tr>
              <th>Field</th>
              <th>Left</th>
              <th>Right</th>
              <th>State</th>
            </tr>
          </thead>
          <tbody>
            <SideEqualRow label="status" side={doc.outcome.status} />
            <SideEqualRow label="terminal" side={doc.outcome.terminal} />
          </tbody>
        </table>
        <SetDiffBlock title="failure_category" diff={doc.outcome.failure_category} />
      </section>

      <section className="compare-section">
        <h2>Why?</h2>
        {doc.why.instances.length === 0 ? (
          <p className="muted">No Why? instances.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>logical_node_id</th>
                <th>index</th>
                <th>presence</th>
                <th>keys</th>
              </tr>
            </thead>
            <tbody>
              {doc.why.instances.map((inst) => (
                <tr key={`${inst.logical_node_id}:${inst.index}:${inst.presence}`}>
                  <td>{inst.logical_node_id}</td>
                  <td>{inst.index}</td>
                  <td>{inst.presence}</td>
                  <td>
                    {Object.keys(inst.keys).length === 0
                      ? "—"
                      : Object.entries(inst.keys)
                          .map(([k, v]) => `${k}: ${v}`)
                          .join(", ")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="compare-section">
        <h2>Topology</h2>
        <table>
          <thead>
            <tr>
              <th>Metric</th>
              <th>Left</th>
              <th>Right</th>
              <th>delta</th>
            </tr>
          </thead>
          <tbody>
            <NumericDeltaRow label="instance_count" delta={doc.topology.instance_count} />
            <NumericDeltaRow label="edge_count" delta={doc.topology.edge_count} />
          </tbody>
        </table>
        <SetDiffBlock title="logical_node_ids" diff={doc.topology.logical_node_ids} />
        <SetDiffBlock title="edges" diff={doc.topology.edges} />
        {doc.topology.node_type_mismatches.length > 0 ? (
          <div className="compare-set">
            <h4>node_type_mismatches</h4>
            <ul>
              {doc.topology.node_type_mismatches.map((m) => (
                <li key={m.logical_node_id}>
                  {m.logical_node_id}: left={formatValue(m.left)} right={formatValue(m.right)}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {Object.keys(doc.topology.logical_family_counts).length > 0 ? (
          <div className="compare-set">
            <h4>logical_family_counts</h4>
            <table>
              <thead>
                <tr>
                  <th>id</th>
                  <th>Left</th>
                  <th>Right</th>
                  <th>delta</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(doc.topology.logical_family_counts).map(([id, d]) => (
                  <NumericDeltaRow key={id} label={id} delta={d} />
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
        {Object.keys(doc.topology.retry_family_counts).length > 0 ? (
          <div className="compare-set">
            <h4>retry_family_counts</h4>
            <table>
              <thead>
                <tr>
                  <th>id</th>
                  <th>Left</th>
                  <th>Right</th>
                  <th>delta</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(doc.topology.retry_family_counts).map(([id, d]) => (
                  <NumericDeltaRow key={id} label={id} delta={d} />
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>

      <section className="compare-section">
        <h2>Timing</h2>
        <table>
          <thead>
            <tr>
              <th>Metric</th>
              <th>Left</th>
              <th>Right</th>
              <th>delta</th>
            </tr>
          </thead>
          <tbody>
            <NumericDeltaRow label="event_count" delta={doc.timing.event_count} />
            <NumericDeltaRow label="last_sequence" delta={doc.timing.last_sequence} />
            <NumericDeltaRow label="instance_count" delta={doc.timing.instance_count} />
          </tbody>
        </table>
      </section>

      <section className="compare-section">
        <h2>Control</h2>
        <table>
          <thead>
            <tr>
              <th>Field</th>
              <th>Left</th>
              <th>Right</th>
              <th>State</th>
            </tr>
          </thead>
          <tbody>
            <SideEqualRow label="had_pause" side={doc.control.had_pause} />
            <SideEqualRow label="had_resume" side={doc.control.had_resume} />
            <SideEqualRow label="terminal_cancelled" side={doc.control.terminal_cancelled} />
          </tbody>
        </table>
      </section>

      <section className="compare-section">
        <h2>Experience</h2>
        <dl className="kv">
          <dt>left_present</dt>
          <dd>{String(doc.experience.left_present)}</dd>
          <dt>right_present</dt>
          <dd>{String(doc.experience.right_present)}</dd>
          {doc.experience.left_experience_id ? (
            <>
              <dt>left_experience_id</dt>
              <dd>
                <code>{doc.experience.left_experience_id}</code>
              </dd>
            </>
          ) : null}
          {doc.experience.right_experience_id ? (
            <>
              <dt>right_experience_id</dt>
              <dd>
                <code>{doc.experience.right_experience_id}</code>
              </dd>
            </>
          ) : null}
          {doc.experience.structure_fingerprint ? (
            <>
              <dt>structure_fingerprint</dt>
              <dd>
                left={formatValue(doc.experience.structure_fingerprint.left)}{" "}
                {typeof doc.experience.structure_fingerprint.left === "string" &&
                doc.experience.structure_fingerprint.left.length > 0 ? (
                  <CopyButton
                    value={doc.experience.structure_fingerprint.left}
                    label="Copy left structure fingerprint"
                  />
                ) : null}{" "}
                right={formatValue(doc.experience.structure_fingerprint.right)}{" "}
                {typeof doc.experience.structure_fingerprint.right === "string" &&
                doc.experience.structure_fingerprint.right.length > 0 ? (
                  <CopyButton
                    value={doc.experience.structure_fingerprint.right}
                    label="Copy right structure fingerprint"
                  />
                ) : null}{" "}
                (
                {doc.experience.structure_fingerprint.equal ? "equal" : "changed"})
                {typeof doc.experience.structure_fingerprint.left === "string" &&
                doc.experience.structure_fingerprint.left.length > 0 ? (
                  <>
                    {" "}
                    <Link
                      className="product-action"
                      to={`/learn?run_id=${encodeURIComponent(doc.left_run_id)}`}
                    >
                      Exact structure cohort (left)
                    </Link>
                  </>
                ) : null}
                {typeof doc.experience.structure_fingerprint.right === "string" &&
                doc.experience.structure_fingerprint.right.length > 0 ? (
                  <>
                    {" "}
                    <Link
                      className="product-action"
                      to={`/learn?run_id=${encodeURIComponent(doc.right_run_id)}`}
                    >
                      Exact structure cohort (right)
                    </Link>
                  </>
                ) : null}
              </dd>
            </>
          ) : null}
          {doc.experience.retry_family_counts_equal != null ? (
            <>
              <dt>retry_family_counts_equal</dt>
              <dd>{String(doc.experience.retry_family_counts_equal)}</dd>
            </>
          ) : null}
        </dl>
        {doc.experience.decisions ? (
          <SetDiffBlock title="decisions" diff={doc.experience.decisions} />
        ) : null}
        {doc.experience.failed_instance_count ? (
          <table>
            <thead>
              <tr>
                <th>Metric</th>
                <th>Left</th>
                <th>Right</th>
                <th>delta</th>
              </tr>
            </thead>
            <tbody>
              <NumericDeltaRow
                label="failed_instance_count"
                delta={doc.experience.failed_instance_count}
              />
            </tbody>
          </table>
        ) : null}
        {doc.experience.failure_category ? (
          <SetDiffBlock title="failure_category" diff={doc.experience.failure_category} />
        ) : null}
        {!doc.experience.left_present && !doc.experience.right_present ? (
          <p className="muted">No Experience enrichment for either run.</p>
        ) : null}
      </section>
    </div>
  );
}

export function ComparePage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const leftParam = searchParams.get("left_run_id") ?? "";
  const rightParam = searchParams.get("right_run_id") ?? "";
  const [leftDraft, setLeftDraft] = useState(leftParam);
  const [rightDraft, setRightDraft] = useState(rightParam);
  const [doc, setDoc] = useState<ComparisonDocument | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);

  useEffect(() => {
    setLeftDraft(leftParam);
    setRightDraft(rightParam);
  }, [leftParam, rightParam]);

  const load = useCallback(async (left: string, right: string) => {
    setLoading(true);
    setError(null);
    setDoc(null);
    try {
      if (!isSafeRunId(left) || !isSafeRunId(right)) {
        throw new RestError("unsafe run_id", 400);
      }
      if (left === right) {
        throw new RestError("left_run_id and right_run_id must differ", 400);
      }
      const next = await postComparison(left, right);
      setDoc(next);
      setFetchedAt(new Date().toISOString());
    } catch (err) {
      const message = err instanceof RestError ? err.message : "Comparison failed";
      setError(message);
      setDoc(null);
      setFetchedAt(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!leftParam || !rightParam) {
      setDoc(null);
      setError(null);
      setFetchedAt(null);
      return;
    }
    void load(leftParam, rightParam);
  }, [leftParam, rightParam, load]);

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const left = leftDraft.trim();
    const right = rightDraft.trim();
    if (!left || !right) {
      return;
    }
    navigate(`/compare?left_run_id=${encodeURIComponent(left)}&right_run_id=${encodeURIComponent(right)}`);
  }

  function swapSides() {
    if (!leftParam || !rightParam) {
      return;
    }
    navigate(
      `/compare?left_run_id=${encodeURIComponent(rightParam)}&right_run_id=${encodeURIComponent(leftParam)}`,
    );
  }

  return (
    <main className="page compare">
      <header className="explorer-chrome">
        <h1>Tselora</h1>
        <p className="muted">
          Compare — differences only.{" "}
          <Link to="/">Open a run</Link>
        </p>
        <form onSubmit={onSubmit}>
          <label>
            left_run_id
            <input value={leftDraft} onChange={(e) => setLeftDraft(e.target.value)} />
          </label>
          <label>
            right_run_id
            <input value={rightDraft} onChange={(e) => setRightDraft(e.target.value)} />
          </label>
          <button type="submit">Compare</button>
        </form>
        {leftParam && rightParam ? (
          <div className="compare-actions" role="group" aria-label="Comparison actions">
            <button type="button" disabled={loading} onClick={() => void load(leftParam, rightParam)}>
              Refresh
            </button>
            <button type="button" onClick={swapSides}>
              Swap sides
            </button>
            <Link to={`/runs/${encodeURIComponent(leftParam)}`}>Open left run</Link>
            <Link to={`/runs/${encodeURIComponent(rightParam)}`}>Open right run</Link>
          </div>
        ) : null}
        {fetchedAt ? (
          <p className="muted compare-fetched" data-testid="fetched-at">
            fetched at {fetchedAt}
          </p>
        ) : null}
        {loading ? <p className="muted">Loading comparison…</p> : null}
        {error ? <p className="compare-error">{error}</p> : null}
      </header>
      {!leftParam || !rightParam ? (
        <p className="muted">Set left_run_id and right_run_id to load a comparison.</p>
      ) : null}
      {doc ? <ComparisonView doc={doc} /> : null}
    </main>
  );
}
