"use client";

import { useRef } from "react";
import Image from "next/image";
import { progressFraction } from "@/lib/progress/rules";
import { useDetailModal } from "./detail-modal-provider";
import { usePortal, type RowEdge } from "./portal-provider";
import type { PosterTitle } from "./poster-slider";
import ProgressBar from "./progress-bar";
import { tmdbImageUrl } from "./tmdb-image";
import { useWatchProgress } from "./watch-progress-provider";

// The poster tile reports itself as the
// portal anchor on hover. It's a button so keyboard/touch users get a
// direct path to the detail modal (the hover card is a mouse-only affordance).
export default function VideoItemWithHover({
  title,
  edge,
  isVisible,
  showProgress = false,
}: {
  title: PosterTitle;
  edge: RowEdge;
  isVisible: boolean;
  /** Continue Watching only: the watched bar drawn along the tile. */
  showProgress?: boolean;
}) {
  const setPortal = usePortal();
  const { openTitle } = useDetailModal();
  const { getProgress } = useWatchProgress();
  const elementRef = useRef<HTMLButtonElement>(null);

  const progress = showProgress ? getProgress(title.mediaType, title.id) : null;
  const watchedFraction = progress ? progressFraction(progress) : null;

  return (
    <button
      ref={elementRef}
      type="button"
      // Off-window tiles are unfocusable so tabbing can't scroll the clipped
      // row track out from under the slider's translate.
      tabIndex={isVisible ? undefined : -1}
      onClick={() => openTitle(title.mediaType, title.id)}
      onPointerEnter={(event) => {
        // Touch taps fire pointerenter too - no hover card on touch; the
        // tap goes straight to the modal via onClick.
        if (event.pointerType !== "mouse" || !elementRef.current) return;
        setPortal({ anchor: elementRef.current, title, edge });
      }}
      className="relative block aspect-[2/3] w-full cursor-pointer overflow-hidden rounded"
    >
      <Image
        src={tmdbImageUrl("w500", title.posterPath)}
        alt={title.title}
        fill
        sizes="(min-width:1536px) 16vw, (min-width:1024px) 20vw, (min-width:768px) 25vw, (min-width:640px) 33vw, 50vw"
        className="object-cover"
      />
      {watchedFraction !== null && (
        <ProgressBar
          fraction={watchedFraction}
          className="absolute inset-x-1.5 bottom-1"
        />
      )}
    </button>
  );
}
