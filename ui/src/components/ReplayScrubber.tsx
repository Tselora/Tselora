export function ReplayScrubber({
  view,
  throughSequence,
  tipLastSequence,
  onHistorical,
  onLive,
}: {
  view: "live" | "historical";
  throughSequence: number | null;
  tipLastSequence: number;
  onHistorical: (n: number) => void;
  onLive: () => void;
}) {
  const max = Math.max(0, tipLastSequence);
  const n = view === "historical" && throughSequence != null ? throughSequence : max;

  function clamp(value: number) {
    return Math.min(max, Math.max(0, value));
  }

  return (
    <section>
      <h2>Execution Replay</h2>
      <p className="muted">This does not re-run the agent.</p>
      <div className="scrubber replay-controls">
        <button type="button" onClick={() => onHistorical(clamp(n - 1))} disabled={n <= 0}>
          Previous
        </button>
        <button type="button" onClick={() => onHistorical(clamp(n + 1))} disabled={n >= max}>
          Next
        </button>
        <button type="button" onClick={onLive} disabled={view === "live"}>
          Live
        </button>
      </div>
      <p className={view === "historical" ? "replay-view historical" : "replay-view live"}>
        Viewing execution at event {n} of {max}
      </p>
    </section>
  );
}
