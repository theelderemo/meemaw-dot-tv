import { describe, expect, it } from "vitest";
import {
  HDR_CODEC_HINTS,
  MAX_CANDIDATES,
  MAX_EPISODE_SIZE_BYTES,
  MAX_MOVIE_SIZE_BYTES,
  pickCandidates,
  scoreCandidate,
  type StreamCandidate,
} from "./pick-candidates";
import { parseStreamTitle, type ParsedStream } from "./parse-stream-title";
import { parseStreams } from "./torrentio";
import { asConfiguredStreams } from "./__fixtures__/as-configured";
import duneFixture from "./__fixtures__/movie-dune-part-two.json";
import matrixFixture from "./__fixtures__/movie-the-matrix.json";
import tlouFixture from "./__fixtures__/series-the-last-of-us-s01e03.json";
import friendsFixture from "./__fixtures__/series-friends-s05e14.json";

function toCandidates(
  fixture: { streams: unknown[] },
  context: string,
): StreamCandidate[] {
  return parseStreams(asConfiguredStreams(fixture.streams), context).map(
    (stream) => ({
      url: stream.url,
      parsed: parseStreamTitle(stream.title),
    }),
  );
}

const dune = toCandidates(duneFixture, "dune fixture");
const matrix = toCandidates(matrixFixture, "matrix fixture");
const tlou = toCandidates(tlouFixture, "tlou fixture");
const friends = toCandidates(friendsFixture, "friends fixture");

const isHdr = (parsed: ParsedStream) =>
  parsed.codecHints.some((hint) => HDR_CODEC_HINTS.has(hint));

// Synthetic candidates for weight-relation tests: fixture data proves the
// pipeline, minimal literals prove each individual rule.
let syntheticUrls = 0;
function candidate(
  overrides: Partial<ParsedStream> = {},
  url?: string,
): StreamCandidate {
  syntheticUrls += 1;
  return {
    url:
      url ??
      `https://torrentio.example/fake-resolve/synthetic/${syntheticUrls}`,
    parsed: {
      releaseName: "Synthetic.Release",
      resolution: "1080p",
      sizeBytes: 2 * 1024 ** 3,
      seeders: 50,
      provider: "Test",
      sourceHint: null,
      codecHints: [],
      containerHint: null,
      languageHints: [],
      seasonPack: false,
      extrasFile: false,
      ...overrides,
    },
  };
}

