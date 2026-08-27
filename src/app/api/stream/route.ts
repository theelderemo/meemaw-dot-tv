import { NextResponse, type NextRequest } from "next/server";
import { resolveStream } from "@/lib/streaming/resolve-stream";
import { STREAM_KEY_PATTERN } from "@/lib/streaming/stream-key";
import { resolveStreamByKey } from "@/lib/streaming/stream-options";
import { requireApiUser } from "@/lib/supabase/require-user";
import {
  errorResponse,
  streamQueryKey,
  streamQuerySchema,
  streamTargetFor,
} from "./shared";

// GET /api/stream - the only route that turns a TMDB id into something the
// player can load (stream-resolution.md §/api/stream contract).
//
// 🔒 Two invariants this handler exists to hold:
//   1. Auth is re-verified here server-side; the proxy is convenience only.
//   2. Nothing carrying the Torrentio config / RD key reaches the response.
//      resolveStream() already guarantees a credential-free real-debrid.com
//      URL, and failures come back as codes - never as provider error text.

// A worst-case resolve churns many candidates (~1s each); don't let a low
// platform default (Vercel function timeout) cut it off mid-resolve.
export const maxDuration = 60;

export type StreamSuccessBody = {
  url: string;
  /** Opaque handle of the stream that resolved (Switch Streams marks it). */
  key: string;
  filename: string;
  resolvedQuality: string | null;
  sizeBytes: number | null;
  releaseName: string | null;
};

// Resolutions are short-lived and account-tied: cache briefly so paging back
// into a title (or a double-click on Play) doesn't re-run the whole pipeline,
// but never long enough to hand out a stale URL. Instance-local and
// best-effort by design - serverless instances come and go (architecture doc).
export const RESOLUTION_CACHE_TTL_MS = 10 * 60 * 1000;

const resolutionCache = new Map<
  string,
  { body: StreamSuccessBody; expiresAt: number }
>();

function readCache(key: string): StreamSuccessBody | null {
  const hit = resolutionCache.get(key);
  if (!hit) return null;
  if (Date.now() >= hit.expiresAt) {
    resolutionCache.delete(key);
    return null;
  }
  return hit.body;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const userOr401 = await requireApiUser();
  if (userOr401 instanceof NextResponse) return errorResponse("UNAUTHORIZED");

  const params = Object.fromEntries(request.nextUrl.searchParams);
  const parsed = streamQuerySchema.safeParse(params);
  if (!parsed.success) return errorResponse("BAD_REQUEST");
  const query = parsed.data;

  // stream=<key>: Switch Streams - the viewer picked this exact
  // stream, so the picker and the cache both step aside.
  const streamParam = request.nextUrl.searchParams.get("stream");
  if (streamParam !== null && !STREAM_KEY_PATTERN.test(streamParam)) {
    return errorResponse("BAD_REQUEST");
  }

  // The player retries with fresh=1 after a playback error - an RD URL can go
  // stale before our TTL does, so this bypass is the recovery path.
  const skipCache =
    request.nextUrl.searchParams.get("fresh") === "1" || streamParam !== null;
  const key = streamQueryKey(query);
  if (!skipCache) {
    const cached = readCache(key);
    if (cached) return NextResponse.json(cached);
  }

  try {
    const target = await streamTargetFor(query);
    if (target === null) return errorResponse("NOT_FOUND");

    const result =
      streamParam === null
        ? await resolveStream(target)
        : await resolveStreamByKey(target, streamParam);
    if (!result.ok) return errorResponse(result.code);

    const body: StreamSuccessBody = {
      url: result.url,
      key: result.key,
      filename: result.filename,
      resolvedQuality: result.resolution,
      sizeBytes: result.sizeBytes,
      releaseName: result.releaseName,
    };
    // A manual pick is one viewer's choice for one sitting - it must not
    // become the cached answer for the next Play.
    if (streamParam === null) {
      resolutionCache.set(key, {
        body,
        expiresAt: Date.now() + RESOLUTION_CACHE_TTL_MS,
      });
    }
    return NextResponse.json(body);
  } catch (error) {
    // Real cause stays server-side; the client gets a code it can phrase for
    // the viewer. resolveStream scrubs secrets from anything it throws.
    console.error(`[api/stream] ${key} failed`, error);
    return errorResponse("INTERNAL");
  }
}
