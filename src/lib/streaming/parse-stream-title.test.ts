import { describe, expect, it } from "vitest";
import { parseStreamTitle } from "./parse-stream-title";
import { parseStreams, type TorrentioStream } from "./torrentio";
// Fixtures are complete, untrimmed Torrentio responses captured Aug 2026 by
// scripts/capture-torrentio.mjs - the ground truth this parser was built
// from. The title blobs are identical on the configured endpoint;
// asConfiguredStreams only adapts the envelope to the new url-keyed schema.
import { asConfiguredStreams } from "./__fixtures__/as-configured";
import duneFixture from "./__fixtures__/movie-dune-part-two.json";
import matrixFixture from "./__fixtures__/movie-the-matrix.json";
import tlouFixture from "./__fixtures__/series-the-last-of-us-s01e03.json";
import friendsFixture from "./__fixtures__/series-friends-s05e14.json";

const dune = parseStreams(
  asConfiguredStreams(duneFixture.streams),
  "dune fixture",
);
const matrix = parseStreams(
  asConfiguredStreams(matrixFixture.streams),
  "matrix fixture",
);
const tlou = parseStreams(
  asConfiguredStreams(tlouFixture.streams),
  "tlou fixture",
);
const friends = parseStreams(
  asConfiguredStreams(friendsFixture.streams),
  "friends fixture",
);

function findStream(
  streams: TorrentioStream[],
  pattern: RegExp,
): TorrentioStream {
  const stream = streams.find((entry) => pattern.test(entry.title));
  if (!stream) throw new Error(`no fixture stream matches ${pattern}`);
  return stream;
}

describe("parseStreamTitle on captured movie entries", () => {
  it("parses a single-line 2160p WEB-DL release (Dune, FLUX)", () => {
    const stream = findStream(dune, /H\.265-FLUX\[TGx\]/);
    const parsed = parseStreamTitle(stream.title);

    expect(parsed.releaseName).toBe(
      "Dune.Part.Two.2024.2160p.WEB-DL.DDP5.1.Atmos.DV.HDR.H.265-FLUX[TGx]",
    );
    expect(parsed.resolution).toBe("2160p");
    expect(parsed.sizeBytes).toBe(Math.round(29.26 * 1024 ** 3));
    expect(parsed.seeders).toBe(433);
    expect(parsed.provider).toBe("TorrentGalaxy");
    expect(parsed.sourceHint).toBe("webdl");
    expect(parsed.codecHints).toEqual(["h265", "hdr", "dv"]);
    // No extension in the blob itself - behaviorHints has it, the blob doesn't.
    expect(parsed.containerHint).toBeNull();
    expect(parsed.languageHints).toEqual([]);
    expect(parsed.seasonPack).toBe(false);
    expect(parsed.extrasFile).toBe(false);
  });

  it("marks CAM releases via sourceHint and degrades missing fields to null", () => {
    const stream = findStream(dune, /HDCAM/);
    const parsed = parseStreamTitle(stream.title);

    expect(parsed.sourceHint).toBe("cam");
    expect(parsed.resolution).toBeNull();
    expect(parsed.codecHints).toEqual(["h264"]);
    expect(parsed.sizeBytes).toBe(Math.round(996.33 * 1024 ** 2));
  });

  it("keeps telesync marked even when the name claims 1080p", () => {
    const stream = findStream(dune, /HDTS Collective/);
    const parsed = parseStreamTitle(stream.title);

    expect(parsed.sourceHint).toBe("telesync");
    expect(parsed.resolution).toBe("1080p");
  });

  it("reads the file line of a collection: resolution, container, languages", () => {
    // Torrentio matched The Matrix inside a 263-movie pack - the file line
    // carries the real quality data and 💾 is the file's size, not the pack's.
    const stream = findStream(matrix, /Imdb top 263 movies/);
    const parsed = parseStreamTitle(stream.title);

    expect(parsed.releaseName).toBe("Imdb top 263 movies hindi english gdrive");
    expect(parsed.resolution).toBe("1080p");
    expect(parsed.containerHint).toBe("mp4");
    expect(parsed.sourceHint).toBe("bdrip");
    expect(parsed.codecHints).toEqual(["h264"]);
    expect(parsed.seeders).toBe(2081);
    expect(parsed.sizeBytes).toBe(Math.round(1.86 * 1024 ** 3));
    // 🇬🇧/🇮🇳 flags first, then release-name tokens (deduped).
    expect(parsed.languageHints).toEqual(["en", "hi"]);
    expect(parsed.seasonPack).toBe(true);
    // The capture's fileIdx (222 = the Matrix file in the pack) survives in
    // the adapted stream's synthetic url.
    expect(stream.url.endsWith("/222")).toBe(true);
  });

  it("prefers an explicit 1080p token over UHD/4k wording", () => {
    // "1080p UHD BluRay" = a 1080p encode of the UHD master.
    const stream = findStream(matrix, /DD7 1 DV HDR x264-HiDt/);
    const parsed = parseStreamTitle(stream.title);

    expect(parsed.resolution).toBe("1080p");
    expect(parsed.sourceHint).toBe("bluray");
    expect(parsed.codecHints).toEqual(["h264", "hdr", "dv"]);
    expect(parsed.sizeBytes).toBe(Math.round(22.16 * 1024 ** 3));
  });
});

