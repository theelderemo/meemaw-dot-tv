// The watched-progress bar on cards: theme-primary fill on a dim gray track.
export default function ProgressBar({
  fraction,
  className = "",
}: {
  /** 0–1 watched. */
  fraction: number;
  className?: string;
}) {
  const percent = Math.round(fraction * 100);
  return (
    <div
      role="progressbar"
      aria-label="Watched"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      className={`h-[3px] overflow-hidden bg-neutral-500 ${className}`}
    >
      {/* min-w: a just-started film rounds to 0% - still show a sliver. */}
      <div
        className="bg-primary h-full min-w-0.5"
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}
