import type { MediaType } from "@/lib/tmdb/schemas";

// The /watch URL contract in one place: every Play entry point builds its
// href here, and the watch pages parse their params here, so the two sides
// can't drift apart.

// TV callers without episode context default to S1:E1; the resume-aware
// entry points pass the saved episode (watch-progress-provider's
// useResumeHref) and the episode rows their own.
export function watchHref(
  mediaType: MediaType,
  tmdbId: number,
  season = 1,
  episode = 1,
): string {
  return mediaType === "movie"
    ? `/watch/movie/${tmdbId}`
    : `/watch/tv/${tmdbId}/${season}/${episode}`;
}

// Route params arrive as strings and may be arbitrary junk from the address
// bar; anything non-numeric or out of range reads as "we don't have that one".
export function parseRouteInt(raw: string, min: number): number | null {
  if (!/^\d+$/.test(raw)) return null;
  const value = Number(raw);
  return Number.isSafeInteger(value) && value >= min ? value : null;
}
