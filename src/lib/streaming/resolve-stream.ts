// Explicit .ts extensions so plain Node (scripts/smoke-resolve.mts) can run
// this exact module chain - Node's type stripping doesn't resolve
// extensionless relative imports.
import { streamKey } from "./stream-key.ts";
import {
  fetchTorrentioStreams,
  scrubStreamingSecrets,
  TorrentioError,
  TORRENTIO_BASE_URL,
  TORRENTIO_TIMEOUT_MS,
  TORRENTIO_USER_AGENT,
  type StreamTarget,
} from "./torrentio.ts";
import { parseStreamTitle, type Resolution } from "./parse-stream-title.ts";
import { pickCandidates, type StreamCandidate } from "./pick-candidates.ts";

// The orchestrator (stream-resolution.md §Step 3): StreamTarget ->
// configured Torrentio listing (pre-filtered to RD-cached streams, each with
// a resolve url) -> pickCandidates -> GET each pick's resolve url with redirect
// following DISABLED, best first, and accept only a 302 onto Real-Debrid.
//
// 🔒 The resolve url embeds the RD key. It must never appear in the returned
// object, in a log line, or in an error message - only the post-redirect
// real-debrid.com URL (credential-free) leaves this module. Log lines carry
// release names, hosts and statuses, never urls; caught errors are logged
// through describeError(), which scrubs the config string and key.

export type ResolveFailureCode =
  "NOT_CACHED" | "NOT_FOUND" | "PROVIDER_DOWN" | "INTERNAL";

export type ResolveSuccess = {
  ok: true;
  /** Opaque handle of the winning stream (stream-key.ts) - lets the player
   * mark it as "now playing" in Switch Streams. */
  key: string;
  /** Final real-debrid.com URL - credential-free but account-tied and short-lived: resolve at play time, never store or log. */
  url: string;
  filename: string;
  sizeBytes: number | null;
  releaseName: string | null;
  resolution: Resolution | null;
};

export type ResolveFailure = {
  ok: false;
  code: ResolveFailureCode;
};

export type ResolveResult = ResolveSuccess | ResolveFailure;

// A valid resolution 302s onto an RD download host (*.download.real-debrid.com).
// Anything else - an error page, an open redirect, a tampered resolver - is
// rejected and the next candidate gets its turn. The leading dot means
// "evil-real-debrid.com" and "real-debrid.com.evil.example" both fail.
export const RESOLVED_HOST_SUFFIX = ".real-debrid.com";

// Live-measured 2026-08-20: [RD+] does NOT guarantee resolvability - RD's
// May 2026 infringement filter fires at resolve time, and Torrentio then 302s
// to its own failure video instead of real-debrid.com. WEB releases (which
// the frozen ranking front-loads on seeders) are blocked far more often than
// BluRay/BDRip encodes, so the old 5-attempt shortlist can be all blocks
// (Dune: first success at rank 8). An attempt is one cheap GET with zero RD
// API calls, so we keep trying ranked streams - rounds of pickCandidates over
// the remaining pool, preserving its exact ordering and its pool-narrowing
// preferences (SDR/standalone relax only once the preferred pool is spent) -
// up to this cap.
export const MAX_RESOLVE_ATTEMPTS = 20;

const TORRENTIO_HOSTNAME = new URL(TORRENTIO_BASE_URL).hostname;

function targetLabel(target: StreamTarget): string {
  return target.type === "movie"
    ? `movie ${target.imdbId}`
    : `series ${target.imdbId} S${target.season}E${target.episode}`;
}

function describeError(error: unknown): string {
  if (error instanceof Error) {
    return scrubStreamingSecrets(
      error.stack ?? `${error.name}: ${error.message}`,
    );
  }
  return scrubStreamingSecrets(String(error));
}

// RD download URLs end in the actual filename ("…/d/<token>/Movie.mkv").
export function filenameFromUrl(finalUrl: string, fallback: string): string {
  const basename = new URL(finalUrl).pathname.split("/").pop() ?? "";
  try {
    return decodeURIComponent(basename) || fallback;
  } catch {
    // Malformed percent-encoding - the raw basename is still a usable name.
    return basename || fallback;
  }
}

/**
 * GETs one resolve url with redirect following disabled and returns the
 * validated real-debrid.com Location, or null when this stream should be
 * skipped (non-302, missing/foreign/non-https Location, network failure).
 */
