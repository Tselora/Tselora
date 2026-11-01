/** GET /v1/near-misses envelope. Derived at read time; not a stored ledger. */

export type NearMissRecord = {
  run_id: string;
  logical_node_id: string;
  failed_execution_instance_id: string;
  recovery_execution_instance_id: string;
  run_status: string;
  failure_category?: string | null;
  recovery_action?: string | null;
  structure_fingerprint?: string | null;
  experience_id?: string | null;
};

export type NearMissFailure = {
  run_id: string;
  message: string;
};

export type NearMissList = {
  near_misses: NearMissRecord[];
  failures: NearMissFailure[];
  truncated: boolean;
};

export type NearMissQuery = {
  run_id?: string;
  logical_node_id?: string;
  failure_category?: string;
  structure_fingerprint?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function optionalString(value: unknown): boolean {
  return value === undefined || value === null || typeof value === "string";
}

export function isNearMissRecord(value: unknown): value is NearMissRecord {
  if (!isRecord(value)) {
    return false;
  }
  return (
    typeof value.run_id === "string" &&
    typeof value.logical_node_id === "string" &&
    typeof value.failed_execution_instance_id === "string" &&
    typeof value.recovery_execution_instance_id === "string" &&
    typeof value.run_status === "string" &&
    optionalString(value.failure_category) &&
    optionalString(value.recovery_action) &&
    optionalString(value.structure_fingerprint) &&
    optionalString(value.experience_id)
  );
}

export function isNearMissFailure(value: unknown): value is NearMissFailure {
  if (!isRecord(value)) {
    return false;
  }
  return typeof value.run_id === "string" && typeof value.message === "string";
}

export function isNearMissList(value: unknown): value is NearMissList {
  if (!isRecord(value)) {
    return false;
  }
  return (
    Array.isArray(value.near_misses) &&
    value.near_misses.every(isNearMissRecord) &&
    Array.isArray(value.failures) &&
    value.failures.every(isNearMissFailure) &&
    typeof value.truncated === "boolean"
  );
}

export function buildNearMissQueryString(query: NearMissQuery): string {
  const params = new URLSearchParams();
  (["run_id", "logical_node_id", "failure_category", "structure_fingerprint"] as const).forEach(
    (key) => {
      const raw = query[key]?.trim();
      if (raw) {
        params.set(key, raw);
      }
    },
  );
  const encoded = params.toString();
  return encoded ? `?${encoded}` : "";
}
