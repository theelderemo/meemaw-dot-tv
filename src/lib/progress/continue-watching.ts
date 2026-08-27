import { getMovieDetails, getTvDetails } from "../tmdb/endpoints";
import type { Title } from "../tmdb/schemas";
import { isFinished, type ProgressEntry } from "./rules";

// Every streaming app caps this row; for a small household anything beyond
// this is noise, not history.
export const CONTINUE_WATCHING_LIMIT = 20;

function titleKey(entry: ProgressEntry): string {
  return `${entry.mediaType}-${entry.tmdbId}`;
}

// Row items from newest-first watch_progress rows: one card per title (its
// most recent episode for TV), finished movies gone - nothing left to
// continue - and capped. A finished episode stays: the route already queued
// the following episode, so a show's newest entry is normally that next one,
// and a finished series finale still shows the show rather than vanishing.
export function continueWatchingItems(
  entries: ProgressEntry[],
): ProgressEntry[] {
  const seen = new Set<string>();
  const items: ProgressEntry[] = [];
  for (const entry of entries) {
    if (items.length >= CONTINUE_WATCHING_LIMIT) break;
    const key = titleKey(entry);
    if (seen.has(key)) continue;
    seen.add(key);
    if (
      entry.mediaType === "movie" &&
      isFinished(entry.positionSeconds, entry.durationSeconds)
    ) {
      continue;
    }
    items.push(entry);
  }
  return items;
}

// Mirrors my-list-titles.ts: items resolved into displayable titles through
// the same 24h-cached detail fetchers the modal uses, order preserved. A title
// whose fetch fails is dropped with a log - one bad TMDB id never sinks browse.
export async function resolveContinueWatchingTitles(
  items: ProgressEntry[],
): Promise<Title[]> {
  const settled = await Promise.allSettled(
    items.map((item) =>
      item.mediaType === "movie"
        ? getMovieDetails(item.tmdbId)
        : getTvDetails(item.tmdbId),
    ),
  );

  const titles: Title[] = [];
  settled.forEach((result, index) => {
    const { mediaType, tmdbId } = items[index];
    if (result.status === "fulfilled") {
      titles.push(result.value);
    } else {
      console.error(
        `[continue-watching] dropping ${mediaType}/${tmdbId}: details fetch failed`,
        result.reason,
      );
    }
  });
  return titles;
}
