import { z } from "zod";
import type { ProgressEntry, ProgressTarget } from "@/lib/progress/rules";
import { createClient } from "@/lib/supabase/server";

// The pure rules live in lib/progress (the player imports them client-side);
// re-exported here so server callers have one progress module to reach for.
export { FINISHED_FRACTION, isFinished } from "@/lib/progress/rules";
export type { ProgressEntry, ProgressTarget } from "@/lib/progress/rules";

const progressRowSchema = z.object({
  tmdb_id: z.number().int(),
  media_type: z.enum(["movie", "tv"]),
  season: z.number().int(),
  episode: z.number().int(),
  position_seconds: z.number().int(),
  duration_seconds: z.number().int(),
});

const PROGRESS_COLUMNS =
  "tmdb_id, media_type, season, episode, position_seconds, duration_seconds";

function toEntry(row: z.infer<typeof progressRowSchema>): ProgressEntry {
  return {
    tmdbId: row.tmdb_id,
    mediaType: row.media_type,
    season: row.season,
    episode: row.episode,
    positionSeconds: row.position_seconds,
    durationSeconds: row.duration_seconds,
  };
}

// The signed-in user's progress, most recently watched first - RLS ("own
// progress all") scopes every query to auth.uid(), so reads carry no user_id
// filter. The season/episode tie-breakers settle an episode and the next one
// it queued in the same instant in favor of the later episode. Call behind
// requireUser().
export async function getProgressEntries(): Promise<ProgressEntry[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("watch_progress")
    .select(PROGRESS_COLUMNS)
    .order("updated_at", { ascending: false })
    .order("season", { ascending: false })
    .order("episode", { ascending: false });

  if (error) {
    throw new Error(`watch_progress read failed: ${error.message}`);
  }

  return z.array(progressRowSchema).parse(data).map(toEntry);
}

export async function getProgressFor(
  target: ProgressTarget,
): Promise<ProgressEntry | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("watch_progress")
    .select(PROGRESS_COLUMNS)
    .eq("tmdb_id", target.tmdbId)
    .eq("media_type", target.mediaType)
    .eq("season", target.season)
    .eq("episode", target.episode)
    .maybeSingle();

  if (error) {
    throw new Error(`watch_progress lookup failed: ${error.message}`);
  }

  return data === null ? null : toEntry(progressRowSchema.parse(data));
}

// userId must come from the server-verified session (requireApiUser()), never
// from the client. updated_at is set here on purpose: the column default only
// fires on insert and there is no trigger, so an upsert that omitted it would
// leave a resumed title looking as old as its first beat - and Continue
// Watching orders by it.
export async function upsertProgress(
  userId: string,
  entry: ProgressEntry,
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("watch_progress").upsert(
    {
      user_id: userId,
      tmdb_id: entry.tmdbId,
      media_type: entry.mediaType,
      season: entry.season,
      episode: entry.episode,
      position_seconds: entry.positionSeconds,
      duration_seconds: entry.durationSeconds,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,tmdb_id,media_type,season,episode" },
  );

  if (error) {
    throw new Error(`watch_progress upsert failed: ${error.message}`);
  }
}
