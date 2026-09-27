/** Comparison document shape from POST /v1/comparisons (ADR-010). */

export type Completeness = "full" | "provisional";
export type WhyKeyState = "equal" | "changed" | "missing_left" | "missing_right";

export type SideEqual = {
  left: unknown;
  right: unknown;
  equal: boolean;
};

export type NumericDelta = {
  left: number;
  right: number;
  delta: number;
};

export type SetDiff = {
  only_left: unknown[];
  only_right: unknown[];
  both: unknown[];
};

export type LineageAnnotation = {
  parent_run_id: string;
  child_run_id: string;
  source_checkpoint_id: string;
  source_event_id: string | null;
};

export type OutcomeDiff = {
  status: SideEqual;
  terminal: SideEqual;
  failure_category: SetDiff;
};

export type WhyInstancePair = {
  logical_node_id: string;
  index: number;
  left_execution_instance_id: string | null;
  right_execution_instance_id: string | null;
  presence: "paired" | "only_left" | "only_right";
  keys: Record<string, WhyKeyState>;
};

export type WhyDiff = {
  instances: WhyInstancePair[];
};

export type NodeTypeMismatch = {
  logical_node_id: string;
  left: string | null;
  right: string | null;
};

export type TopologyDiff = {
  logical_node_ids: SetDiff;
  node_type_mismatches: NodeTypeMismatch[];
  instance_count: NumericDelta;
  edge_count: NumericDelta;
  logical_family_counts: Record<string, NumericDelta>;
  edges: SetDiff;
  retry_family_counts: Record<string, NumericDelta>;
};

export type TimingDiff = {
  event_count: NumericDelta;
  last_sequence: NumericDelta;
  instance_count: NumericDelta;
};

export type ControlDiff = {
  had_pause: SideEqual;
  had_resume: SideEqual;
  terminal_cancelled: SideEqual;
};

export type ExperienceSummaryDiff = {
  left_present: boolean;
  right_present: boolean;
  left_experience_id: string | null;
  right_experience_id: string | null;
  structure_fingerprint: SideEqual | null;
  retry_family_counts_equal: boolean | null;
  decisions: SetDiff | null;
  failed_instance_count: NumericDelta | null;
  failure_category: SetDiff | null;
};

export type ComparisonDocument = {
  schema_version: string;
  comparison_id: string;
  left_run_id: string;
  right_run_id: string;
  completeness: Completeness;
  lineage: LineageAnnotation | null;
  outcome: OutcomeDiff;
  why: WhyDiff;
  topology: TopologyDiff;
  timing: TimingDiff;
  control: ControlDiff;
  experience: ExperienceSummaryDiff;
};

export function isComparisonDocument(value: unknown): value is ComparisonDocument {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const doc = value as Record<string, unknown>;
  return (
    typeof doc.comparison_id === "string" &&
    typeof doc.left_run_id === "string" &&
    typeof doc.right_run_id === "string" &&
    (doc.completeness === "full" || doc.completeness === "provisional") &&
    typeof doc.outcome === "object" &&
    doc.outcome !== null &&
    typeof doc.why === "object" &&
    doc.why !== null &&
    typeof doc.topology === "object" &&
    doc.topology !== null &&
    typeof doc.timing === "object" &&
    doc.timing !== null &&
    typeof doc.control === "object" &&
    doc.control !== null &&
    typeof doc.experience === "object" &&
    doc.experience !== null
  );
}
