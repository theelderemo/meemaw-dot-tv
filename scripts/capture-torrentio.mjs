// Ground-truth capture: hits Torrentio's public JSON API once per title and
// saves each response - redacted (see below), otherwise untrimmed - to
// src/lib/streaming/__fixtures__. The boundary schema, parser, and picker are
// shaped by (and tested against) these captures - never by assumptions about
// the format.
//
// Etiquette per docs/reference/stream-resolution.md: we are a guest on a free
// community service - one request per title, ~8s timeout, identifying
// User-Agent, small pause between requests. No config path segments and no
// keys in URLs.
//
// Run with: node scripts/capture-torrentio.mjs
// Re-redact existing fixtures, no network: node scripts/capture-torrentio.mjs --redact-existing
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";

const BASE = "https://torrentio.strem.fun";
const TIMEOUT_MS = 8_000;
const PAUSE_MS = 500;
const USER_AGENT = "Meemaw.tv/0.1";

const FIXTURES_DIR = new URL(
  "../src/lib/streaming/__fixtures__/",
  import.meta.url,
);

// A spread of catalog reality: recent blockbuster, decades-old classic,
// current prestige TV episode, classic sitcom episode (deep season).
const captures = [
  {
    file: "movie-dune-part-two.json",
    label: "Dune: Part Two (2024 movie)",
    path: "/stream/movie/tt15239678.json",
  },
  {
    file: "movie-the-matrix.json",
    label: "The Matrix (1999 movie)",
    path: "/stream/movie/tt0133093.json",
  },
  {
    file: "series-the-last-of-us-s01e03.json",
    label: "The Last of Us S01E03",
    path: "/stream/series/tt3581920:1:3.json",
  },
  {
    file: "series-friends-s05e14.json",
    label: "Friends S05E14",
    path: "/stream/series/tt0108778:5:14.json",
  },
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Redaction: raw infohashes and tracker/DHT lists are actionable pointers to
// infringing content and never ship in the public repo - infoHash becomes a
// deterministic one-way token (same torrent across indexers -> same token, the
// identity the dedup tests key on), `sources` is dropped, and the infohash
// Torrentio embeds in some bingeGroup values gets the same token. Everything
// else stays byte-identical; the 40-hex guards make the pass idempotent.
const tokenize = (hash) =>
  "redacted-" +
  createHash("sha256").update(hash.toLowerCase()).digest("hex").slice(0, 16);

function redactBody(body) {
  for (const stream of Array.isArray(body?.streams) ? body.streams : []) {
    if (stream === null || typeof stream !== "object") continue;
    if (
      typeof stream.infoHash === "string" &&
      /^[0-9a-f]{40}$/i.test(stream.infoHash)
    ) {
      stream.infoHash = tokenize(stream.infoHash);
    }
    delete stream.sources;
    const hints = stream.behaviorHints;
    if (
      hints &&
      typeof hints === "object" &&
      typeof hints.bingeGroup === "string"
    ) {
      hints.bingeGroup = hints.bingeGroup.replace(
        /\b[0-9a-f]{40}\b/gi,
        tokenize,
      );
    }
  }
  return body;
}

function saveFixture(file, body) {
  writeFileSync(
    new URL(file, FIXTURES_DIR),
    JSON.stringify(redactBody(body), null, 2) + "\n",
  );
}

mkdirSync(FIXTURES_DIR, { recursive: true });

if (process.argv.includes("--redact-existing")) {
  for (const capture of captures) {
    const body = JSON.parse(
      readFileSync(new URL(capture.file, FIXTURES_DIR), "utf8"),
    );
    saveFixture(capture.file, body);
    console.log(`redacted ${capture.file}`);
  }
} else {
  for (const capture of captures) {
    const url = `${BASE}${capture.path}`;
    console.log(`\n=== ${capture.label}\nGET ${url}`);
    const response = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) {
      throw new Error(
        `Torrentio responded ${response.status} on ${capture.path}`,
      );
    }
    const body = await response.json();
    const streams = Array.isArray(body?.streams) ? body.streams : [];
    saveFixture(capture.file, body);
    console.log(`streams: ${streams.length} → saved ${capture.file}`);
    if (streams.length > 0) {
      console.log("first entry:");
      console.log(JSON.stringify(streams[0], null, 2));
    }
    await sleep(PAUSE_MS);
  }

  console.log("\nAll captures saved.");
}
