import type { MediaType } from "../tmdb/schemas";

// Pure progress arithmetic shared by the player (client), the /api/progress
// route, and the Continue Watching row. No I/O here - lib/db/watch-progress.ts
// owns the queries and re-exports these for callers already on that side.

/** A season/episode pair. Movies store 0/0 (schema defaults, supabase.md). */
export type EpisodeRef = { season: number; episode: number };

export type ProgressTarget = {
  mediaType: MediaType;
  tmdbId: number;
} & EpisodeRef;

export type ProgressEntry = ProgressTarget & {
  positionSeconds: number;
  durationSeconds: number;
};

/** POST /api/progress body. `advanceTo` rides the beat that finishes an
 * episode: the route also stores that next episode at position 0, which is
 * what moves Continue Watching and every Play button forward on its own. */
export type ProgressBeat = ProgressEntry & { advanceTo?: EpisodeRef };

// A title counts as watched once the credits are in sight, not at the
// literal last frame - a post-credits stretch would otherwise keep many titles
// from ever finishing.
export const FINISHED_FRACTION = 0.9;

export function isFinished(
  positionSeconds: number,
  durationSeconds: number,
): boolean {
  return (
    durationSeconds > 0 &&
    positionSeconds / durationSeconds >= FINISHED_FRACTION
  );
}

// Where playback starts for a saved entry: a finished title restarts from the
// top. Resume is silent - no "resume or start over?" prompt.
export function resumePosition(entry: ProgressEntry | null): number {
  if (!entry || isFinished(entry.positionSeconds, entry.durationSeconds)) {
    return 0;
  }
  return entry.positionSeconds;
}

// Card progress-bar fill, or null when there is nothing to draw - an unstarted
// entry (the next episode queued at 0) shows no bar.
export function progressFraction(entry: ProgressEntry): number | null {
  if (entry.positionSeconds <= 0 || entry.durationSeconds <= 0) return null;
  return Math.min(entry.positionSeconds / entry.durationSeconds, 1);
}
