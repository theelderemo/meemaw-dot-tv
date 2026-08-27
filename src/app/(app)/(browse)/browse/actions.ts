"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { addMyListEntry, removeMyListEntry } from "@/lib/db/my-list";
import { requireUser } from "@/lib/supabase/require-user";
import { getMovieDetails, getSeason, getTvDetails } from "@/lib/tmdb/endpoints";
import type { Season, TitleDetails } from "@/lib/tmdb/schemas";

// Client-facing envelope: the real cause stays in the server log and the
// client renders the error copy on ok: false - no thrown errors crossing the
// action boundary.
export type ActionResult<T> = { ok: true; data: T } | { ok: false };

const titleParamsSchema = z.object({
  mediaType: z.enum(["movie", "tv"]),
  id: z.number().int().positive(),
});

export async function getTitleDetailsAction(
  mediaType: "movie" | "tv",
  id: number,
): Promise<ActionResult<TitleDetails>> {
  await requireUser();
  const params = titleParamsSchema.safeParse({ mediaType, id });
  if (!params.success) return { ok: false };

  try {
    const data =
      params.data.mediaType === "movie"
        ? await getMovieDetails(params.data.id)
        : await getTvDetails(params.data.id);
    return { ok: true, data };
  } catch (error) {
    console.error(`[browse] title details failed (${mediaType}/${id})`, error);
    return { ok: false };
  }
}

const seasonParamsSchema = z.object({
  tvId: z.number().int().positive(),
  seasonNumber: z.number().int().min(0),
});

export async function getSeasonAction(
  tvId: number,
  seasonNumber: number,
): Promise<ActionResult<Season>> {
  await requireUser();
  const params = seasonParamsSchema.safeParse({ tvId, seasonNumber });
  if (!params.success) return { ok: false };

  try {
    const data = await getSeason(params.data.tvId, params.data.seasonNumber);
    return { ok: true, data };
  } catch (error) {
    console.error(
      `[browse] season failed (tv/${tvId}/season/${seasonNumber})`,
      error,
    );
    return { ok: false };
  }
}

const myListEntrySchema = z.object({
  tmdbId: z.number().int().positive(),
  mediaType: z.enum(["movie", "tv"]),
});

type MyListEntryInput = z.infer<typeof myListEntrySchema>;

// The user id comes from the server-verified session, never from the client.
// Both routes showing the list re-render on the next request via revalidatePath.
export async function addToMyListAction(
  entry: MyListEntryInput,
): Promise<ActionResult<null>> {
  const user = await requireUser();
  const params = myListEntrySchema.safeParse(entry);
  if (!params.success) return { ok: false };

  try {
    await addMyListEntry(user.id, params.data);
    revalidatePath("/browse");
    revalidatePath("/my-list");
    return { ok: true, data: null };
  } catch (error) {
    console.error(
      `[my-list] add failed (${params.data.mediaType}/${params.data.tmdbId})`,
      error,
    );
    return { ok: false };
  }
}

export async function removeFromMyListAction(
  entry: MyListEntryInput,
): Promise<ActionResult<null>> {
  const user = await requireUser();
  const params = myListEntrySchema.safeParse(entry);
  if (!params.success) return { ok: false };

  try {
    await removeMyListEntry(user.id, params.data);
    revalidatePath("/browse");
    revalidatePath("/my-list");
    return { ok: true, data: null };
  } catch (error) {
    console.error(
      `[my-list] remove failed (${params.data.mediaType}/${params.data.tmdbId})`,
      error,
    );
    return { ok: false };
  }
}
