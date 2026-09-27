export const PATCH_SCHEMA_VERSION = "tselora.patch.v1";

export type CheckpointRecord = {
  checkpoint_id: string;
  event_id: string;
  sequence: number;
  label: string | null;
  execution_instance_id: string | null;
};

export type RunState = {
  run_id: string | null;
  status: string | null;
  started_event_id: string | null;
  last_sequence: number;
  checkpoints: CheckpointRecord[];
  forked_from_run_id: string | null;
  fork_source_checkpoint_id: string | null;
  fork_source_event_id: string | null;
  child_run_ids: string[];
};

export type NodeState = {
  logical_node_id: string;
  node_type: string | null;
  execution_instance_id: string;
  status: string | null;
  started_event_id: string | null;
  parent_event_id: string | null;
  last_sequence: number;
  payload: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
};

export type GraphEdge = {
  parent_event_id: string;
  child_event_id: string;
  parent_instance_id: string | null;
  child_instance_id: string | null;
  parent_logical_id: string | null;
  child_logical_id: string | null;
  child_sequence: number;
};

export type GraphState = {
  logical_node_ids: string[];
  instance_ids: string[];
  edges: GraphEdge[];
};

export type TimelineEntry = {
  event_id: string;
  sequence: number;
  type: string;
  status: string | null;
  node_id: string | null;
  execution_instance_id: string | null;
  parent_event_id: string | null;
};

export type TimelineState = {
  entries: TimelineEntry[];
};

export type ProjectionState = {
  run: RunState;
  nodes: NodeState[];
  graph: GraphState;
  timeline: TimelineState;
};

export type ProjectionCursor = {
  last_sequence: number;
  event_count: number;
  tip_event_id: string | null;
};

export type StatePatch = {
  schema_version: string;
  run_id: string | null;
  from_cursor: ProjectionCursor;
  to_cursor: ProjectionCursor;
  run: RunState | null;
  nodes: NodeState[] | null;
  graph: GraphState | null;
  timeline: TimelineState | null;
};

export function emptyProjection(): ProjectionState {
  return {
    run: {
      run_id: null,
      status: null,
      started_event_id: null,
      last_sequence: 0,
      checkpoints: [],
      forked_from_run_id: null,
      fork_source_checkpoint_id: null,
      fork_source_event_id: null,
      child_run_ids: [],
    },
    nodes: [],
    graph: { logical_node_ids: [], instance_ids: [], edges: [] },
    timeline: { entries: [] },
  };
}
