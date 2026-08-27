"use client";

import Link from "next/link";
import type { EpisodeRef } from "@/lib/progress/rules";
import type { MediaType } from "@/lib/tmdb/schemas";
import { useResumeHref } from "./watch-progress-provider";

// The Play button is white with black text - stays white per the theming
// map (white stays white; primary is the only accent). Resume-aware: a show with
// saved progress opens its in-progress episode, an unstarted one `firstEpisode`
// (the modal passes its first listed season; the billboard takes S1:E1);
// movies open their one route and resume on the watch page. `compact` is the
// detail-modal size; default is the billboard's responsive scale.
export default function PlayButton({
  mediaType,
  id,
  firstEpisode,
  compact = false,
}: {
  mediaType: MediaType;
  id: number;
  firstEpisode?: EpisodeRef;
  compact?: boolean;
}) {
  const href = useResumeHref(mediaType, id, firstEpisode);

  return (
    <Link
      href={href}
      className={`flex items-center justify-center gap-2 rounded bg-white font-bold whitespace-nowrap text-black transition-colors hover:bg-white/75 ${
        compact
          ? "px-6 py-1.5 text-lg"
          : "px-2 py-1 text-lg sm:px-4 sm:py-2 sm:text-2xl md:text-[1.75rem]"
      }`}
    >
      <svg
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden="true"
        className={
          compact ? "h-7 w-7" : "h-6 w-6 sm:h-8 sm:w-8 md:h-10 md:w-10"
        }
      >
        <path d="M8 5v14l11-7z" />
      </svg>
      Play
    </Link>
  );
}
