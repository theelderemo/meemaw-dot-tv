// The coming-soon tone where a Play control would otherwise sit: plain
// muted text with nothing to press (no "Remind Me"). `date` is the label from
// release.ts comingDate(); callers size it for their slot.
export default function ComingSoon({
  date,
  className = "",
}: {
  date: string;
  className?: string;
}) {
  return (
    <span className={`text-muted whitespace-nowrap ${className}`}>
      Coming {date}
    </span>
  );
}
