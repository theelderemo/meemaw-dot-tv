import { describe, expect, it } from "vitest";
import duneFixture from "./__fixtures__/movie-dune-part-two.json";
import { asConfiguredStreams } from "./__fixtures__/as-configured";
import { MAX_CANDIDATES, pickCandidates } from "./pick-candidates.ts";
import { parseStreamTitle } from "./parse-stream-title.ts";
import { STREAM_KEY_PATTERN, streamKey } from "./stream-key.ts";
import { toStreamOptions } from "./stream-options.ts";
import { parseStreams } from "./torrentio.ts";

const streams = parseStreams(
  asConfiguredStreams(duneFixture.streams),
  "dune fixture",
);

describe("toStreamOptions (Dune capture)", () => {
  const options = toStreamOptions(streams, "movie");

  it("lists every distinct stream, unfiltered, in Torrentio's order", () => {
    const distinctUrls = new Set(streams.map((stream) => stream.url)).size;
    expect(options).toHaveLength(distinctUrls);
    expect(options.length).toBeGreaterThan(MAX_CANDIDATES);
    // First option is Torrentio's first stream, not the picker's favorite.
    expect(options[0].key).toBe(streamKey(streams[0].url));
    for (const option of options) {
      expect(option.key).toMatch(STREAM_KEY_PATTERN);
    }
    expect(new Set(options.map((option) => option.key)).size).toBe(
      options.length,
    );
  });

  it("keeps the streams the picker excludes (dual audio, packs, HDR) visible", () => {
    const dual = options.filter((option) =>
      option.languageHints.some((hint) => hint !== "en"),
    );
    expect(dual.length).toBeGreaterThan(0);
    expect(dual.every((option) => !option.recommended)).toBe(true);
  });

  it("flags exactly the picker's shortlist as recommended", () => {
    const shortlist = new Set(
      pickCandidates(
        streams.map((stream) => ({
          url: stream.url,
          parsed: parseStreamTitle(stream.title),
        })),
        "movie",
      ).map((pick) => streamKey(pick.url)),
    );
    const recommended = options.filter((option) => option.recommended);
    expect(recommended.map((option) => option.key).sort()).toEqual(
      [...shortlist].sort(),
    );
    expect(recommended.length).toBeLessThanOrEqual(MAX_CANDIDATES);
  });

  it("carries the display fields the switcher renders", () => {
    const sample = options.find((option) => option.recommended)!;
    expect(sample.releaseName).toBeTruthy();
    expect(sample.resolution).toBe("1080p");
    expect(typeof sample.sizeBytes).toBe("number");
    expect(typeof sample.seeders).toBe("number");
    expect(sample.provider).toBeTruthy();
  });
});
