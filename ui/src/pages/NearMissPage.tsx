import { FormEvent, useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

import { getNearMisses, RestError } from "../api/rest";
import { isSafeRunId } from "../api/safeId";
import { CopyButton } from "../components/CopyButton";
import type { NearMissList, NearMissQuery, NearMissRecord } from "../types/nearMiss";
import { buildNearMissQueryString } from "../types/nearMiss";

function queryFromSearch(params: URLSearchParams): NearMissQuery {
  const query: NearMissQuery = {};
  const runId = params.get("run_id")?.trim();
  const logical = params.get("logical_node_id")?.trim();
  const category = params.get("failure_category")?.trim();
  const fingerprint = params.get("structure_fingerprint")?.trim();
  if (runId) {
    query.run_id = runId;
  }
  if (logical) {
    query.logical_node_id = logical;
  }
  if (category) {
    query.failure_category = category;
  }
  if (fingerprint) {
    query.structure_fingerprint = fingerprint;
  }
  return query;
}

function dash(value: string | null | undefined): string {
  return value ? value : "—";
}

function NearMissRows({ records }: { records: NearMissRecord[] }) {
  return (
    <ol className="learn-cohort" data-testid="near-miss-list">
      {records.map((record) => (
        <li
          key={`${record.run_id}:${record.logical_node_id}:${record.failed_execution_instance_id}:${record.recovery_execution_instance_id}`}
        >
          <p className="copy-row">
            <code>{record.run_id}</code>
            <CopyButton value={record.run_id} label={`Copy ${record.run_id}`} />
          </p>
          <dl className="kv">
            <dt>logical_node_id</dt>
            <dd>{record.logical_node_id}</dd>
            <dt>failed_execution_instance_id</dt>
            <dd>
              <code>{record.failed_execution_instance_id}</code>
            </dd>
            <dt>recovery_execution_instance_id</dt>
            <dd>
              <code>{record.recovery_execution_instance_id}</code>
            </dd>
            <dt>run_status</dt>
            <dd>{record.run_status}</dd>
            <dt>failure_category</dt>
            <dd>{dash(record.failure_category)}</dd>
            <dt>recovery_action</dt>
            <dd>{dash(record.recovery_action)}</dd>
            <dt>structure_fingerprint</dt>
            <dd className="copy-row">
              {record.structure_fingerprint ? (
                <>
                  <code>{record.structure_fingerprint}</code>
                  <CopyButton
                    value={record.structure_fingerprint}
                    label="Copy structure fingerprint"
                  />
                </>
              ) : (
                "—"
              )}
            </dd>
            <dt>experience_id</dt>
            <dd>{dash(record.experience_id)}</dd>
          </dl>
          <p className="learn-row-actions">
            <Link to={`/runs/${encodeURIComponent(record.run_id)}`}>Open run</Link>
            {record.run_id ? (
              <Link to={`/learn?run_id=${encodeURIComponent(record.run_id)}`}>Learn</Link>
            ) : null}
          </p>
        </li>
      ))}
    </ol>
  );
}

export function NearMissPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const searchKey = searchParams.toString();
  const query = queryFromSearch(searchParams);
  const [runDraft, setRunDraft] = useState(query.run_id ?? "");
  const [logicalDraft, setLogicalDraft] = useState(query.logical_node_id ?? "");
  const [categoryDraft, setCategoryDraft] = useState(query.failure_category ?? "");
  const [fingerprintDraft, setFingerprintDraft] = useState(query.structure_fingerprint ?? "");
  const [list, setList] = useState<NearMissList | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setRunDraft(query.run_id ?? "");
    setLogicalDraft(query.logical_node_id ?? "");
    setCategoryDraft(query.failure_category ?? "");
    setFingerprintDraft(query.structure_fingerprint ?? "");
  }, [query.run_id, query.logical_node_id, query.failure_category, query.structure_fingerprint]);

  const load = useCallback(async (next: NearMissQuery) => {
    setLoading(true);
    setError(null);
    setList(null);
    try {
      if (next.run_id && !isSafeRunId(next.run_id)) {
        throw new RestError("unsafe run_id", 400);
      }
      const body = await getNearMisses(next);
      setList(body);
    } catch (err) {
      const message = err instanceof RestError ? err.message : "Near-miss request failed";
      setError(message);
      setList(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(queryFromSearch(searchParams));
  }, [load, searchKey, searchParams]);

  function onApply(event: FormEvent) {
    event.preventDefault();
    const next: NearMissQuery = {};
    const runId = runDraft.trim();
    const logical = logicalDraft.trim();
    const category = categoryDraft.trim();
    const fingerprint = fingerprintDraft.trim();
    if (runId) {
      next.run_id = runId;
    }
    if (logical) {
      next.logical_node_id = logical;
    }
    if (category) {
      next.failure_category = category;
    }
    if (fingerprint) {
      next.structure_fingerprint = fingerprint;
    }
    navigate(`/near-misses${buildNearMissQueryString(next)}`);
  }

  return (
    <main className="page learn">
      <header className="explorer-chrome">
        <h1>Tselora</h1>
        <p className="muted">
          Near-miss — derived GET /v1/near-misses (failed then recovered logical step on a completed
          run). Not a stored table.{" "}
          <Link to="/">Open a run</Link>
          {" · "}
          <Link className="product-action" to="/compare">
            Compare runs
          </Link>
          {" · "}
          <Link className="product-action" to="/learn">
            Learn
          </Link>
        </p>
        <form onSubmit={onApply}>
          <label>
            run_id
            <input name="run_id" value={runDraft} onChange={(e) => setRunDraft(e.target.value)} />
          </label>
          <label>
            logical_node_id
            <input
              name="logical_node_id"
              value={logicalDraft}
              onChange={(e) => setLogicalDraft(e.target.value)}
            />
          </label>
          <label>
            failure_category
            <input
              name="failure_category"
              value={categoryDraft}
              onChange={(e) => setCategoryDraft(e.target.value)}
            />
          </label>
          <label>
            structure_fingerprint
            <input
              name="structure_fingerprint"
              value={fingerprintDraft}
              onChange={(e) => setFingerprintDraft(e.target.value)}
            />
          </label>
          <button type="submit">Apply filters</button>
        </form>
        <div className="compare-actions" role="group" aria-label="Near-miss actions">
          <button type="button" disabled={loading} onClick={() => void load(query)}>
            Refresh
          </button>
        </div>
        {loading ? <p className="muted">Loading near-misses…</p> : null}
        {error ? <p className="compare-error">{error}</p> : null}
      </header>

      {list ? (
        <section className="compare-section">
          <h2>Derived records</h2>
          <p data-testid="near-miss-count">Count: {list.near_misses.length}</p>
          {list.truncated ? (
            <p className="muted" data-testid="near-miss-truncated">
              List truncated at collector cap.
            </p>
          ) : null}
          {list.near_misses.length === 0 ? (
            <p className="muted">No derived near-misses for these filters.</p>
          ) : (
            <NearMissRows records={list.near_misses} />
          )}
        </section>
      ) : null}

      {list && list.failures.length > 0 ? (
        <section className="compare-section">
          <h2>Projection failures</h2>
          <p className="muted">These runs could not be rebuilt. They are not near-miss records.</p>
          <ul data-testid="near-miss-failures">
            {list.failures.map((failure) => (
              <li key={failure.run_id}>
                <code>{failure.run_id}</code> — {failure.message}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}
