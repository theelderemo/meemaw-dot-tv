import { NextResponse, type NextRequest } from "next/server";
import { listStreamOptions } from "@/lib/streaming/stream-options";
import { requireApiUser } from "@/lib/supabase/require-user";
import { errorResponse, streamQuerySchema, streamTargetFor } from "../shared";

// GET /api/stream/options - every Torrentio stream for a title, unfiltered,
// named by opaque keys for Switch Streams. Same query shape and
// error vocabulary as /api/stream; resolve urls never leave the server.
export const maxDuration = 30;

export async function GET(request: NextRequest): Promise<NextResponse> {
  const userOr401 = await requireApiUser();
  if (userOr401 instanceof NextResponse) return errorResponse("UNAUTHORIZED");

  const parsed = streamQuerySchema.safeParse(
    Object.fromEntries(request.nextUrl.searchParams),
  );
  if (!parsed.success) return errorResponse("BAD_REQUEST");

  try {
    const target = await streamTargetFor(parsed.data);
    if (target === null) return errorResponse("NOT_FOUND");
    const result = await listStreamOptions(target);
    if (!result.ok) return errorResponse(result.code);
    return NextResponse.json({ options: result.options });
  } catch (error) {
    console.error("[api/stream/options] failed", error);
    return errorResponse("INTERNAL");
  }
}
