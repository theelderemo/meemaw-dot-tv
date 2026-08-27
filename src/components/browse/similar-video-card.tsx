"use client";

import Image from "next/image";
import type { Title } from "@/lib/tmdb/schemas";
import IconButton from "./icon-button";
import { tmdbImageUrl } from "./tmdb-image";

// More Like This card: backdrop with the title overlaid, then match/year
// and a "+" button, then a clamped overview. Clicking anywhere swaps the
// modal to this title. role="button" div because a real <button> can't nest
// the "+".
export default function SimilarVideoCard({
  title,
  onSelect,
}: {
  title: Title;
  onSelect: () => void;
}) {
  const image = title.backdropPath ?? title.posterPath;
  const matchPercent = Math.round(title.rating * 10);

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={title.title}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect();
        }
      }}
      className="cursor-pointer overflow-hidden rounded bg-neutral-800"
    >
      <div className="relative aspect-video w-full">
        {image ? (
          <Image
            src={tmdbImageUrl("w780", image)}
            alt=""
            fill
            sizes="(min-width:640px) 280px, 45vw"
            className="object-cover"
          />
        ) : (
          <div className="absolute inset-0 bg-neutral-700" />
        )}
        <div
          aria-hidden="true"
          className="absolute inset-x-0 bottom-0 h-12 bg-linear-to-t from-black/70 to-transparent"
        />
        <p className="absolute inset-x-3 bottom-1.5 line-clamp-1 font-bold">
          {title.title}
        </p>
      </div>
      <div className="p-4">
        <div className="flex items-center gap-4">
          <div className="min-w-0 flex-1 text-sm">
            {matchPercent > 0 && (
              <p className="font-medium text-green-400">
                {matchPercent}% Match
              </p>
            )}
            {title.year !== null && <p className="text-muted">{title.year}</p>}
          </div>
          {/* Add-to-My-List is inert - not wired to the my_list table yet. */}
          <IconButton
            label="Add to My List"
            onClick={(event) => event.stopPropagation()}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              aria-hidden="true"
              className="h-5 w-5"
            >
              <path d="M12 5v14M5 12h14" />
            </svg>
          </IconButton>
        </div>
        {title.overview !== "" && (
          <p className="text-muted mt-3 line-clamp-4 text-sm">
            {title.overview}
          </p>
        )}
      </div>
    </div>
  );
}
