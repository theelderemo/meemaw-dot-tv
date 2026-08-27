"use client";

import type { MediaType } from "@/lib/tmdb/schemas";
import IconButton from "./icon-button";
import { useMyList } from "./my-list-provider";

// The +/✓ My List toggle shared by the hover card and the detail modal.
// stopPropagation: in the hover card the whole surface opens the modal.
export default function MyListButton({
  mediaType,
  id,
}: {
  mediaType: MediaType;
  id: number;
}) {
  const { isInMyList, toggleMyList } = useMyList();
  const inList = isInMyList(mediaType, id);

  return (
    <IconButton
      label={inList ? "Remove from My List" : "Add to My List"}
      onClick={(event) => {
        event.stopPropagation();
        toggleMyList(mediaType, id);
      }}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className="h-5 w-5"
      >
        {inList ? <path d="M5 12l5 5L20 7" /> : <path d="M12 5v14M5 12h14" />}
      </svg>
    </IconButton>
  );
}
