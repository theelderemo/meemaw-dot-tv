"use client";

import Image from "next/image";
import Link from "next/link";
import { progressFraction } from "@/lib/progress/rules";
import { genreNames } from "@/lib/tmdb/genres";
import { comingDate } from "@/lib/tmdb/release";
import type { Title } from "@/lib/tmdb/schemas";
import ComingSoon from "./coming-soon";
import { useDetailModal } from "./detail-modal-provider";
import IconButton from "./icon-button";
import MyListButton from "./my-list-button";
import { usePortal } from "./portal-provider";
import ProgressBar from "./progress-bar";
import { tmdbImageUrl } from "./tmdb-image";
import { useToday } from "./today-provider";
import { useResumeHref, useWatchProgress } from "./watch-progress-provider";

// The mini card shows at most three genre crumbs.
const MAX_GENRES = 3;

// The hover mini card: backdrop with the title overlaid, icon-button row,
// metadata line, genre breadcrumbs; pointer-leave collapses the card.
export default function VideoCardPortal({ title }: { title: Title }) {
  const setPortal = usePortal();
  const { openTitle } = useDetailModal();
  const { getProgress } = useWatchProgress();
  const progress = getProgress(title.mediaType, title.id);
  const playHref = useResumeHref(title.mediaType, title.id);
  const today = useToday();
  const watchedFraction = progress ? progressFraction(progress) : null;
  // Summary data only (standing ruling: no details fetch for the card) - the
  // release date rides every TMDB list result.
  const coming = comingDate(title.releaseDate, today);

  const openModal = () => {
    // The mini card dismisses the moment the modal opens - left lingering
    // under the overlay it reads as a glitch.
    setPortal(null);
    openTitle(title.mediaType, title.id);
  };

  const genres = genreNames(title.genreIds).slice(0, MAX_GENRES);
  const matchPercent = Math.round(title.rating * 10);
  const backdropPath = title.backdropPath ?? title.posterPath;

  return (
    <div
      onPointerLeave={() => setPortal(null)}
      onClick={openModal}
      className="bg-background-elevated cursor-pointer overflow-hidden rounded-md shadow-[0_3px_10px_rgba(0,0,0,0.75)]"
    >
      <div className="relative aspect-video w-full">
        {backdropPath ? (
          <Image
            src={tmdbImageUrl("w780", backdropPath)}
            alt=""
            fill
            sizes="35vw"
            className="object-cover"
          />
        ) : (
          <div className="absolute inset-0 bg-neutral-800" />
        )}
        <div
          aria-hidden="true"
          className="absolute inset-x-0 bottom-0 h-16 bg-linear-to-t from-black/70 to-transparent"
        />
        <h3 className="absolute inset-x-4 bottom-2 line-clamp-2 text-lg font-bold">
          {title.title}
        </h3>
      </div>
      <div className="flex flex-col gap-3 p-4">
        <div className="flex items-center gap-2">
          {/* Not out yet: the date stands where Play would; My List
              still works. stopPropagation on Play: the whole card opens the
              modal; Play must only navigate. */}
          {coming !== null ? (
            <ComingSoon
              date={coming}
              className="flex h-9 items-center text-sm font-medium"
            />
          ) : (
            <Link
              href={playHref}
              aria-label={`Play ${title.title}`}
              onClick={(event) => event.stopPropagation()}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-black transition-colors hover:bg-white/80"
            >
              <svg
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden="true"
                className="h-5 w-5"
              >
                <path d="M8 5v14l11-7z" />
              </svg>
            </Link>
          )}
          <MyListButton mediaType={title.mediaType} id={title.id} />
          <span className="flex-1" />
          <IconButton label="More info" onClick={openModal}>
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
              <path d="M6 9l6 6 6-6" />
            </svg>
          </IconButton>
        </div>
        {/* The mini card shows where the viewer is: the watched bar (once
            something has played) and, for a show, the episode Play resumes. */}
        {progress && (watchedFraction !== null || title.mediaType === "tv") && (
          <div className="flex items-center gap-3 text-sm">
            {watchedFraction !== null && (
              <ProgressBar fraction={watchedFraction} className="flex-1" />
            )}
            {title.mediaType === "tv" && (
              <span className="text-muted shrink-0">
                S{progress.season}:E{progress.episode}
              </span>
            )}
          </div>
        )}
        <div className="flex items-center gap-2 text-sm">
          {matchPercent > 0 && (
            <span className="font-medium text-green-400">
              {matchPercent}% Match
            </span>
          )}
          {title.year !== null && (
            <span className="text-muted">{title.year}</span>
          )}
        </div>
        {genres.length > 0 && (
          <ul className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
            {genres.map((genre, index) => (
              <li key={genre} className="flex items-center gap-2">
                {index > 0 && (
                  <span
                    aria-hidden="true"
                    className="bg-muted-dark h-1 w-1 rounded-full"
                  />
                )}
                {genre}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