export async function resolveViaRedirect(
  resolveUrl: string,
  label: string,
  attempt: string,
): Promise<string | null> {
  let response: Response;
  try {
    response = await fetch(resolveUrl, {
      redirect: "manual",
      headers: { "User-Agent": TORRENTIO_USER_AGENT },
      signal: AbortSignal.timeout(TORRENTIO_TIMEOUT_MS),
      cache: "no-store",
    });
  } catch (error) {
    console.error(
      `[resolve-stream] ${label}: ${attempt} - resolve fetch failed: ${describeError(error)}`,
    );
    return null;
  }
  // The body is never read; release the connection. (Errors here are moot -
  // the response has already told us everything we use.)
  void response.body?.cancel().catch(() => undefined);

  if (response.status !== 302) {
    console.log(
      `[resolve-stream] ${label}: ${attempt} - expected 302, got ${response.status}`,
    );
    return null;
  }

  const location = response.headers.get("location");
  if (location === null) {
    console.log(
      `[resolve-stream] ${label}: ${attempt} - 302 without a Location header`,
    );
    return null;
  }

  let finalUrl: URL;
  try {
    finalUrl = new URL(location);
  } catch {
    console.log(
      `[resolve-stream] ${label}: ${attempt} - 302 to an unparseable Location`,
    );
    return null;
  }
  if (
    finalUrl.protocol !== "https:" ||
    !finalUrl.hostname.endsWith(RESOLVED_HOST_SUFFIX)
  ) {
    if (finalUrl.hostname === TORRENTIO_HOSTNAME) {
      // Routine: Torrentio redirects to its own failure video when RD refuses
      // the file (infringement filter) - without this host check that clip
      // would PLAY in place of the movie.
      console.log(
        `[resolve-stream] ${label}: ${attempt} - resolver returned its failure video (blocked on RD), skipped`,
      );
    } else {
      console.error(
        `[resolve-stream] ${label}: ${attempt} - redirect left Real-Debrid ` +
          `(host "${scrubStreamingSecrets(finalUrl.hostname)}"), rejected`,
      );
    }
    return null;
  }
  return finalUrl.toString();
}

export async function resolveStream(
  target: StreamTarget,
): Promise<ResolveResult> {
  const label = targetLabel(target);

  let pool: StreamCandidate[];
  try {
    const streams = await fetchTorrentioStreams(target);
    pool = streams.map((stream) => ({
      url: stream.url,
      parsed: parseStreamTitle(stream.title),
    }));
  } catch (error) {
    if (error instanceof TorrentioError) return { ok: false, code: error.code };
    console.error(
      `[resolve-stream] ${label}: unexpected Torrentio failure - ${describeError(error)}`,
    );
    return { ok: false, code: "INTERNAL" };
  }
  const kind = target.type === "movie" ? "movie" : "episode";

  try {
    let attempts = 0;
    while (attempts < MAX_RESOLVE_ATTEMPTS) {
      const picks = pickCandidates(pool, kind);
      if (picks.length === 0) break;
      const picked = new Set(picks.map((pick) => pick.url));
      pool = pool.filter((candidate) => !picked.has(candidate.url));

      for (const candidate of picks) {
        if (attempts >= MAX_RESOLVE_ATTEMPTS) break;
        attempts += 1;
        const release = candidate.parsed.releaseName ?? "unknown release";
        const attempt = `candidate ${attempts} "${release}"`;
        const finalUrl = await resolveViaRedirect(
          candidate.url,
          label,
          attempt,
        );
        if (finalUrl === null) continue;

        console.log(`[resolve-stream] ${label}: ${attempt} - resolved`);
        return {
          ok: true,
          key: streamKey(candidate.url),
          url: finalUrl,
          filename: filenameFromUrl(finalUrl, release),
          sizeBytes: candidate.parsed.sizeBytes,
          releaseName: candidate.parsed.releaseName,
          resolution: candidate.parsed.resolution,
        };
      }
    }
    // Either nothing survived the picker or every attempt failed to land on
    // Real-Debrid: the title isn't watchable right now, which is NOT_CACHED's
    // user story, not NOT_FOUND's.
    console.log(
      `[resolve-stream] ${label}: no stream resolved (${attempts} attempt(s)) - NOT_CACHED`,
    );
    return { ok: false, code: "NOT_CACHED" };
  } catch (error) {
    console.error(
      `[resolve-stream] ${label}: unexpected resolve failure - ${describeError(error)}`,
    );
    return { ok: false, code: "INTERNAL" };
  }
}
