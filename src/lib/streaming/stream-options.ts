import {
  parseStreamTitle,
  type ParsedStream,
  type Resolution,
} from "./parse-stream-title.ts";
import { pickCandidates, type CandidateKind } from "./pick-candidates.ts";
import {
  filenameFromUrl,
  resolveViaRedirect,
  type ResolveFailureCode,
  type ResolveResult,
} from "./resolve-stream.ts";
import { streamKey } from "./stream-key.ts";
import {
  fetchTorrentioStreams,
  TorrentioError,
  type StreamTarget,
  type TorrentioStream,
} from "./torrentio.ts";

// "Switch Streams": the player can list EVERY stream Torrentio
// returned for a title - nothing the automatic picker excludes is hidden -
// and resolve the one the viewer chooses. Streams are named by opaque keys
// (stream-key.ts); resolve urls stay server-side.

export type StreamOption = {
  key: string;
  releaseName: string | null;
  resolution: Resolution | null;
  sizeBytes: number | null;
  seeders: number | null;
  provider: string | null;
  languageHints: string[];
  /** True when the automatic picker would have shortlisted it. */
  recommended: boolean;
};

export type StreamOptionsResult =
  | { ok: true; options: StreamOption[] }
  | { ok: false; code: ResolveFailureCode };

function kindFor(target: StreamTarget): CandidateKind {
  return target.type === "movie" ? "movie" : "episode";
}

function targetLabel(target: StreamTarget): string {
  return target.type === "movie"
    ? `movie ${target.imdbId}`
    : `series ${target.imdbId} S${target.season}E${target.episode}`;
}

// Pure: Torrentio's own order preserved (quality/seeders as it sorts them),
// the same torrent relisted by several indexers collapsed onto one key.
export function toStreamOptions(
  streams: TorrentioStream[],
  kind: CandidateKind,
): StreamOption[] {
  const candidates = streams.map((stream) => ({
    url: stream.url,
    parsed: parseStreamTitle(stream.title),
  }));
  const recommended = new Set(
    pickCandidates(candidates, kind).map((pick) => streamKey(pick.url)),
  );
  const seen = new Set<string>();
  const options: StreamOption[] = [];
  for (const { url, parsed } of candidates) {
    const key = streamKey(url);
    if (seen.has(key)) continue;
    seen.add(key);
    options.push(toOption(key, parsed, recommended.has(key)));
  }
  return options;
}

function toOption(
  key: string,
  parsed: ParsedStream,
  recommended: boolean,
): StreamOption {
  return {
    key,
    releaseName: parsed.releaseName,
    resolution: parsed.resolution,
    sizeBytes: parsed.sizeBytes,
    seeders: parsed.seeders,
    provider: parsed.provider,
    languageHints: parsed.languageHints,
    recommended,
  };
}

export async function listStreamOptions(
  target: StreamTarget,
): Promise<StreamOptionsResult> {
  try {
    const streams = await fetchTorrentioStreams(target);
    return { ok: true, options: toStreamOptions(streams, kindFor(target)) };
  } catch (error) {
    if (error instanceof TorrentioError) return { ok: false, code: error.code };
    console.error(
      `[stream-options] ${targetLabel(target)}: unexpected Torrentio failure`,
      error,
    );
    return { ok: false, code: "INTERNAL" };
  }
}

// One explicit stream, no picker: the viewer chose it knowing the automatic
// pick was wrong. A refusal at resolve time (Torrentio's failure video) is
// NOT_CACHED - same story as the automatic path; an unknown key is NOT_FOUND.
export async function resolveStreamByKey(
  target: StreamTarget,
  key: string,
): Promise<ResolveResult> {
  const label = targetLabel(target);
  let streams: TorrentioStream[];
  try {
    streams = await fetchTorrentioStreams(target);
  } catch (error) {
    if (error instanceof TorrentioError) return { ok: false, code: error.code };
    console.error(
      `[stream-options] ${label}: unexpected Torrentio failure`,
      error,
    );
    return { ok: false, code: "INTERNAL" };
  }

  const stream = streams.find((candidate) => streamKey(candidate.url) === key);
  if (!stream) {
    console.log(`[stream-options] ${label}: unknown stream key ${key}`);
    return { ok: false, code: "NOT_FOUND" };
  }
  const parsed = parseStreamTitle(stream.title);
  const release = parsed.releaseName ?? "unknown release";
  const finalUrl = await resolveViaRedirect(
    stream.url,
    label,
    `manual pick "${release}"`,
  );
  if (finalUrl === null) return { ok: false, code: "NOT_CACHED" };

  console.log(`[stream-options] ${label}: manual pick "${release}" - resolved`);
  return {
    ok: true,
    key,
    url: finalUrl,
    filename: filenameFromUrl(finalUrl, release),
    sizeBytes: parsed.sizeBytes,
    releaseName: parsed.releaseName,
    resolution: parsed.resolution,
  };
}
