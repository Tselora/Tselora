export type LiveBadgeKind = "live" | "historical" | "reconnecting";

export function liveBadgeKind(
  view: "live" | "historical",
  status: "loading" | "live" | "resyncing" | "error",
): LiveBadgeKind {
  if (view === "historical") {
    return "historical";
  }
  if (status === "resyncing" || status === "loading") {
    return "reconnecting";
  }
  return "live";
}