describe("pickCandidates on captured fixtures", () => {
  it("shortlists five in-cap SDR 1080p picks for a hot movie (Dune)", () => {
    const picks = pickCandidates(dune, "movie");

    expect(picks).toHaveLength(MAX_CANDIDATES);
    for (const pick of picks) {
      expect(pick.parsed.resolution).toBe("1080p");
      expect(["webdl", "webrip", "bluray", "bdrip", null]).toContain(
        pick.parsed.sourceHint,
      );
      expect(isHdr(pick.parsed)).toBe(false);
      expect(pick.parsed.codecHints).not.toContain("3d");
      expect(
        pick.parsed.sizeBytes === null ||
          pick.parsed.sizeBytes <= MAX_MOVIE_SIZE_BYTES,
      ).toBe(true);
    }
    // Ordered by score, best first.
    const scores = picks.map((pick) => scoreCandidate(pick.parsed));
    expect([...scores].sort((a, b) => b - a)).toEqual(scores);
    // Multi-movie packs lose to any standalone release, and BluRay-family
    // sources outrank WEB ones regardless of seeders - RD refuses WEB
    // releases at resolve time (see BLOCK_PRONE_SOURCE_HINTS).
    expect(picks[0].parsed.seasonPack).toBe(false);
    expect(picks[0].parsed.sourceHint).not.toBe("webdl");
    expect(picks[0].parsed.sourceHint).not.toBe("webrip");
  });

  it("excludes the 2160p HDR release when SDR alternatives exist", () => {
    const picks = pickCandidates(dune, "movie");
    const flux = dune.find((entry) =>
      entry.parsed.releaseName?.includes("H.265-FLUX[TGx]"),
    );

    expect(flux).toBeDefined();
    expect(picks).not.toContain(flux);
  });

  it("keeps HDR when no SDR alternative survives", () => {
    const hdrOnly = matrix.filter((entry) => isHdr(entry.parsed));
    const picks = pickCandidates(hdrOnly, "movie");

    expect(picks.length).toBeGreaterThan(0);
    expect(picks.every((pick) => isHdr(pick.parsed))).toBe(true);
  });

  it("applies the movie size cap (Matrix 22 GiB 1080p stays out)", () => {
    const picks = pickCandidates(matrix, "movie");

    expect(picks).toHaveLength(MAX_CANDIDATES);
    for (const pick of picks) {
      expect(
        pick.parsed.sizeBytes === null ||
          pick.parsed.sizeBytes <= MAX_MOVIE_SIZE_BYTES,
      ).toBe(true);
    }
  });

  it("shortlists season packs with fileIdx for a classic sitcom (Friends)", () => {
    const picks = pickCandidates(friends, "episode");

    expect(picks).toHaveLength(MAX_CANDIDATES);
    for (const pick of picks) {
      expect(["1080p", "720p"]).toContain(pick.parsed.resolution);
      expect(
        pick.parsed.sizeBytes === null ||
          pick.parsed.sizeBytes <= MAX_EPISODE_SIZE_BYTES,
      ).toBe(true);
    }
    // The 404-seeder "Spanish & English" series pack (🇬🇧 / 🇪🇸) that used to
    // dominate is excluded as dual audio - its default track is
    // unknowable. The pick is the English-only BluRay season pack.
    expect(picks[0].parsed.releaseName).toContain(
      "Friends.S05.1080p.BluRay.x264-TENEIGHTY",
    );
    expect(picks[0].parsed.seasonPack).toBe(true);
    expect(picks[0].parsed.languageHints).toEqual([]);
    // Its synthetic url encodes infoHash/fileIdx - /13 is S05E14 in this pack,
    // preserving the capture-verified "right file within the pack" evidence.
    expect(picks[0].url.endsWith("/13")).toBe(true);
    // The same torrent listed by several indexers must not repeat.
    const urls = picks.map((pick) => pick.url);
    expect(new Set(urls).size).toBe(urls.length);
  });

  it("keeps extras files and non-English releases out (TLOU)", () => {
    const picks = pickCandidates(tlou, "episode");

    expect(picks).toHaveLength(MAX_CANDIDATES);
    for (const pick of picks) {
      expect(pick.parsed.extrasFile).toBe(false);
      expect(pick.parsed.languageHints.every((hint) => hint === "en")).toBe(
        true,
      );
    }
  });

  // A live smoke once resolved Dune to "Dune Parte Due … iTA-ENG" (🇬🇧 / 🇮🇹) and
  // it played Italian: the browser takes the container's default track and
  // cannot switch. Dual releases must never reach the shortlist
  // while English-only ones exist - and for English-original titles they
  // always do (52 of this capture's 101 streams carry no language hint).
  it("never shortlists dual-audio releases for an English-original title (Dune)", () => {
    const picks = pickCandidates(dune, "movie");

    expect(picks).toHaveLength(MAX_CANDIDATES);
    for (const pick of picks) {
      expect(pick.parsed.languageHints.every((hint) => hint === "en")).toBe(
        true,
      );
      expect(pick.parsed.releaseName).not.toMatch(/ita/i);
    }
  });
});

describe("pickCandidates standalone-movie preference", () => {
  it("drops multi-movie collections from movie shortlists (Dune, Matrix)", () => {
    for (const [name, fixture] of [
      ["dune", dune],
      ["matrix", matrix],
    ] as const) {
      const picks = pickCandidates(fixture, "movie");
      expect(picks.length, name).toBeGreaterThan(0);
      expect(
        picks.every((pick) => !pick.parsed.seasonPack),
        `${name}: shortlist must be standalone releases`,
      ).toBe(true);
    }
  });

  it("keeps season packs for episode requests (Friends S05E14)", () => {
    const picks = pickCandidates(friends, "episode");
    expect(picks.some((pick) => pick.parsed.seasonPack)).toBe(true);
  });

  it("falls back to packs when a movie has no standalone release", () => {
    const packsOnly = [
      candidate({ seasonPack: true, seeders: 10 }),
      candidate({ seasonPack: true, seeders: 90 }),
    ];
    const picks = pickCandidates(packsOnly, "movie");
    expect(picks).toHaveLength(2);
    expect(picks[0].parsed.seeders).toBe(90);
  });

  it("prefers a standalone release over a better-seeded pack", () => {
    const pack = candidate({ seasonPack: true, seeders: 500 });
    const standalone = candidate({ seasonPack: false, seeders: 5 });
    expect(pickCandidates([pack, standalone], "movie")).toEqual([standalone]);
  });
});

