import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { upsertProgress } from "@/lib/db/watch-progress";
import { requireApiUser } from "@/lib/supabase/require-user";

// POST /api/progress - the player's position beats (architecture doc
// §Progress). A route rather than a server action so a closing tab's last
// beat can ride fetch keepalive. Auth is re-verified here; the handler
// validates shape only - RLS scopes the rows to the verified user, whose id
// is the only thing taken from the session and never from the body.

export type ProgressErrorCode = "UNAUTHORIZED" | "BAD_REQUEST" | "INTERNAL";

const STATUS_BY_CODE: Record<ProgressErrorCode, number> = {
  UNAUTHORIZED: 401,
  BAD_REQUEST: 400,
  INTERNAL: 500,
};

function errorResponse(code: ProgressErrorCode): NextResponse {
  return NextResponse.json({ error: code }, { status: STATUS_BY_CODE[code] });
}

const positiveInt = z.number().int().positive();
const nonNegativeInt = z.number().int().min(0);

// Movies are pinned to 0/0 (the schema's "no episode"); a beat with an unknown
// duration is meaningless and the player never sends one. advanceTo is the
// next episode queued when this one finishes - TV only.
const beatSchema = z.discriminatedUnion("mediaType", [
  z.object({
    mediaType: z.literal("movie"),
    tmdbId: positiveInt,
    season: z.literal(0),
    episode: z.literal(0),
    positionSeconds: nonNegativeInt,
    durationSeconds: positiveInt,
  }),
  z.object({
    mediaType: z.literal("tv"),
    tmdbId: positiveInt,
    season: nonNegativeInt,
    episode: positiveInt,
    positionSeconds: nonNegativeInt,
    durationSeconds: positiveInt,
    advanceTo: z
      .object({ season: nonNegativeInt, episode: positiveInt })
      .optional(),
  }),
]);

export async function POST(request: NextRequest): Promise<NextResponse> {
  const userOr401 = await requireApiUser();
  if (userOr401 instanceof NextResponse) return errorResponse("UNAUTHORIZED");

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse("BAD_REQUEST");
  }
  const parsed = beatSchema.safeParse(body);
  if (!parsed.success) return errorResponse("BAD_REQUEST");
  const beat = parsed.data;

  try {
    await upsertProgress(userOr401.id, beat);
    // Stored second so it is the show's newest entry: Continue Watching and
    // every Play button now point at the next episode, from the top.
    if (beat.mediaType === "tv" && beat.advanceTo) {
      await upsertProgress(userOr401.id, {
        mediaType: "tv",
        tmdbId: beat.tmdbId,
        season: beat.advanceTo.season,
        episode: beat.advanceTo.episode,
        positionSeconds: 0,
        durationSeconds: 0,
      });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[api/progress] upsert failed", error);
    return errorResponse("INTERNAL");
  }
}
