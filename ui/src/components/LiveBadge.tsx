import { liveBadgeKind } from "../present";

export function LiveBadge({
  view,
  status,
}: {
  view: "live" | "historical";
  status: "loading" | "live" | "resyncing" | "error";
}) {
  const kind = liveBadgeKind(view, status);
  const label = kind === "live" ? "Live" : kind === "historical" ? "Historical" : "Reconnecting";
  const mark = kind === "live" ? "●" : kind === "historical" ? "◷" : "○";
  return (
    <span className={`live-badge live-badge-${kind}`} data-kind={kind}>
      {mark} {label}
    </span>
  );
}