describe("pickCandidates exclusions (synthetic)", () => {
  it.each([
    ["cam source", candidate({ sourceHint: "cam" })],
    ["telesync source", candidate({ sourceHint: "telesync" })],
    ["screener source", candidate({ sourceHint: "screener" })],
    ["3d release", candidate({ codecHints: ["h264", "3d"] })],
    ["sub-720p", candidate({ resolution: "480p" })],
    ["over the episode cap", candidate({ sizeBytes: 5 * 1024 ** 3 })],
    ["non-English audio", candidate({ languageHints: ["fr"] })],
    [
      "dual audio that also lists English",
      candidate({ languageHints: ["en", "it"] }),
    ],
    ["multi audio", candidate({ languageHints: ["multi", "fr"] })],
    ["dual audio", candidate({ languageHints: ["dual", "es"] })],
    ["extras file", candidate({ extrasFile: true })],
  ])("excludes %s", (_label, excluded) => {
    const keeper = candidate();
    expect(pickCandidates([excluded, keeper], "episode")).toEqual([keeper]);
  });

  it("keeps unknown sizes, unknown resolutions and English-flagged audio", () => {
    const unknownSize = candidate({ sizeBytes: null });
    const unknownResolution = candidate({ resolution: null });
    const englishFlagged = candidate({ languageHints: ["en"] });

    const picks = pickCandidates(
      [unknownSize, unknownResolution, englishFlagged],
      "movie",
    );
    expect(picks).toHaveLength(3);
    // Unknown resolution scores below every known-good tier.
    expect(picks[picks.length - 1]).toBe(unknownResolution);
  });

  it("uses the larger cap for movies", () => {
    const eightGig = candidate({ sizeBytes: 8 * 1024 ** 3 });
    expect(pickCandidates([eightGig], "movie")).toEqual([eightGig]);
    expect(pickCandidates([eightGig], "episode")).toEqual([]);
  });
});

describe("pickCandidates preference ladder (synthetic)", () => {
  it("orders resolutions 1080p > 720p > 2160p", () => {
    const c2160 = candidate({ resolution: "2160p" });
    const c720 = candidate({ resolution: "720p" });
    const c1080 = candidate({ resolution: "1080p" });

    const picks = pickCandidates([c2160, c720, c1080], "movie");
    expect(picks).toEqual([c1080, c720, c2160]);
  });

  it("prefers more seeders within a resolution tier", () => {
    const low = candidate({ seeders: 10 });
    const high = candidate({ seeders: 200 });
    expect(pickCandidates([low, high], "movie")).toEqual([high, low]);
  });

  it("prefers BluRay-family sources, H.264, and MP4 (in bonus order)", () => {
    const plain = candidate();
    const bluray = candidate({ sourceHint: "bluray" });
    const bdrip = candidate({ sourceHint: "bdrip" });
    const h264 = candidate({ codecHints: ["h264"] });
    const h265 = candidate({ codecHints: ["h265"] });
    const mp4 = candidate({ containerHint: "mp4" });
    const mkv = candidate({ containerHint: "mkv" });

    expect(pickCandidates([plain, bluray], "movie")).toEqual([bluray, plain]);
    expect(pickCandidates([plain, bdrip], "movie")).toEqual([bdrip, plain]);
    expect(pickCandidates([h265, h264], "movie")).toEqual([h264, h265]);
    expect(pickCandidates([mkv, mp4], "movie")).toEqual([mp4, mkv]);
  });

  it("ranks WEB releases below everything else - RD refuses them at resolve time", () => {
    const bluray = candidate({ sourceHint: "bluray", seeders: 1 });
    const unknownSource = candidate({ sourceHint: null, seeders: 1 });
    const webdl = candidate({ sourceHint: "webdl", seeders: 500 });
    const webrip = candidate({ sourceHint: "webrip", seeders: 500 });

    // Even a 500-seeder WEB rip loses to a 1-seeder BluRay.
    expect(pickCandidates([webdl, bluray], "movie")).toEqual([bluray, webdl]);
    expect(pickCandidates([webrip, unknownSource], "movie")).toEqual([
      unknownSource,
      webrip,
    ]);
  });

  it("caps the shortlist at MAX_CANDIDATES and dedupes relisted resolve urls", () => {
    const many = Array.from({ length: 8 }, (_, index) =>
      candidate({ seeders: 100 - index }),
    );
    expect(pickCandidates(many, "movie")).toHaveLength(MAX_CANDIDATES);

    const sharedUrl = "https://torrentio.example/fake-resolve/same-hash/3";
    const original = candidate({}, sharedUrl);
    const relisted = candidate({ seeders: 5 }, sharedUrl);
    const otherFile = candidate(
      {},
      "https://torrentio.example/fake-resolve/same-hash/4",
    );
    const picks = pickCandidates([original, relisted, otherFile], "movie");
    expect(picks).toHaveLength(2);
    expect(picks).toContain(original);
    expect(picks).toContain(otherFile);
  });
});
