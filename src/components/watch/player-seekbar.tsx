"use client";

import { useRef, useState } from "react";
import { formatTime } from "./format-time";

// The seekbar: primary played bar over a dim
// rail with the buffered range between (the rail stays dim on purpose -
// never near-white), thumb on hover, time preview at
// the pointer. Scrubbing shows the drag position live and commits the seek on
// release. Arrow-key seeking is handled by the player's global shortcuts, so
// the focused slider responds to ←/-> without double-handling.
export default function PlayerSeekbar({
  currentTime,
  duration,
  bufferedEnd,
  onSeek,
}: {
  currentTime: number;
  duration: number;
  bufferedEnd: number;
  onSeek: (seconds: number) => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  // The ref is the live scrub value the pointer handlers read; the state only
  // drives the visuals. A quick click fires down+up before React re-renders,
  // so an up handler reading the *state* would still see null and drop the
  // seek (seen live).
  const scrubRef = useRef<number | null>(null);
  const [scrubTime, setScrubTime] = useState<number | null>(null);
  const [hover, setHover] = useState<{ x: number; time: number } | null>(null);

  const timeAtPointer = (
    clientX: number,
  ): { x: number; time: number } | null => {
    const track = trackRef.current;
    if (!track || duration <= 0) return null;
    const rect = track.getBoundingClientRect();
    if (rect.width === 0) return null;
    const x = Math.min(Math.max(clientX - rect.left, 0), rect.width);
    return { x, time: (x / rect.width) * duration };
  };

  const shownTime = scrubTime ?? currentTime;
  const playedPercent = duration > 0 ? (shownTime / duration) * 100 : 0;
  const bufferedPercent =
    duration > 0 ? Math.min((bufferedEnd / duration) * 100, 100) : 0;

  return (
    <div
      ref={trackRef}
      role="slider"
      tabIndex={0}
      aria-label="Seek"
      aria-valuemin={0}
      aria-valuemax={Math.round(duration)}
      aria-valuenow={Math.round(shownTime)}
      aria-valuetext={`${formatTime(shownTime)} of ${formatTime(duration)}`}
      onPointerDown={(event) => {
        const at = timeAtPointer(event.clientX);
        if (!at) return;
        event.currentTarget.setPointerCapture(event.pointerId);
        scrubRef.current = at.time;
        setScrubTime(at.time);
        setHover(at);
      }}
      onPointerMove={(event) => {
        const at = timeAtPointer(event.clientX);
        if (!at) return;
        setHover(at);
        if (scrubRef.current !== null) {
          scrubRef.current = at.time;
          setScrubTime(at.time);
        }
      }}
      onPointerUp={() => {
        if (scrubRef.current !== null) {
          onSeek(scrubRef.current);
          scrubRef.current = null;
          setScrubTime(null);
        }
      }}
      onPointerCancel={() => {
        scrubRef.current = null;
        setScrubTime(null);
      }}
      onPointerLeave={() => setHover(null)}
      className="group relative flex h-6 flex-1 cursor-pointer touch-none items-center"
    >
      <div className="relative h-1 w-full bg-white/30 transition-[height] duration-150 group-hover:h-1.5">
        <div
          aria-hidden="true"
          className="absolute inset-y-0 left-0 bg-white/40"
          style={{ width: `${bufferedPercent}%` }}
        />
        <div
          aria-hidden="true"
          className="bg-primary absolute inset-y-0 left-0"
          style={{ width: `${playedPercent}%` }}
        />
      </div>
      <div
        aria-hidden="true"
        style={{ left: `${playedPercent}%` }}
        className={`bg-primary absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full transition-transform duration-150 ${
          scrubTime !== null ? "scale-100" : "scale-0 group-hover:scale-100"
        }`}
      />
      {hover !== null && (
        <div
          style={{ left: hover.x }}
          className="pointer-events-none absolute bottom-full mb-3 -translate-x-1/2 rounded bg-black/90 px-2.5 py-1 text-sm font-bold whitespace-nowrap"
        >
          {formatTime(hover.time)}
        </div>
      )}
    </div>
  );
}