describe("parseStreamTitle on captured series entries", () => {
  it("parses a season pack with a file line, MB size and audio flags", () => {
    // 4-line blob: Russian pack name, file line, stats, 🇬🇧/🇷🇺 flags.
    const stream = findStream(friends, /Серии: 1-234 из 234 \[1994-2004 UHD/);
    const parsed = parseStreamTitle(stream.title);

    expect(parsed.seasonPack).toBe(true);
    expect(stream.url.endsWith("/127")).toBe(true);
    expect(parsed.resolution).toBe("2160p");
    expect(parsed.sourceHint).toBe("bluray");
    expect(parsed.codecHints).toEqual(["hdr", "dv"]);
    expect(parsed.containerHint).toBe("mkv");
    expect(parsed.languageHints).toEqual(["en", "ru"]);
    expect(parsed.seeders).toBe(118);
    expect(parsed.provider).toBe("Rutracker");
    expect(parsed.sizeBytes).toBe(Math.round(6.56 * 1024 ** 3));
  });

  it("parses a single-episode release with an MB-unit size", () => {
    const stream = findStream(tlou, /1080p HEVC x265-MeGusta/);
    const parsed = parseStreamTitle(stream.title);

    expect(parsed.seasonPack).toBe(false);
    expect(parsed.resolution).toBe("1080p");
    expect(parsed.codecHints).toEqual(["h265"]);
    expect(parsed.sizeBytes).toBe(Math.round(1013.6 * 1024 ** 2));
    expect(parsed.seeders).toBe(12);
    expect(parsed.provider).toBe("EZTV");
  });

  it("detects a whole-season REMUX pack (spaced tokens, HEVC alias)", () => {
    const stream = findStream(tlou, /REMUX-FraMeSToR\n/);
    const parsed = parseStreamTitle(stream.title);

    expect(parsed.seasonPack).toBe(true);
    expect(parsed.resolution).toBe("2160p");
    expect(parsed.sourceHint).toBe("bluray");
    expect(parsed.codecHints).toEqual(["h265", "dv"]);
    expect(parsed.containerHint).toBe("mkv");
  });

  it("collects language flags without an English marker", () => {
    const stream = findStream(tlou, /FRENCH HDTV/);
    const parsed = parseStreamTitle(stream.title);

    expect(parsed.languageHints).toEqual(["fr"]);
    expect(parsed.sourceHint).toBe("hdtv");
    expect(parsed.resolution).toBeNull();
  });

  it("does not read a .ts file extension as a TeleSync source", () => {
    // Czech SATRip junk-match in the Dune capture whose file ends in ".ts".
    const stream = findStream(dune, /Válka na moři \(E05\)\.ts/);
    const parsed = parseStreamTitle(stream.title);

    expect(parsed.containerHint).toBe("ts");
    expect(parsed.sourceHint).toBe("hdtv");
    expect(parsed.languageHints).toEqual(["cs", "sv"]);
    expect(parsed.seasonPack).toBe(true);
  });

  it("flags extras files (featurette fuzzy-matched as the episode)", () => {
    const extras = findStream(tlou, /Inside\.the\.Episode/);
    const episode = findStream(tlou, /S01E03\.Molto\.molto\.tempo/);

    expect(parseStreamTitle(extras.title).extrasFile).toBe(true);
    expect(parseStreamTitle(episode.title).extrasFile).toBe(false);
  });
});

describe("parseStreamTitle degradation", () => {
  it("returns all-null defaults on an empty blob without throwing", () => {
    expect(parseStreamTitle("")).toEqual({
      releaseName: null,
      resolution: null,
      sizeBytes: null,
      seeders: null,
      provider: null,
      sourceHint: null,
      codecHints: [],
      containerHint: null,
      languageHints: [],
      seasonPack: false,
      extrasFile: false,
    });
  });

  it("parses a release-name-only blob (no stats line)", () => {
    const parsed = parseStreamTitle("Some.Movie.2024.1080p.WEB-DL.x264-GRP");

    expect(parsed.releaseName).toBe("Some.Movie.2024.1080p.WEB-DL.x264-GRP");
    expect(parsed.resolution).toBe("1080p");
    expect(parsed.seeders).toBeNull();
    expect(parsed.sizeBytes).toBeNull();
    expect(parsed.provider).toBeNull();
  });
});

describe("parseStreamTitle multi-audio token edge cases", () => {
  const stats = "\n👤 10 💾 3.78 GB ⚙️ 1337x";

  it("reads a numbered MULTi4 release as multi audio (no flag line needed)", () => {
    const parsed = parseStreamTitle(
      "Dune.Part.Two.2024.REPACK.1080p.BluRay.AV1.Opus.7.1.MULTi4-dAV1nci" +
        stats,
    );
    expect(parsed.languageHints).toEqual(["multi"]);
  });

  it("does not read subtitle-only Multi-Subs / MultiSubs markers as audio", () => {
    for (const name of [
      "Dune.Part.Two.2024.1080p.BluRay.x264.Multi-Subs-GROUP",
      "Dune.Part.Two.2024.1080p.BluRay.x264.MultiSubs-GROUP",
      "Dune.Part.Two.2024.1080p.BluRay.x264.Multisub-GROUP",
    ]) {
      expect(parseStreamTitle(name + stats).languageHints).toEqual([]);
    }
  });
});

describe("parseStreamTitle trailer torrents (single-file, no file line)", () => {
  // Live capture 2026-08-23: Moana (2026)'s only Torrentio stream. It resolved
  // and played a 267 MB trailer because the extras marker only saw file lines.
  const moanaTrailer =
    "Moana (2026) Trailer 2 FS3D 1080p WEB-DL x264 DTS/DD 5.1\n👤 0 💾 267.19 MB ⚙️ 1337x";

  it("reads a trailer named on the release line as a non-feature file", () => {
    const parsed = parseStreamTitle(moanaTrailer);
    expect(parsed.extrasFile).toBe(true);
    // FS3D (side-by-side 3D) is a 3D release too.
    expect(parsed.codecHints).toContain("3d");
  });

  it("reads teasers the same way", () => {
    expect(
      parseStreamTitle(
        "Moana.2026.Official.Teaser.1080p.WEB-DL.x264\n👤 3 💾 120 MB ⚙️ 1337x",
      ).extrasFile,
    ).toBe(true);
  });

  it("spares titles that merely contain the word (Trailer Park Boys)", () => {
    for (const name of [
      "Trailer.Park.Boys.S01E01.1080p.WEB-DL.x264-GROUP",
      "Trailer Park Shark 2017 1080p WEB-DL x264",
    ]) {
      expect(
        parseStreamTitle(name + "\n👤 40 💾 1.2 GB ⚙️ 1337x").extrasFile,
      ).toBe(false);
    }
  });
});
