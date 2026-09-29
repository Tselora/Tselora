import { FormEvent, useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

import { getExperience, queryExperiences, RestError } from "../api/rest";
import { CopyButton } from "../components/CopyButton";
import { isSafeRunId } from "../api/safeId";
import {
  buildExperienceQuery,
  EMPTY_EXPERIENCE_FILTERS,
  type ExperienceFilterInput,
} from "../learn/experienceQuery";
import type { Experience, ExperienceQueryBody } from "../types/experience";
import { experienceIdForRun } from "../types/experience";

function decisionSummary(decisions: Array<Record<string, unknown>>): string {
  if (decisions.length === 0) {
    return "—";
  }
  return JSON.stringify(decisions);
}

function CohortList({
  anchor,
  cohort,
}: {
  anchor: Experience;
  cohort: Experience[];
}) {
  return (
    <ol className="learn-cohort" data-testid="cohort-list">
      {cohort.map((experience) => {
        const isAnchor = experience.experience_id === anchor.experience_id;
        return (
          <li key={experience.experience_id}>
            <p className="copy-row">
              <code>{experience.run_id}</code>
              <CopyButton value={experience.run_id} label={`Copy ${experience.run_id}`} />
              {isAnchor ? <span data-testid="anchor-marker"> anchor</span> : null}
            </p>
            <dl className="kv">
              <dt>status</dt>
              <dd>{experience.status}</dd>
              <dt>created_at</dt>
              <dd>{experience.created_at}</dd>
              <dt>instance_count</dt>
              <dd>{experience.instance_count}</dd>
              <dt>edge_count</dt>
              <dd>{experience.edge_count}</dd>
              <dt>decisions</dt>
              <dd>{decisionSummary(experience.decisions)}</dd>
            </dl>
            <p className="learn-row-actions">
              <Link to={`/runs/${encodeURIComponent(experience.run_id)}`}>Open run</Link>
              {experience.run_id !== anchor.run_id ? (
                <Link
                  to={`/compare?left_run_id=${encodeURIComponent(anchor.run_id)}&right_run_id=${encodeURIComponent(experience.run_id)}`}
                >
                  Compare with anchor
                </Link>
              ) : null}
            </p>
          </li>
        );
      })}
    </ol>
  );
}

export function LearnPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const runParam = searchParams.get("run_id") ?? "";
  const [runDraft, setRunDraft] = useState(runParam);
  const [filterDraft, setFilterDraft] = useState<ExperienceFilterInput>(EMPTY_EXPERIENCE_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<ExperienceFilterInput>(EMPTY_EXPERIENCE_FILTERS);
  const [anchor, setAnchor] = useState<Experience | null>(null);
  const [cohort, setCohort] = useState<Experience[] | null>(null);
  const [sent, setSent] = useState<ExperienceQueryBody | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setRunDraft(runParam);
  }, [runParam]);

  const load = useCallback(async (runId: string, filters: ExperienceFilterInput) => {
    setLoading(true);
    setError(null);
    setAnchor(null);
    setCohort(null);
    setSent(null);
    try {
      const experienceId = experienceIdForRun(runId);
      if (!isSafeRunId(runId) || !isSafeRunId(experienceId)) {
        throw new RestError("unsafe run_id", 400);
      }
      const nextAnchor = await getExperience(experienceId);
      let body: ExperienceQueryBody;
      try {
        body = buildExperienceQuery(nextAnchor.structure_fingerprint, filters);
      } catch (err) {
        setAnchor(nextAnchor);
        setAppliedFilters(filters);
        const message = err instanceof Error ? err.message : "invalid filters";
        setError(message);
        return;
      }
      const nextCohort = await queryExperiences(body);
      setAnchor(nextAnchor);
      setCohort(nextCohort);
      setSent(body);
      setAppliedFilters(filters);
    } catch (err) {
      if (err instanceof RestError && err.status === 404) {
        setError("no Experience for this run");
      } else {
        const message = err instanceof RestError ? err.message : "Experience request failed";
        setError(message);
      }
      setAnchor(null);
      setCohort(null);
      setSent(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!runParam) {
      setAnchor(null);
      setCohort(null);
      setSent(null);
      setError(null);
      setAppliedFilters(EMPTY_EXPERIENCE_FILTERS);
      setFilterDraft(EMPTY_EXPERIENCE_FILTERS);
      return;
    }
    setFilterDraft(EMPTY_EXPERIENCE_FILTERS);
    void load(runParam, EMPTY_EXPERIENCE_FILTERS);
  }, [runParam, load]);

  function onOpenRun(event: FormEvent) {
    event.preventDefault();
    const next = runDraft.trim();
    if (!next) {
      return;
    }
    navigate(`/learn?run_id=${encodeURIComponent(next)}`);
  }

  function onApplyFilters(event: FormEvent) {
    event.preventDefault();
    if (!runParam) {
      return;
    }
    void load(runParam, filterDraft);
  }

  function setFilter<K extends keyof ExperienceFilterInput>(key: K, value: ExperienceFilterInput[K]) {
    setFilterDraft((current) => ({ ...current, [key]: value }));
  }

  return (
    <main className="page learn">
      <header className="explorer-chrome">
        <h1>Tselora</h1>
        <p className="muted">
          Which prior terminal executions have this exact structure?{" "}
          <Link to="/">Open a run</Link>
          {" · "}
          <Link className="product-action" to="/compare">
            Compare runs
          </Link>
        </p>
        <form onSubmit={onOpenRun}>
          <label>
            run_id
            <input value={runDraft} onChange={(e) => setRunDraft(e.target.value)} />
          </label>
          <button type="submit">Open</button>
        </form>
        {runParam ? (
          <div className="compare-actions" role="group" aria-label="Cohort actions">
            <button type="button" disabled={loading} onClick={() => void load(runParam, appliedFilters)}>
              Refresh
            </button>
          </div>
        ) : null}
        {loading ? <p className="muted">Loading cohort…</p> : null}
        {error ? <p className="compare-error">{error}</p> : null}
      </header>

      {!runParam ? <p className="muted">Set run_id to load an exact structure cohort.</p> : null}

      {anchor ? (
        <section className="compare-section" data-testid="learn-anchor">
          <h2>Anchor</h2>
          <dl className="kv">
            <dt>experience_id</dt>
            <dd>
              <code>{anchor.experience_id}</code>
            </dd>
            <dt>run_id</dt>
            <dd className="copy-row">
              <Link to={`/runs/${encodeURIComponent(anchor.run_id)}`}>{anchor.run_id}</Link>
              <CopyButton value={anchor.run_id} label="Copy run id" />
            </dd>
            <dt>status</dt>
            <dd>{anchor.status}</dd>
            <dt>structure_fingerprint</dt>
            <dd className="copy-row">
              <code>{anchor.structure_fingerprint}</code>
              <CopyButton value={anchor.structure_fingerprint} label="Copy structure fingerprint" />
            </dd>
            <dt>instance_count</dt>
            <dd>{anchor.instance_count}</dd>
            <dt>edge_count</dt>
            <dd>{anchor.edge_count}</dd>
          </dl>
        </section>
      ) : null}

      {anchor ? (
        <form className="learn-filters" onSubmit={onApplyFilters}>
          <h2>Filters</h2>
          <label>
            status
            <select
              name="status"
              value={filterDraft.status}
              onChange={(e) => setFilter("status", e.target.value)}
            >
              <option value="">any</option>
              <option value="completed">completed</option>
              <option value="failed">failed</option>
              <option value="cancelled">cancelled</option>
            </select>
          </label>
          <label>
            decision
            <input
              name="decision"
              value={filterDraft.decision}
              onChange={(e) => setFilter("decision", e.target.value)}
            />
          </label>
          <label>
            selected_strategy
            <input
              name="selected_strategy"
              value={filterDraft.selected_strategy}
              onChange={(e) => setFilter("selected_strategy", e.target.value)}
            />
          </label>
          <label>
            action
            <input
              name="action"
              value={filterDraft.action}
              onChange={(e) => setFilter("action", e.target.value)}
            />
          </label>
          <label>
            failure_category
            <input
              name="failure_category"
              value={filterDraft.failure_category}
              onChange={(e) => setFilter("failure_category", e.target.value)}
            />
          </label>
          <label>
            had_pause
            <select
              name="had_pause"
              value={filterDraft.had_pause}
              onChange={(e) => setFilter("had_pause", e.target.value)}
            >
              <option value="">any</option>
              <option value="true">true</option>
              <option value="false">false</option>
            </select>
          </label>
          <label>
            terminal_cancelled
            <select
              name="terminal_cancelled"
              value={filterDraft.terminal_cancelled}
              onChange={(e) => setFilter("terminal_cancelled", e.target.value)}
            >
              <option value="">any</option>
              <option value="true">true</option>
              <option value="false">false</option>
            </select>
          </label>
          <label>
            max_age_seconds
            <input
              name="max_age_seconds"
              value={filterDraft.max_age_seconds}
              onChange={(e) => setFilter("max_age_seconds", e.target.value)}
            />
          </label>
          <label>
            limit
            <input
              name="limit"
              value={filterDraft.limit}
              onChange={(e) => setFilter("limit", e.target.value)}
            />
          </label>
          <button type="submit">Apply filters</button>
        </form>
      ) : null}

      {sent ? (
        <section className="compare-section">
          <h2>Filters sent</h2>
          <pre className="learn-sent" data-testid="filters-sent">
            {JSON.stringify(sent)}
          </pre>
        </section>
      ) : null}

      {cohort ? (
        <section className="compare-section">
          <h2>Cohort</h2>
          <p data-testid="cohort-count">
            Cohort count: {cohort.length}
            {sent?.limit != null ? ` (showing up to ${sent.limit})` : ""}
          </p>
          {cohort.length === 0 ? <p className="muted">No experiences in this cohort.</p> : null}
          <CohortList anchor={anchor!} cohort={cohort} />
        </section>
      ) : null}
    </main>
  );
}
