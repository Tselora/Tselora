import type { ExperienceQueryBody, ExperienceStatus } from "../types/experience";

/** Draft controls. Empty strings are omitted from the query body. */
export type ExperienceFilterInput = {
  status: string;
  decision: string;
  selected_strategy: string;
  action: string;
  failure_category: string;
  had_pause: string;
  terminal_cancelled: string;
  max_age_seconds: string;
  limit: string;
};

export const EMPTY_EXPERIENCE_FILTERS: ExperienceFilterInput = {
  status: "",
  decision: "",
  selected_strategy: "",
  action: "",
  failure_category: "",
  had_pause: "",
  terminal_cancelled: "",
  max_age_seconds: "",
  limit: "",
};

const STATUSES: readonly ExperienceStatus[] = ["completed", "failed", "cancelled"];

function isStatus(value: string): value is ExperienceStatus {
  return (STATUSES as readonly string[]).includes(value);
}

/**
 * Map filter controls 1:1 onto ExperienceQuery.
 * Always sends the anchor document's structure_fingerprint. Does not reorder or rank.
 */
export function buildExperienceQuery(
  structureFingerprint: string,
  input: ExperienceFilterInput,
): ExperienceQueryBody {
  const body: ExperienceQueryBody = { structure_fingerprint: structureFingerprint };

  const status = input.status.trim();
  if (status) {
    if (!isStatus(status)) {
      throw new Error(`invalid status: ${status}`);
    }
    body.status = status;
  }

  const decision = input.decision.trim();
  if (decision) {
    body.decision = decision;
  }
  const selectedStrategy = input.selected_strategy.trim();
  if (selectedStrategy) {
    body.selected_strategy = selectedStrategy;
  }
  const action = input.action.trim();
  if (action) {
    body.action = action;
  }
  const failureCategory = input.failure_category.trim();
  if (failureCategory) {
    body.failure_category = failureCategory;
  }

  if (input.had_pause === "true") {
    body.had_pause = true;
  } else if (input.had_pause === "false") {
    body.had_pause = false;
  }
  if (input.terminal_cancelled === "true") {
    body.terminal_cancelled = true;
  } else if (input.terminal_cancelled === "false") {
    body.terminal_cancelled = false;
  }

  const age = input.max_age_seconds.trim();
  if (age) {
    const maxAge = Number(age);
    if (!Number.isFinite(maxAge) || maxAge < 0) {
      throw new Error("invalid max_age_seconds");
    }
    body.max_age_seconds = maxAge;
  }

  const limitText = input.limit.trim();
  if (limitText) {
    const limit = Number(limitText);
    if (!Number.isInteger(limit) || limit < 1 || limit > 1000) {
      throw new Error("invalid limit");
    }
    body.limit = limit;
  }

  return body;
}
