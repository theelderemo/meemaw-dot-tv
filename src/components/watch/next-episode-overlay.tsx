"use client";

import { useEffect, useRef } from "react";
import { PlayIcon } from "./player-icons";

export const NEXT_EPISODE_COUNTDOWN_MS = 5000;

// The end-of-episode card: a "Next Episode" button whose background
// fills left to right as the countdown runs; clicking goes now. The timer
// itself lives in the player, where the back arrow can cancel it.
export default function NextEpisodeOverlay({ onNext }: { onNext: () => void }) {
  const fillRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const animation = fillRef.current?.animate(
      [{ width: "0%" }, { width: "100%" }],
      {
        duration: NEXT_EPISODE_COUNTDOWN_MS,
        easing: "linear",
        fill: "forwards",
      },
    );
    return () => animation?.cancel();
  }, []);

  return (
    <div className="absolute right-4 bottom-36 sm:right-8">
      <button
        type="button"
        onClick={onNext}
        className="relative isolate flex cursor-pointer items-center overflow-hidden rounded bg-neutral-500/70 px-8 py-3 text-xl font-bold"
      >
        <span
          ref={fillRef}
          aria-hidden="true"
          className="absolute inset-y-0 left-0 w-0 bg-white"
        />
        {/* difference blend: white over the gray button, black over the
            white fill as it sweeps underneath. */}
        <span className="relative flex items-center gap-2 text-white mix-blend-difference">
          <PlayIcon className="h-7 w-7" />
          Next Episode
        </span>
      </button>
    </div>
  );
}
