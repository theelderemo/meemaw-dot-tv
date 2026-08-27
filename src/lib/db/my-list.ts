import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { MediaType } from "@/lib/tmdb/schemas";

const myListRowSchema = z.object({
  tmdb_id: z.number().int(),
  media_type: z.enum(["movie", "tv"]),
});

export type MyListEntry = {
  tmdbId: number;
  mediaType: MediaType;
};

// The signed-in user's list, newest added first - RLS ("own list all") scopes
// every query to auth.uid(), so no user_id filter is needed on reads. Call
// behind requireUser().
export async function getMyListEntries(): Promise<MyListEntry[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("my_list")
    .select("tmdb_id, media_type")
    .order("added_at", { ascending: false });

  if (error) {
    throw new Error(`my_list read failed: ${error.message}`);
  }

  return z
    .array(myListRowSchema)
    .parse(data)
    .map((row) => ({ tmdbId: row.tmdb_id, mediaType: row.media_type }));
}

// userId must come from the server-verified session (requireUser()), never
// from the client. Idempotent: re-adding an existing row is a no-op, so a
// stale client (other device already added it) still gets ok.
export async function addMyListEntry(
  userId: string,
  entry: MyListEntry,
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("my_list").upsert(
    {
      user_id: userId,
      tmdb_id: entry.tmdbId,
      media_type: entry.mediaType,
    },
    { onConflict: "user_id,tmdb_id,media_type", ignoreDuplicates: true },
  );

  if (error) {
    throw new Error(`my_list insert failed: ${error.message}`);
  }
}

// Idempotent like the insert: deleting an already-gone row succeeds. The
// user_id filter is redundant with RLS but keeps the scope explicit.
export async function removeMyListEntry(
  userId: string,
  entry: MyListEntry,
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("my_list")
    .delete()
    .eq("user_id", userId)
    .eq("tmdb_id", entry.tmdbId)
    .eq("media_type", entry.mediaType);

  if (error) {
    throw new Error(`my_list delete failed: ${error.message}`);
  }
}
