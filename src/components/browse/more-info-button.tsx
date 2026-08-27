"use client";

import type { MediaType } from "@/lib/tmdb/schemas";
import { useDetailModal } from "./detail-modal-provider";

// The billboard's translucent gray secondary button - the reference shade is
// rgba(109,109,110,.7); neutral-500/70 is the closest stock Tailwind
// equivalent (no raw hex in components). Opens the detail modal for the
// billboard title.
export default function MoreInfoButton({
  mediaType,
  id,
}: {
  mediaType: MediaType;
  id: number;
}) {
  const { openTitle } = useDetailModal();

  return (
    <button
      type="button"
      onClick={() => openTitle(mediaType, id)}
      className="text-foreground flex cursor-pointer items-center justify-center gap-2 rounded bg-neutral-500/70 px-2 py-1 text-lg font-bold whitespace-nowrap transition-colors hover:bg-neutral-500/40 sm:px-4 sm:py-2 sm:text-2xl md:text-[1.75rem]"
    >
      <svg
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden="true"
        className="h-6 w-6 sm:h-8 sm:w-8 md:h-10 md:w-10"
      >
        <path d="M11 7h2v2h-2zm0 4h2v6h-2zm1-9C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z" />
      </svg>
      More Info
    </button>
  );
}
