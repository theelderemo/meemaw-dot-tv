// pickCandidates() - stream-resolution.md §Step 2: exclusions first, then the
// preference ladder, top MAX_CANDIDATES as the resolve trial order (the
// input is already pre-filtered to RD-cached streams, so ranking runs
// over survivors). Pure function over parsed input; every threshold and
// weight is an exported named constant, tuned against the deployment's actual
// catalog.

import type { ParsedStream, Resolution } from "./parse-stream-title";

export type CandidateKind = "movie" | "episode";

export type StreamCandidate = {
  /**
   * The stream's Torrentio resolve url - candidate identity (dedupe key) and
   * secret-bearing (it embeds the RD key): never log it, never send it to the
   * client. resolve-stream.ts is the only consumer that may fetch it.
   */
  url: string;
  parsed: ParsedStream;
};

export const MAX_CANDIDATES = 5;

// Size caps (TV-browser-hostile beyond these). Capture-verified: Torrentio's
// 💾 size is the picked file's size even inside season packs, so one cap per
// kind is safe. Unknown size is kept - unknown is not over-cap.
export const MAX_MOVIE_SIZE_BYTES = 12 * 1024 ** 3;
export const MAX_EPISODE_SIZE_BYTES = 4 * 1024 ** 3;

export const EXCLUDED_SOURCE_HINTS: ReadonlySet<string> = new Set([
  "cam",
  "telesync",
  "telecine",
  "screener",
]);
export const EXCLUDED_RESOLUTIONS: ReadonlySet<string> = new Set([
  "480p",
  "360p",
]);
// Excluded only when an SDR alternative survives the other exclusions.
export const HDR_CODEC_HINTS: ReadonlySet<string> = new Set([
  "hdr",
  "dv",
  "10bit",
]);
// Movie requests: a "pack" is a multi-MOVIE collection (IMDB Top 250 packs,
// "super pack" repacks), not a season pack. Capture-verified: those dominate
// the ladder on seeders alone, and serving the viewer a dubbed repack out of
// a 250-movie bundle is the worst failure we can ship. Dropped when any standalone
// release survives - same pool-narrowing shape as the SDR/HDR rule. Episode
// requests keep packs: season packs are how TV is released.
export const PREFER_STANDALONE_MOVIE_RELEASES = true;

// Only English-only audio is eligible. No hints means plain English (Torrentio
// only annotates non-original audio); any other language - even on a dual
// release that also lists 🇬🇧 - excludes the stream outright. A native <video>
// plays the container's default track, and Chrome/Firefox expose no audio-track
// switching (MDN audioTracks; Chromium 249427; Mozilla 744896): a dual
// release has resolved and played in the wrong language. No
// dual/multi fallback on purpose - the wrong language reads to the viewer as
// "broken", while NOT_CACHED reads as "not ready", the designed dead end.
export const ENGLISH_HINT = "en";

// Preference ladder. Tier gaps (2000) exceed the widest possible intra-tier
// swing (~1350: 550 source penalty + 150 source bonus + ~538 seeders + 80
// codec + 25 container), so resolution order is strictly absolute - a 720p
// release can never outrank a 1080p one. Within a tier, source dominates
// (RD's resolve-time refusals make it the strongest playability signal),
// then log-scaled seeders, then codec/container.
export const RESOLUTION_SCORES: Record<Resolution, number> = {
  "1080p": 8000,
  "720p": 6000,
  "2160p": 4000, // last resort: decode burden on weak devices
  "1440p": 3000, // rare oddball - below the ladder, above unknowns
  "480p": 0, // sub-720 is excluded before scoring; keys kept for totality
  "360p": 0,
};
export const UNKNOWN_RESOLUTION_SCORE = 0;
export const SEEDERS_LOG_WEIGHT = 60;
export const SEEDERS_CAP = 500;
// Live-measured (smoke:resolve): EVERY candidate Real-Debrid refused at
// resolve time was a WEB release (WEB-DL/WEBRip/AMZN), and every winner was
// BluRay-family. RD's infringement filter keys on WEB release tags, so
// ranking WEB first just burns round-trips. Penalty > the seeder span (max
// ~383 between a 5-seeder and a 500-seeder release) so a popular WEB rip
// cannot outrank a quiet BluRay inside the same resolution tier; it stays
// well under the 1000-point tier gap, so resolution order is still absolute.
export const PREFERRED_SOURCE_HINTS: ReadonlySet<string> = new Set([
  "bluray",
  "bdrip",
]);
export const PREFERRED_SOURCE_BONUS = 150;
export const BLOCK_PRONE_SOURCE_HINTS: ReadonlySet<string> = new Set([
  "webdl",
  "webrip",
]);
export const BLOCK_PRONE_SOURCE_PENALTY = 550;
export const H264_BONUS = 80; // broadest playback
export const HEAVY_CODEC_HINTS: ReadonlySet<string> = new Set(["h265", "av1"]);
export const HEAVY_CODEC_PENALTY = 80; // patchy TV-browser decode support
export const MP4_CONTAINER_BONUS = 25; // slight bias only - H.264 MKV plays fine

