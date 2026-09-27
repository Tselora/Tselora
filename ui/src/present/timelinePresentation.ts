import type { NodeState, TimelineEntry } from "../types/projection";

import { executionPresentation } from "./executionPresentation";
import { titleCaseLogicalNodeId } from "./titleCase";

export type TimelinePresentation = {
  eventId: string;
  sequence: number;
  type: string;
  status: string | null;
  executionInstanceId: string | null;
  parentEventId: string | null;
  title: string | null;
  displayLabel: string | null;
};

export function timelinePresentation(
  entries: TimelineEntry[],
  nodes: NodeState[],
): TimelinePresentation[] {
  return entries.map((entry) => {
    const instanceId = entry.execution_instance_id;
    const exec = instanceId != null ? executionPresentation(nodes, instanceId) : null;
    const title =
      exec?.title ?? (entry.node_id != null && entry.node_id.length > 0 ? titleCaseLogicalNodeId(entry.node_id) : null);
    return {
      eventId: entry.event_id,
      sequence: entry.sequence,
      type: entry.type,
      status: entry.status,
      executionInstanceId: instanceId,
      parentEventId: entry.parent_event_id,
      title,
      displayLabel: exec?.displayLabel ?? null,
    };
  });
}
