"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { watchHref } from "@/components/watch/watch-route";
import { comingDate } from "@/lib/tmdb/release";
import type { Episode, SeasonSummary } from "@/lib/tmdb/schemas";
import ComingSoon from "./coming-soon";
import { useDetailModal } from "./detail-modal-provider";
import { formatRuntime } from "./runtime";
import SeasonSelector from "./season-selector";
import { tmdbImageUrl } from "./tmdb-image";
import { useToday } from "./today-provider";

const SKELETON_EPISODE_COUNT = 4;

// The Episodes block: heading + season dropdown, then one row per
// episode (number, still, name + runtime, overview). Each aired row plays its
// episode; hovering shows a play ring over the still. An episode that
// hasn't aired is no link at all - dimmed, its air date where the runtime
// would be.
export default function EpisodesSection({
  tvId,
  seasonOptions,
  fallbackStillPath,
}: {
  tvId: number;
  seasonOptions: SeasonSummary[];
  fallbackStillPath: string | null;
}) {
  const { getSeason, hasSeasonError, requestSeason } = useDetailModal();
  const today = useToday();
  const [seasonNumber, setSeasonNumber] = useState(
    seasonOptions[0]?.seasonNumber ?? 1,
  );

  useEffect(() => {
    requestSeason(tvId, seasonNumber);
  }, [tvId, seasonNumber, requestSeason]);

  const season = getSeason(tvId, seasonNumber);
  const failed = hasSeasonError(tvId, seasonNumber);

  return (
    <section aria-label="Episodes">
      <div className="mb-2 flex items-center justify-between gap-4">
        <h3 className="text-2xl font-bold">Episodes</h3>
        <SeasonSelector
          options={seasonOptions}
          value={seasonNumber}
          onChange={setSeasonNumber}
        />
      </div>
      {season ? (
        <ol>
          {season.episodes.map((episode) => (
            <li key={episode.id} className="border-foreground/15 border-b">
              <EpisodeRow
                episode={episode}
                href={watchHref(
                  "tv",
                  tvId,
                  seasonNumber,
                  episode.episodeNumber,
                )}
                coming={comingDate(episode.airDate, today)}
                fallbackStillPath={fallbackStillPath}
              />
            </li>
          ))}
        </ol>
      ) : failed ? (
        <div className="flex flex-col items-center gap-4 py-10 text-center">
          <p>
            Meemaw&apos;s photo album is stuck together. Give it another try.
          </p>
          <button
            type="button"
            onClick={() => requestSeason(tvId, seasonNumber)}
            className="bg-background-input cursor-pointer rounded px-5 py-2 text-sm font-medium transition-colors hover:bg-neutral-600"
          >
            Try again
          </button>
        </div>
      ) : (
        <EpisodesSkeleton />
      )}
    </section>
  );
}

function EpisodeRow({
  episode,
  href,
  coming,
  fallbackStillPath,
}: {
  episode: Episode;
  href: string;
  /** Formatted air date when the episode hasn't aired; null once it has. */
  coming: string | null;
  fallbackStillPath: string | null;
}) {
  const playable = coming === null;
  const still = episode.stillPath ?? fallbackStillPath;
  const content = (
    <>
      <span className="text-muted w-8 shrink-0 text-center text-2xl">
        {episode.episodeNumber}
      </span>
      {/* Unaired: the still dims and the name mutes, but the date label keeps
          full contrast - it's the one thing the viewer needs to read here. */}
      <div
        className={`relative aspect-video w-28 shrink-0 overflow-hidden rounded sm:w-32 ${
          playable ? "" : "opacity-50"
        }`}
      >
        {still ? (
          <Image
            src={tmdbImageUrl(episode.stillPath ? "w300" : "w780", still)}
            alt=""
            fill
            sizes="128px"
            className="object-cover"
          />
        ) : (
          <div className="absolute inset-0 bg-neutral-800" />
        )}
        {playable && (
          <span
            aria-hidden="true"
            className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-white bg-black/50">
              <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
                <path d="M8 5v14l11-7z" />
              </svg>
            </span>
          </span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-4">
          <p
            className={`line-clamp-1 font-bold ${playable ? "" : "text-muted"}`}
          >
            {episode.name}
          </p>
          {coming !== null ? (
            <ComingSoon date={coming} className="shrink-0 text-sm" />
          ) : (
            episode.runtimeMinutes !== null && (
              <span className="shrink-0 text-sm">
                {formatRuntime(episode.runtimeMinutes)}
              </span>
            )
          )}
        </div>
        {episode.overview !== "" && (
          <p className="text-muted mt-1 line-clamp-2 text-sm">
            {episode.overview}
          </p>
        )}
      </div>
    </>
  );

  return playable ? (
    <Link
      href={href}
      className="group flex items-center gap-4 py-4 transition-colors hover:bg-white/5"
    >
      {content}
    </Link>
  ) : (
    <div className="flex items-center gap-4 py-4">{content}</div>
  );
}

function EpisodesSkeleton() {
  return (
    <div aria-busy="true">
      <p role="status" className="sr-only">
        Loading episodes…
      </p>
      <div aria-hidden="true">
        {Array.from({ length: SKELETON_EPISODE_COUNT }, (_, index) => (
          <div
            key={index}
            className="border-foreground/15 flex items-center gap-4 border-b py-4"
          >
            <div className="h-7 w-8 shrink-0 animate-pulse rounded bg-neutral-800" />
            <div className="aspect-video w-28 shrink-0 animate-pulse rounded bg-neutral-800 sm:w-32" />
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <div className="h-4 w-1/3 animate-pulse rounded bg-neutral-800" />
              <div className="h-3 w-full animate-pulse rounded bg-neutral-800" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
