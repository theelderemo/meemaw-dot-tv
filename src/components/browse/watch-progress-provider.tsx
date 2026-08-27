"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { watchHref } from "@/components/watch/watch-route";
import type { EpisodeRef, ProgressEntry } from "@/lib/progress/rules";
import type { MediaType } from "@/lib/tmdb/schemas";

// Saved progress for the Play entry points (billboard, hover card, modal) and
// the Continue Watching cards: a per-title lookup seeded from the server
// render's newest-first watch_progress rows, so the first entry seen for a
// title is its most recent one. Read-only on the client - the player writes
// through /api/progress and the next server render re-seeds.

function progressKey(mediaType: MediaType, id: number): string {
  return `${mediaType}-${id}`;
}

type WatchProgressContextValue = {
  /** The title's most recent entry (for TV: its in-progress episode). */
  getProgress: (mediaType: MediaType, id: number) => ProgressEntry | null;
};

const WatchProgressContext = createContext<WatchProgressContextValue | null>(
  null,
);

export function useWatchProgress(): WatchProgressContextValue {
  const value = useContext(WatchProgressContext);
  if (!value) {
    throw new Error(
      "useWatchProgress must be used inside WatchProgressProvider",
    );
  }
  return value;
}

const FIRST_EPISODE: EpisodeRef = { season: 1, episode: 1 };

// The resume-aware Play target: a show with saved progress opens its most
// recent episode (after a finished one, the queued next episode), an
// unstarted show its opener; movies always open their one route and resume
// on the watch page itself.
export function useResumeHref(
  mediaType: MediaType,
  id: number,
  firstEpisode: EpisodeRef = FIRST_EPISODE,
): string {
  const { getProgress } = useWatchProgress();
  if (mediaType === "movie") return watchHref("movie", id);
  const episode = getProgress("tv", id) ?? firstEpisode;
  return watchHref("tv", id, episode.season, episode.episode);
}

export default function WatchProgressProvider({
  initialEntries,
  children,
}: {
  initialEntries: ProgressEntry[];
  children: ReactNode;
}) {
  const byTitle = useMemo(() => {
    const map = new Map<string, ProgressEntry>();
    for (const entry of initialEntries) {
      const key = progressKey(entry.mediaType, entry.tmdbId);
      if (!map.has(key)) map.set(key, entry);
    }
    return map;
  }, [initialEntries]);

  const value = useMemo<WatchProgressContextValue>(
    () => ({
      getProgress: (mediaType, id) =>
        byTitle.get(progressKey(mediaType, id)) ?? null,
    }),
    [byTitle],
  );

  return (
    <WatchProgressContext.Provider value={value}>
      {children}
    </WatchProgressContext.Provider>
  );
}
