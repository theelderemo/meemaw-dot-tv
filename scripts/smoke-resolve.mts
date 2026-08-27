// Live smoke: the full resolution pipeline per title - TMDB id -> imdb
// id -> configured Torrentio -> pickCandidates -> follow the 302 -> playable
// real-debrid.com URL - through the real shipped lib. A HEAD on the final URL
// proves seekability (Accept-Ranges: bytes), the property playback depends on.
//
// 🔒 Output prints the final URL's HOST only, never the full URL (it is
// account-tied), and never any part of TORRENTIO_CONFIG. Stream urls from the
// listing are never printed - only their count.
//
// NOT part of npm test (this hits TMDB and Torrentio for real).
// Run with: npm run smoke:resolve   (loads .env.local via --env-file)
// tmdb/endpoints.ts imports "./client" without an extension, which plain Node
// cannot resolve - so the smoke uses the real client + schema (both leaf
// modules) and mirrors the 3-line getExternalIds wrapper by hand.
import { tmdbFetch } from "../src/lib/tmdb/client.ts";
import { externalIdsSchema } from "../src/lib/tmdb/schemas.ts";
import {
  fetchTorrentioStreams,
  TorrentioError,
  type StreamTarget,
} from "../src/lib/streaming/torrentio.ts";
import {
  resolveStream,
  type ResolveResult,
} from "../src/lib/streaming/resolve-stream.ts";

type SmokeTitle = {
  label: string;
  tmdbId: number;
  media: { type: "movie" } | { type: "tv"; season: number; episode: number };
};

const titles: SmokeTitle[] = [
  { label: "Dune: Part Two (2024)", tmdbId: 693134, media: { type: "movie" } },
  { label: "The Matrix (1999)", tmdbId: 603, media: { type: "movie" } },
  {
    label: "Friends S05E14",
    tmdbId: 1668,
    media: { type: "tv", season: 5, episode: 14 },
  },
  {
    label: "The Last of Us S01E03",
    tmdbId: 100088,
    media: { type: "tv", season: 1, episode: 3 },
  },
];

for (const name of ["TMDB_API_READ_TOKEN", "TORRENTIO_CONFIG"]) {
  if (!process.env[name]) {
    console.error(`${name} missing - run via npm run smoke:resolve`);
    process.exit(1);
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Mirrors src/lib/tmdb/endpoints.ts getExternalIds (keep in sync by hand).
async function getExternalIds(
  mediaType: "movie" | "tv",
  id: number,
): Promise<{ imdbId: string | null }> {
  const data = await tmdbFetch(`/${mediaType}/${id}/external_ids`, {
    revalidate: 0,
  });
  return externalIdsSchema.parse(data);
}

function formatSize(bytes: number | null): string {
  return bytes === null ? "?" : `${(bytes / 1024 ** 3).toFixed(2)} GiB`;
}

// Keeps the full URL out of arbitrary error messages, per the header rule.
function withheldUrl(text: string, url: string): string {
  return text.split(url).join("[final-url withheld]");
}

let resolved = 0;
let seekable = 0;
let hardFailure = false;

for (const { label, tmdbId, media } of titles) {
  console.log(`\n=== ${label} (tmdb ${tmdbId})`);
  try {
    const { imdbId } = await getExternalIds(
      media.type === "movie" ? "movie" : "tv",
      tmdbId,
    );
    if (imdbId === null) {
      console.log("no imdb id on TMDB - cannot resolve");
      hardFailure = true;
      continue;
    }
    const target: StreamTarget =
      media.type === "movie"
        ? { type: "movie", imdbId }
        : {
            type: "series",
            imdbId,
            season: media.season,
            episode: media.episode,
          };

    // Primes the module-level 15-min cache - resolveStream below reuses it,
    // so this stays one Torrentio request per title.
    try {
      const streams = await fetchTorrentioStreams(target);
      console.log(`streams returned: ${streams.length}`);
    } catch (error) {
      if (!(error instanceof TorrentioError)) throw error;
      console.log(`streams returned: 0 (${error.code})`);
    }

    const result: ResolveResult = await resolveStream(target);
    if (!result.ok) {
      console.log(`PLAYABLE URL: no - ${result.code}`);
      if (result.code === "INTERNAL") hardFailure = true;
      continue;
    }

    resolved += 1;
    const host = new URL(result.url).host;
    console.log(`won: "${result.releaseName ?? "unknown release"}"`);
    console.log(
      `resolution: ${result.resolution ?? "?"} | size: ${formatSize(result.sizeBytes)} | ` +
        `filename: ${result.filename}`,
    );
    console.log(`PLAYABLE URL: yes - host=${host}`);

    try {
      const head = await fetch(result.url, {
        method: "HEAD",
        signal: AbortSignal.timeout(15_000),
      });
      const acceptRanges = head.headers.get("accept-ranges");
      const okRanges =
        head.status === 200 &&
        (acceptRanges ?? "").toLowerCase().includes("bytes");
      console.log(
        `HEAD: status=${head.status} ` +
          `content-length=${head.headers.get("content-length") ?? "?"} ` +
          `accept-ranges=${acceptRanges ?? "(none)"} → seekable: ${okRanges ? "yes" : "NO"}`,
      );
      if (okRanges) {
        seekable += 1;
      } else {
        // A 206 on a 2-byte ranged GET proves seekability just as well.
        const ranged = await fetch(result.url, {
          headers: { Range: "bytes=0-1" },
          signal: AbortSignal.timeout(15_000),
        });
        void ranged.body?.cancel().catch(() => undefined);
        console.log(
          `ranged GET fallback: status=${ranged.status} → seekable: ${ranged.status === 206 ? "yes" : "NO"}`,
        );
        if (ranged.status === 206) seekable += 1;
      }
    } catch (error) {
      console.log(
        `HEAD failed: ${withheldUrl(
          error instanceof Error ? error.message : String(error),
          result.url,
        )}`,
      );
    }
  } catch (error) {
    hardFailure = true;
    console.error(
      `unexpected failure on ${label}:`,
      error instanceof Error ? error.message : error,
    );
  }
  await sleep(500);
}

console.log(
  `\nResolved ${resolved}/${titles.length} titles; ` +
    `${seekable}/${titles.length} with byte-range support.`,
);
if (hardFailure || resolved < titles.length || seekable < titles.length) {
  process.exitCode = 1;
  console.log(
    "Smoke FAILED - the definition of done needs 4/4 playable with byte ranges.",
  );
} else {
  console.log("Smoke OK - all four titles playable with byte-range support.");
}
