import type { ProjectionCursor, ProjectionState } from "../types/projection";

export function cursor(state: ProjectionState): ProjectionCursor {
  const entries = state.timeline.entries;
  return {
    last_sequence: state.run.last_sequence,
    event_count: entries.length,
    tip_event_id: entries.length ? entries[entries.length - 1].event_id : null,
  };
}

export function cursorsEqual(a: ProjectionCursor, b: ProjectionCursor): boolean {
  return (
    a.last_sequence === b.last_sequence &&
    a.event_count === b.event_count &&
    (a.tip_event_id ?? null) === (b.tip_event_id ?? null)
  );
}
