/** Mirror of core.events.ids.is_safe_run_id for client-side checks. */

const SAFE_RUN_ID = /^[A-Za-z0-9._-]+$/;
const MAX_SAFE_ID_LENGTH = 200;

export function isSafeRunId(runId: string): boolean {
  if (!runId || runId.length > MAX_SAFE_ID_LENGTH) {
    return false;
  }
  if (runId === "." || runId === "..") {
    return false;
  }
  return SAFE_RUN_ID.test(runId);
}
