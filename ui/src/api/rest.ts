import type { ComparisonDocument } from "../types/comparison";
import { isComparisonDocument } from "../types/comparison";
import type { Experience, ExperienceQueryBody } from "../types/experience";
import { isExperience, isExperienceList } from "../types/experience";
import type { ProjectionState } from "../types/projection";

export class RestError extends Error {
  status: number | null;

  constructor(message: string, status: number | null = null) {
    super(message);
    this.name = "RestError";
    this.status = status;
  }
}

export type ControlCommandType = "pause" | "resume" | "stop";

export type CommandDeliveryStatus = "accepted" | "duplicate" | "no_active_runtime";

export type CommandDeliveryResult = {
  status: CommandDeliveryStatus;
  command_id: string;
  run_id: string;
};

export async function getRun(
  runId: string,
  opts?: { throughSequence?: number },
): Promise<ProjectionState> {
  let response: Response;
  const params =
    opts?.throughSequence != null ? `?through_sequence=${encodeURIComponent(String(opts.throughSequence))}` : "";
  try {
    response = await fetch(`/v1/runs/${encodeURIComponent(runId)}${params}`);
  } catch {
    throw new RestError("network error fetching run");
  }
  if (response.status === 404) {
    throw new RestError(`unknown run: ${runId}`, 404);
  }
  if (!response.ok) {
    throw new RestError(`GET /v1/runs failed (${response.status})`, response.status);
  }
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new RestError("malformed run response");
  }
  if (!isProjectionState(body)) {
    throw new RestError("malformed run response");
  }
  return body;
}

export function newCommandId(): string {
  const hex =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().replace(/-/g, "")
      : `${Date.now().toString(16)}${Math.random().toString(16).slice(2)}`;
  return `cmd_${hex}`;
}

export async function getExperience(experienceId: string): Promise<Experience> {
  let response: Response;
  try {
    response = await fetch(`/v1/experiences/${encodeURIComponent(experienceId)}`);
  } catch {
    throw new RestError("network error fetching experience");
  }
  if (!response.ok) {
    const detail = await readErrorDetail(response);
    throw new RestError(detail ?? `GET /v1/experiences failed (${response.status})`, response.status);
  }
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new RestError("malformed experience response");
  }
  if (!isExperience(body)) {
    throw new RestError("malformed experience response");
  }
  return body;
}

export async function queryExperiences(body: ExperienceQueryBody): Promise<Experience[]> {
  let response: Response;
  try {
    response = await fetch("/v1/experiences/query", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new RestError("network error querying experiences");
  }
  if (!response.ok) {
    const detail = await readErrorDetail(response);
    throw new RestError(detail ?? `POST /v1/experiences/query failed (${response.status})`, response.status);
  }
  let parsed: unknown;
  try {
    parsed = await response.json();
  } catch {
    throw new RestError("malformed experience query response");
  }
  if (!isExperienceList(parsed)) {
    throw new RestError("malformed experience query response");
  }
  return parsed;
}

export async function postComparison(
  leftRunId: string,
  rightRunId: string,
): Promise<ComparisonDocument> {
  let response: Response;
  try {
    response = await fetch("/v1/comparisons", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ left_run_id: leftRunId, right_run_id: rightRunId }),
    });
  } catch {
    throw new RestError("network error posting comparison");
  }
  if (!response.ok) {
    const detail = await readErrorDetail(response);
    throw new RestError(detail ?? `POST /v1/comparisons failed (${response.status})`, response.status);
  }
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new RestError("malformed comparison response");
  }
  if (!isComparisonDocument(body)) {
    throw new RestError("malformed comparison response");
  }
  return body;
}

export async function postCommand(
  runId: string,
  type: ControlCommandType,
): Promise<CommandDeliveryResult> {
  const command_id = newCommandId();
  let response: Response;
  try {
    response = await fetch(`/v1/runs/${encodeURIComponent(runId)}/commands`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ command_id, run_id: runId, type }),
    });
  } catch {
    throw new RestError("network error posting command");
  }
  if (!response.ok) {
    throw new RestError(`POST /v1/runs/.../commands failed (${response.status})`, response.status);
  }
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new RestError("malformed command response");
  }
  if (!isCommandDeliveryResult(body)) {
    throw new RestError("malformed command response");
  }
  return body;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

async function readErrorDetail(response: Response): Promise<string | null> {
  try {
    const body: unknown = await response.json();
    if (isRecord(body) && typeof body.detail === "string") {
      return body.detail;
    }
  } catch {
    /* ignore */
  }
  return null;
}

function isProjectionState(value: unknown): value is ProjectionState {
  if (!isRecord(value)) {
    return false;
  }
  return isRecord(value.run) && Array.isArray(value.nodes) && isRecord(value.graph) && isRecord(value.timeline);
}

function isCommandDeliveryResult(value: unknown): value is CommandDeliveryResult {
  if (!isRecord(value)) {
    return false;
  }
  return (
    (value.status === "accepted" ||
      value.status === "duplicate" ||
      value.status === "no_active_runtime") &&
    typeof value.command_id === "string" &&
    typeof value.run_id === "string"
  );
}
