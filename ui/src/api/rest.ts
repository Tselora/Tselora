import type { ProjectionState } from "../types/projection";

export class RestError extends Error {
  status: number | null;

  constructor(message: string, status: number | null = null) {
    super(message);
    this.name = "RestError";
    this.status = status;
  }
}

export async function getRun(runId: string): Promise<ProjectionState> {
  let response: Response;
  try {
    response = await fetch(`/v1/runs/${encodeURIComponent(runId)}`);
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isProjectionState(value: unknown): value is ProjectionState {
  if (!isRecord(value)) {
    return false;
  }
  return isRecord(value.run) && Array.isArray(value.nodes) && isRecord(value.graph) && isRecord(value.timeline);
}
