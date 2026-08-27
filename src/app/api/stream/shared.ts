import { NextResponse } from "next/server";
import { z } from "zod";
import type { ResolveFailureCode } from "@/lib/streaming/resolve-stream";
import type { StreamTarget } from "@/lib/streaming/torrentio";
import { TmdbError } from "@/lib/tmdb/client";
import { getExternalIds } from "@/lib/tmdb/endpoints";

// Shared by /api/stream and /api/stream/options: one query shape, one error
// vocabulary, one tmdbId -> Torrentio target mapping (stream-resolution.md
// §/api/stream contract).

export type StreamErrorCode =
  ResolveFailureCode | "UNAUTHORIZED" | "BAD_REQUEST";

const STATUS_BY_CODE: Record<StreamErrorCode, number> = {
  UNAUTHORIZED: 401,
  BAD_REQUEST: 400,
  NOT_FOUND: 404,
  NOT_CACHED: 404,
  PROVIDER_DOWN: 503,
  INTERNAL: 500,
};

export function errorResponse(code: StreamErrorCode): NextResponse {
  return NextResponse.json({ error: code }, { status: STATUS_BY_CODE[code] });
}

// Season/episode are required for tv and rejected for movies, so a malformed
// player request can never silently resolve the wrong thing.
const positiveInt = z.coerce.number().int().positive();
export const streamQuerySchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("movie"), tmdbId: positiveInt }),
  z.object({
    type: z.literal("tv"),
    tmdbId: positiveInt,
    season: z.coerce.number().int().min(0),
    episode: positiveInt,
  }),
]);

export type StreamQuery = z.infer<typeof streamQuerySchema>;

export function streamQueryKey(query: StreamQuery): string {
  return query.type === "movie"
    ? `movie:${query.tmdbId}`
    : `tv:${query.tmdbId}:${query.season}:${query.episode}`;
}

// Torrentio is IMDb-keyed. A tmdbId that doesn't exist, or one without an
// IMDb mapping, is "we don't have that title" (NOT_FOUND) - never a server
// fault: the viewer should read "not available", not "went wrong".
export async function streamTargetFor(
  query: StreamQuery,
): Promise<StreamTarget | null> {
  const mediaType = query.type === "movie" ? "movie" : "tv";
  let imdbId: string | null;
  try {
    ({ imdbId } = await getExternalIds(mediaType, query.tmdbId));
  } catch (error) {
    if (error instanceof TmdbError && error.status === 404) return null;
    throw error;
  }
  if (imdbId === null) return null;
  return query.type === "movie"
    ? { type: "movie", imdbId }
    : {
        type: "series",
        imdbId,
        season: query.season,
        episode: query.episode,
      };
}