export function scoreCandidate(parsed: ParsedStream): number {
  const resolution = parsed.resolution
    ? RESOLUTION_SCORES[parsed.resolution]
    : UNKNOWN_RESOLUTION_SCORE;
  const seeders =
    Math.log2(1 + Math.min(Math.max(parsed.seeders ?? 0, 0), SEEDERS_CAP)) *
    SEEDERS_LOG_WEIGHT;
  const source =
    parsed.sourceHint === null
      ? 0
      : PREFERRED_SOURCE_HINTS.has(parsed.sourceHint)
        ? PREFERRED_SOURCE_BONUS
        : BLOCK_PRONE_SOURCE_HINTS.has(parsed.sourceHint)
          ? -BLOCK_PRONE_SOURCE_PENALTY
          : 0;
  const codec =
    (parsed.codecHints.includes("h264") ? H264_BONUS : 0) -
    (parsed.codecHints.some((hint) => HEAVY_CODEC_HINTS.has(hint))
      ? HEAVY_CODEC_PENALTY
      : 0);
  const container = parsed.containerHint === "mp4" ? MP4_CONTAINER_BONUS : 0;
  return resolution + seeders + source + codec + container;
}

function isExcluded(parsed: ParsedStream, maxSizeBytes: number): boolean {
  // A stream pointing at an extras/sample file would play the wrong video.
  if (parsed.extrasFile) return true;
  if (
    parsed.sourceHint !== null &&
    EXCLUDED_SOURCE_HINTS.has(parsed.sourceHint)
  )
    return true;
  if (parsed.codecHints.includes("3d")) return true;
  if (parsed.resolution !== null && EXCLUDED_RESOLUTIONS.has(parsed.resolution))
    return true;
  if (parsed.sizeBytes !== null && parsed.sizeBytes > maxSizeBytes) return true;
  if (parsed.languageHints.some((hint) => hint !== ENGLISH_HINT)) return true;
  return false;
}

function isHdr(parsed: ParsedStream): boolean {
  return parsed.codecHints.some((hint) => HDR_CODEC_HINTS.has(hint));
}

export function pickCandidates(
  candidates: StreamCandidate[],
  kind: CandidateKind,
): StreamCandidate[] {
  const maxSizeBytes =
    kind === "movie" ? MAX_MOVIE_SIZE_BYTES : MAX_EPISODE_SIZE_BYTES;

  let pool = candidates.filter(
    (candidate) => !isExcluded(candidate.parsed, maxSizeBytes),
  );
  const sdrPool = pool.filter((candidate) => !isHdr(candidate.parsed));
  if (sdrPool.length > 0) pool = sdrPool;

  if (kind === "movie" && PREFER_STANDALONE_MOVIE_RELEASES) {
    const standalonePool = pool.filter(
      (candidate) => !candidate.parsed.seasonPack,
    );
    if (standalonePool.length > 0) pool = standalonePool;
  }

  const scored = pool.map((candidate, index) => ({
    candidate,
    index,
    score: scoreCandidate(candidate.parsed),
  }));
  // Ties keep Torrentio's own order (it sorts by quality/seeders itself).
  scored.sort((a, b) => b.score - a.score || a.index - b.index);

  // The same torrent is often listed by several indexers with an identical
  // resolve url - a duplicate would waste a resolve attempt.
  const seen = new Set<string>();
  const picks: StreamCandidate[] = [];
  for (const { candidate } of scored) {
    if (seen.has(candidate.url)) continue;
    seen.add(candidate.url);
    picks.push(candidate);
    if (picks.length === MAX_CANDIDATES) break;
  }
  return picks;
}
