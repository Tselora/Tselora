/** Experience document and query body from existing Experience REST (ADR-008 / ADR-012). */

export type ExperienceStatus = "completed" | "failed" | "cancelled";

export type FailedInstanceSummary = {
  execution_instance_id: string;
  logical_node_id: string;
  status: string | null;
  failure_category: unknown;
};

export type Experience = {
  experience_id: string;
  run_id: string;
  schema_version: string;
  created_at: string;
  source_last_sequence: number;
  status: ExperienceStatus;
  started_event_id: string | null;
  logical_node_ids: string[];
  node_types: Array<string | null>;
  instance_count: number;
  edge_count: number;
  retry_family_counts: Record<string, number>;
  decisions: Array<Record<string, unknown>>;
  failed_instances: FailedInstanceSummary[];
  had_pause: boolean;
  had_resume: boolean;
  terminal_cancelled: boolean;
  event_count: number;
  last_sequence: number;
  first_timestamp: string | null;
  last_timestamp: string | null;
  structure_fingerprint: string;
};

/** Body accepted by POST /v1/experiences/query. Omitted fields are not sent. */
export type ExperienceQueryBody = {
  structure_fingerprint: string;
  status?: ExperienceStatus;
  decision?: string;
  selected_strategy?: string;
  action?: string;
  failure_category?: string;
  had_pause?: boolean;
  terminal_cancelled?: boolean;
  max_age_seconds?: number;
  limit?: number;
};

export function experienceIdForRun(runId: string): string {
  return `exp_${runId}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function isExperience(value: unknown): value is Experience {
  if (!isRecord(value)) {
    return false;
  }
  return (
    typeof value.experience_id === "string" &&
    typeof value.run_id === "string" &&
    typeof value.structure_fingerprint === "string" &&
    (value.status === "completed" || value.status === "failed" || value.status === "cancelled") &&
    typeof value.created_at === "string" &&
    typeof value.instance_count === "number" &&
    typeof value.edge_count === "number" &&
    Array.isArray(value.decisions)
  );
}

export function isExperienceList(value: unknown): value is Experience[] {
  return Array.isArray(value) && value.every(isExperience);
}
