import type { GraphState } from "../types/projection";

export type SiblingGroup = {
  parentInstanceId: string;
  childInstanceIds: string[];
};

/** Parents with two or more child instances. Order follows first appearance on ``graph.edges``. */

export function siblingGroups(graph: GraphState): SiblingGroup[] {
  const childrenByParent = new Map<string, string[]>();
  for (const edge of graph.edges) {
    const parent = edge.parent_instance_id;
    const child = edge.child_instance_id;
    if (parent == null || child == null) {
      continue;
    }
    const list = childrenByParent.get(parent) ?? [];
    if (!list.includes(child)) {
      list.push(child);
    }
    childrenByParent.set(parent, list);
  }
  const groups: SiblingGroup[] = [];
  for (const [parentInstanceId, childInstanceIds] of childrenByParent) {
    if (childInstanceIds.length >= 2) {
      groups.push({ parentInstanceId, childInstanceIds });
    }
  }
  return groups;
}
