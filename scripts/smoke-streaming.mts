// Live smoke against the configured Torrentio endpoint: runs
// the real fetch -> parse -> pick pipeline from src/lib/streaming against
// Torrentio for the four capture titles and prints each shortlist's top 3.
// Imports the actual lib (Node's type-stripping runs .ts directly), so this
// proves the shipped code, not a mirror of it. Stream resolve urls are
// secret-bearing and never printed.
//
// One request per title with a pause - same guest etiquette as the client.
// Run with: npm run smoke:streaming   (loads .env.local for TORRENTIO_CONFIG)
import {
  fetchTorrentioStreams,
  TorrentioError,
  type StreamTarget,
} from "../src/lib/streaming/torrentio.ts";
import { parseStreamTitle } from "../src/lib/streaming/parse-stream-title.ts";
import {
  pickCandidates,
  type CandidateKind,
} from "../src/lib/streaming/pick-candidates.ts";

type SmokeTitle = { label: string; target: StreamTarget; kind: CandidateKind };

const titles: SmokeTitle[] = [
  {
    label: "Dune: Part Two (2024) - recent movie",
    target: { type: "movie", imdbId: "tt15239678" },
    kind: "movie",
  },
  {
    label: "The Matrix (1999) - classic movie",
    target: { type: "movie", imdbId: "tt0133093" },
    kind: "movie",
  },
  {
    label: "The Last of Us S01E03 - current series",
    target: { type: "series", imdbId: "tt3581920", season: 1, episode: 3 },
    kind: "episode",
  },
  {
    label: "Friends S05E14 - classic sitcom",
    target: { type: "series", imdbId: "tt0108778", season: 5, episode: 14 },
    kind: "episode",
  },
];

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function formatSize(bytes: number | null): string {
  return bytes === null ? "?" : `${(bytes / 1024 ** 3).toFixed(2)} GiB`;
}

let failed = false;

for (const { label, target, kind } of titles) {
  console.log(`\n=== ${label}`);
  try {
    const streams = await fetchTorrentioStreams(target);
    const candidates = streams.map((stream) => ({
      url: stream.url,
      parsed: parseStreamTitle(stream.title),
    }));
    const picks = pickCandidates(candidates, kind);
    console.log(`${streams.length} streams → shortlist of ${picks.length}`);
    if (picks.length === 0) failed = true;

    for (const [index, pick] of picks.slice(0, 3).entries()) {
      const { parsed } = pick;
      console.log(
        `${index + 1}. ${parsed.resolution ?? "???"} | ${formatSize(parsed.sizeBytes)} | ` +
          `👤 ${parsed.seeders ?? "?"} | src:${parsed.sourceHint ?? "-"} | ` +
          `codecs:${parsed.codecHints.join("+") || "-"} | ${parsed.containerHint ?? "-"} | ` +
          `pack:${parsed.seasonPack}`,
      );
      console.log(`   ${parsed.releaseName ?? "(no release name)"}`);
    }
  } catch (error) {
    failed = true;
    if (error instanceof TorrentioError) {
      console.log(`${error.code}: ${error.message}`);
    } else {
      throw error;
    }
  }
  await sleep(500);
}

if (failed) {
  process.exitCode = 1;
  console.log("\nSmoke FAILED - at least one title produced no shortlist.");
} else {
  console.log("\nSmoke OK - all four titles produced shortlists.");
}
