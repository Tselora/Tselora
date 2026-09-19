import {
  PATCH_SCHEMA_VERSION,
  type ProjectionState,
  type StatePatch,
} from "../types/projection";
import { cursor, cursorsEqual } from "./cursor";

export class PatchApplyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PatchApplyError";
  }
}

export function applyPatch(state: ProjectionState, patch: StatePatch): ProjectionState {
  if (patch.schema_version !== PATCH_SCHEMA_VERSION) {
    throw new PatchApplyError(
      `unsupported patch schema_version=${JSON.stringify(patch.schema_version)}`,
    );
  }
  const stateRunId = state.run.run_id;
  if (patch.run_id != null && stateRunId != null && patch.run_id !== stateRunId) {
    throw new PatchApplyError(
      `patch run_id=${JSON.stringify(patch.run_id)} does not match state run_id=${JSON.stringify(stateRunId)}`,
    );
  }
  const current = cursor(state);
  if (!cursorsEqual(current, patch.from_cursor)) {
    throw new PatchApplyError("patch from_cursor does not match projection cursor");
  }
  const result: ProjectionState = {
    run: patch.run ?? state.run,
    nodes: patch.nodes ?? state.nodes,
    graph: patch.graph ?? state.graph,
    timeline: patch.timeline ?? state.timeline,
  };
  if (!cursorsEqual(cursor(result), patch.to_cursor)) {
    throw new PatchApplyError("patch to_cursor does not match resulting projection cursor");
  }
  return result;
}
