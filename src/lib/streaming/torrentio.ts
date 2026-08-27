import { z } from "zod";

// Torrentio fetch boundary (stream-resolution.md §Step 1). We call
// the CONFIGURED endpoint: the config path segment carries our Real-Debrid
// key, so Torrentio pre-filters to streams already cached on RD ([RD+]) and
// each stream arrives with a resolve `url` instead of an infoHash. We are a
// guest on a free community service: one request per resolution, ~8s timeout,
// identifying User-Agent, responses cached ~15 min.
//
// 🔒 TORRENTIO_CONFIG is a secret on par with the RD token itself (it embeds
// the key): server-only, never logged, never in an error message, never in
// client code. Error messages and cache keys are built from the config-free
// stream path, and every TorrentioError message is scrubbed anyway as defense
// in depth - same pattern as lib/tmdb/client.ts.

export const TORRENTIO_BASE_URL = "https://torrentio.strem.fun";
export const TORRENTIO_TIMEOUT_MS = 8_000;
export const TORRENTIO_CACHE_TTL_MS = 15 * 60 * 1_000;
export const TORRENTIO_USER_AGENT = "Meemaw.tv/0.1";

// Removes the config string - and the RD key on its own, which also travels
// inside resolve urls (/resolve/realdebrid/<key>/…) - from any text destined
// for an error message or log line.
export function scrubStreamingSecrets(text: string): string {
  const config = process.env.TORRENTIO_CONFIG;
  if (!config) return text;
  let scrubbed = text.split(config).join("[redacted]");
  const key = config.match(/realdebrid=([^|/]+)/)?.[1];
  if (key) scrubbed = scrubbed.split(key).join("[redacted]");
  return scrubbed;
}

export type TorrentioErrorCode = "PROVIDER_DOWN" | "NOT_FOUND";

export class TorrentioError extends Error {
  readonly code: TorrentioErrorCode;
  readonly status: number | null;

  constructor(
    code: TorrentioErrorCode,
    message: string,
    status: number | null = null,
    options?: ErrorOptions,
  ) {
    super(scrubStreamingSecrets(message), options);
    this.name = "TorrentioError";
    this.code = code;
    this.status = status;
  }
}

export type StreamTarget =
  | { type: "movie"; imdbId: string }
  | { type: "series"; imdbId: string; season: number; episode: number };

/** Config-free path suffix - safe for error messages, logs and cache keys. */
export function streamPath(target: StreamTarget): string {
  return target.type === "movie"
    ? `/stream/movie/${target.imdbId}.json`
    : `/stream/series/${target.imdbId}:${target.season}:${target.episode}.json`;
}

export function configuredStreamUrl(
  config: string,
  target: StreamTarget,
): string {
  return `${TORRENTIO_BASE_URL}/${config}${streamPath(target)}`;
}

export type TorrentioStream = {
  /**
   * Torrentio's resolve url for this stream - it EMBEDS THE RD KEY. Fetch it
   * server-side only; never log it and never let it reach the client
   * (resolve-stream.ts returns only the post-redirect real-debrid.com URL).
   */
  url: string;
  /** Addon quality label ("[RD+] Torrentio\n1080p") - display/debug only. */
  name: string;
  /** The emoji-delimited text blob for parse-stream-title.ts. */
  title: string;
};

// Lenient boundary (like the tmdb schemas): only url is load-bearing - a
// stream we cannot resolve is useless, everything else degrades.
const rawStreamSchema = z
  .object({
    url: z.string().min(1),
    name: z.string().nullish(),
    title: z.string().nullish(),
  })
  .transform((raw): TorrentioStream => ({
    url: raw.url,
    name: raw.name ?? "",
    title: raw.title ?? "",
  }));

export const streamsResponseSchema = z.object({
  streams: z.array(z.unknown()),
});

// Parses items one by one so a single malformed entry is dropped (with a
// server log), not the whole candidate list.
export function parseStreams(
  items: unknown[],
  context: string,
): TorrentioStream[] {
  const streams: TorrentioStream[] = [];
  let dropped = 0;
  for (const item of items) {
    const result = rawStreamSchema.safeParse(item);
    if (result.success) streams.push(result.data);
    else dropped += 1;
  }
  if (dropped > 0) {
    console.error(
      `[torrentio] dropped ${dropped} malformed stream(s) from ${context}`,
    );
  }
  return streams;
}

// 15-minute response cache, keyed by the config-free path. Module-level and
// instance-local - best-effort on serverless, same trade-off the spec accepts
// for the /api/stream cache. Empty results are cached too (repeat clicks on
// an unfindable title must not re-hit Torrentio) but still raise NOT_FOUND.
const cache = new Map<
  string,
  { expiresAt: number; streams: TorrentioStream[] }
>();

export async function fetchTorrentioStreams(
  target: StreamTarget,
): Promise<TorrentioStream[]> {
  if (typeof window !== "undefined") {
    throw new TorrentioError(
      "PROVIDER_DOWN",
      "fetchTorrentioStreams must only run on the server",
    );
  }
  const config = process.env.TORRENTIO_CONFIG;
  if (!config) {
    throw new TorrentioError(
      "PROVIDER_DOWN",
      "TORRENTIO_CONFIG is not set in the server env",
    );
  }

  const path = streamPath(target);
  const cached = cache.get(path);
  const streams =
    cached !== undefined && cached.expiresAt > Date.now()
      ? cached.streams
      : await requestStreams(configuredStreamUrl(config, target), path);
  cache.set(path, { expiresAt: Date.now() + TORRENTIO_CACHE_TTL_MS, streams });

  if (streams.length === 0) {
    throw new TorrentioError(
      "NOT_FOUND",
      `Torrentio has no streams for ${path}`,
    );
  }
  return streams;
}

async function requestStreams(
  url: string,
  path: string,
): Promise<TorrentioStream[]> {
  let response: Response;
  try {
    response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": TORRENTIO_USER_AGENT,
      },
      signal: AbortSignal.timeout(TORRENTIO_TIMEOUT_MS),
      // The Map above owns caching; keep Next's fetch cache out of the way.
      cache: "no-store",
    });
  } catch (cause) {
    throw new TorrentioError(
      "PROVIDER_DOWN",
      `Torrentio unreachable on ${path}`,
      null,
      { cause },
    );
  }

  if (!response.ok) {
    // 5xx/429 = provider trouble; other 4xx = this title isn't resolvable.
    const code: TorrentioErrorCode =
      response.status >= 500 || response.status === 429
        ? "PROVIDER_DOWN"
        : "NOT_FOUND";
    throw new TorrentioError(
      code,
      `Torrentio responded ${response.status} on ${path}`,
      response.status,
    );
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch (cause) {
    throw new TorrentioError(
      "PROVIDER_DOWN",
      `Torrentio returned non-JSON on ${path}`,
      response.status,
      { cause },
    );
  }

  const parsed = streamsResponseSchema.safeParse(body);
  if (!parsed.success) {
    throw new TorrentioError(
      "PROVIDER_DOWN",
      `Torrentio returned an unexpected shape on ${path}`,
      response.status,
      { cause: parsed.error },
    );
  }
  return parseStreams(parsed.data.streams, path);
}
