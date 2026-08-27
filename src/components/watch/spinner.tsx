// The branded animated loader, where a stock spinner arc would otherwise sit
// - a deliberate departure from the faithful-UI rule (ui-fidelity.md
// §Deliberate departures). Takes whatever file is at /meemaw-loader.webp.
export default function Spinner() {
  return (
    <div role="status" className="h-16 w-16">
      {/* eslint-disable-next-line @next/next/no-img-element -- static asset
          served as-is; next/image would lazy-load a loading indicator and
          route an animated webp through the optimizer for nothing. */}
      <img
        src="/meemaw-loader.webp"
        alt=""
        aria-hidden="true"
        className="h-full w-full"
      />
      <span className="sr-only">Loading…</span>
    </div>
  );
}
