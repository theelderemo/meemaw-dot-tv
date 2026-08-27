import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  MAX_RESOLVE_ATTEMPTS,
  resolveStream,
  RESOLVED_HOST_SUFFIX,
} from "./resolve-stream";
import type { StreamTarget } from "./torrentio";

// Fully offline: every test stubs global fetch with a scripted router covering
// the configured Torrentio listing and each stream's resolve url. Torrentio's
// module-level cache is shared across tests, so each test uses a fresh imdbId.

// Test-only sentinel secret - asserted ABSENT from results, logs and errors.
const TEST_KEY = "RDKEY-SENTINEL-77b1";
const TEST_CONFIG = `qualityfilter=cam,unknown|realdebrid=${TEST_KEY}`;

let imdbCounter = 9_300_000;

function nextMovieTarget(): StreamTarget {
  imdbCounter += 1;
  return { type: "movie", imdbId: `tt${imdbCounter}` };
}

function nextSeriesTarget(season = 1, episode = 3): StreamTarget {
  imdbCounter += 1;
  return { type: "series", imdbId: `tt${imdbCounter}`, season, episode };
}

// Mirrors the real resolver url shape - the key sits in the path, so any leak
// of a candidate url into results or logs would carry the sentinel.
function resolveUrlFor(id: string): string {
  return `https://torrentio.strem.fun/resolve/realdebrid/${TEST_KEY}/${id}`;
}

function movieStream(id: string, seeders: number): unknown {
  return {
    url: resolveUrlFor(id),
    title: `Movie.${id}.2024.1080p.WEB-DL.x264\n👤 ${seeders} 💾 2.50 GB ⚙️ TG`,
    name: "[RD+] Torrentio\n1080p",
  };
}

function episodeStream(id: string, seeders: number): unknown {
  return {
    url: resolveUrlFor(id),
    title:
      `Show.S01.1080p.WEB-DL.x264\nShow.S01E03.1080p.WEB-DL.x264.mkv\n` +
      `👤 ${seeders} 💾 1.20 GB ⚙️ TG`,
    name: "[RD+] Torrentio\n1080p",
  };
}

const RD_HOST = "20.download.real-debrid.com";

function rdLocation(filename: string): string {
  return `https://${RD_HOST}/d/DLTOKEN/${filename}`;
}

type ResolveSpec = { status: number; location?: string } | "network-error";

type PipelineScript = {
  streams: unknown[];
  /** Keyed by the resolve id passed to movieStream/episodeStream. */
  resolves?: Record<string, ResolveSpec>;
  listingStatus?: number;
};

function stubPipeline(script: PipelineScript) {
  const resolveCalls: string[] = [];

  const fetchMock = vi.fn(
    async (input: unknown, init?: RequestInit): Promise<Response> => {
      const url = String(input);

      if (url.includes("/stream/")) {
        return new Response(JSON.stringify({ streams: script.streams }), {
          status: script.listingStatus ?? 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Everything else must be a resolve url fetched with redirects disabled.
      expect(init?.redirect).toBe("manual");
      const id = url.split("/").pop() ?? "";
      resolveCalls.push(id);
      const spec = script.resolves?.[id];
      if (spec === undefined) {
        throw new Error(`unscripted resolve fetch for id ${id}`);
      }
      if (spec === "network-error") {
        // Deliberately embeds the secret-bearing url, like a transport error
        // might - describeError() must scrub it before it reaches a log.
        throw new TypeError(`fetch failed for ${url}`);
      }
      return new Response(null, {
        status: spec.status,
        headers: spec.location ? { location: spec.location } : {},
      });
    },
  );

  vi.stubGlobal("fetch", fetchMock);
  return { fetchMock, resolveCalls };
}

function allConsoleText(): string {
  return [
    ...vi.mocked(console.log).mock.calls,
    ...vi.mocked(console.error).mock.calls,
  ]
    .flat()
    .map(String)
    .join("\n");
}

beforeEach(() => {
  vi.stubEnv("TORRENTIO_CONFIG", TEST_CONFIG);
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("happy path", () => {
  it("follows one 302 and returns only the final real-debrid.com URL", async () => {
    const location = rdLocation("Movie.aaa1.2024.1080p.WEB-DL.x264.mkv");
    const { resolveCalls } = stubPipeline({
      streams: [movieStream("aaa1", 300)],
      resolves: { aaa1: { status: 302, location } },
    });

    const result = await resolveStream(nextMovieTarget());

    expect(result).toEqual({
      ok: true,
      // An opaque hash of the resolve url, never the url itself.
      key: expect.stringMatching(/^[0-9a-f]{16}$/),
      url: location,
      filename: "Movie.aaa1.2024.1080p.WEB-DL.x264.mkv",
      sizeBytes: Math.round(2.5 * 1024 ** 3),
      releaseName: "Movie.aaa1.2024.1080p.WEB-DL.x264",
      resolution: "1080p",
    });
    expect(resolveCalls).toEqual(["aaa1"]);
    // The resolve url (and with it the RD key) must never leave the module.
    expect(JSON.stringify(result)).not.toContain(TEST_KEY);
    expect(allConsoleText()).not.toContain(TEST_KEY);
  });

  it("decodes percent-encoded filenames and falls back to the release name", async () => {
    const encoded = stubPipeline({
      streams: [episodeStream("bbb1", 90)],
      resolves: {
        bbb1: {
          status: 302,
          location: `https://${RD_HOST}/d/DLTOKEN/Show%20S01E03%201080p.mkv`,
        },
      },
    });
    const withFile = await resolveStream(nextSeriesTarget());
    expect(withFile).toMatchObject({
      ok: true,
      filename: "Show S01E03 1080p.mkv",
      sizeBytes: Math.round(1.2 * 1024 ** 3),
    });
    expect(encoded.resolveCalls).toEqual(["bbb1"]);

    stubPipeline({
      streams: [movieStream("bbb2", 90)],
      // A bare host path has no basename to use as a filename.
      resolves: { bbb2: { status: 302, location: `https://${RD_HOST}/` } },
    });
    const bare = await resolveStream(nextMovieTarget());
    expect(bare).toMatchObject({
      ok: true,
      filename: "Movie.bbb2.2024.1080p.WEB-DL.x264",
    });
  });
});

describe("pick ordering over the new shape", () => {
  it("tries streams in the picker's ranked order, not listing order", async () => {
    const { resolveCalls } = stubPipeline({
      streams: [
        // Listing order is worst-first: the picker must reorder by score.
        movieStream("low", 10),
        movieStream("high", 400),
        {
          url: resolveUrlFor("cam"),
          title: "Movie.cam.2024.HDCAM.x264\n👤 999 💾 1.00 GB ⚙️ TG",
          name: "[RD+] Torrentio\nCAM",
        },
      ],
      resolves: {
        high: { status: 302, location: rdLocation("high.mkv") },
        low: { status: 302, location: rdLocation("low.mkv") },
      },
    });

    const result = await resolveStream(nextMovieTarget());

    expect(result).toMatchObject({ ok: true, url: rdLocation("high.mkv") });
    // Best-ranked first, resolved on the first attempt; the CAM release is
    // excluded before any resolve fetch.
    expect(resolveCalls).toEqual(["high"]);
  });
});

describe("fall-through and rejection", () => {
  it("falls through a non-302 response to the next ranked stream", async () => {
    const { resolveCalls } = stubPipeline({
      streams: [movieStream("first", 300), movieStream("second", 50)],
      resolves: {
        first: { status: 200 },
        second: { status: 302, location: rdLocation("second.mkv") },
      },
    });

    const result = await resolveStream(nextMovieTarget());

    expect(result).toMatchObject({ ok: true, url: rdLocation("second.mkv") });
    expect(resolveCalls).toEqual(["first", "second"]);
  });

  it("rejects redirects whose host does not end in .real-debrid.com", async () => {
    const { resolveCalls } = stubPipeline({
      streams: [
        movieStream("evil", 400),
        movieStream("suffix-trick", 300),
        movieStream("prefix-trick", 200),
        movieStream("plain-http", 100),
        movieStream("good", 50),
      ],
      resolves: {
        evil: { status: 302, location: "https://evil.example/f.mkv" },
        "suffix-trick": {
          status: 302,
          location: "https://real-debrid.com.evil.example/f.mkv",
        },
        "prefix-trick": {
          status: 302,
          location: "https://evil-real-debrid.com/f.mkv",
        },
        "plain-http": {
          status: 302,
          location: `http://${RD_HOST}/d/DLTOKEN/f.mkv`,
        },
        good: { status: 302, location: rdLocation("good.mkv") },
      },
    });

    const result = await resolveStream(nextMovieTarget());

    expect(result).toMatchObject({ ok: true, url: rdLocation("good.mkv") });
    expect(resolveCalls).toEqual([
      "evil",
      "suffix-trick",
      "prefix-trick",
      "plain-http",
      "good",
    ]);
    expect(allConsoleText()).not.toContain(TEST_KEY);
  });

  it("skips a 302 without a Location and an unparseable Location", async () => {
    const { resolveCalls } = stubPipeline({
      streams: [movieStream("no-location", 300), movieStream("garbage", 50)],
      resolves: {
        "no-location": { status: 302 },
        garbage: { status: 302, location: "%%not-a-url%%" },
      },
    });

    const result = await resolveStream(nextMovieTarget());
    expect(result).toEqual({ ok: false, code: "NOT_CACHED" });
    expect(resolveCalls).toEqual(["no-location", "garbage"]);
  });
});

// Torrentio's own answer for an RD-blocked stream (measured 2026-08-20).
const FAILURE_VIDEO = {
  status: 302,
  location: "https://torrentio.strem.fun/videos/failed_infringement_v2.mp4",
} as const;

describe("attempt cascade past the first shortlist", () => {
  it("keeps trying ranked streams beyond the first five", async () => {
    // Descending seeders -> deterministic ranking = listing order. The first
    // six hit Torrentio's failure video (RD infringement block); the seventh
    // is reached only because attempts continue past one shortlist of five.
    const ids = ["a1", "a2", "a3", "a4", "a5", "a6", "a7"];
    const resolves: Record<string, ResolveSpec> = Object.fromEntries(
      ids.map((id) => [id, FAILURE_VIDEO]),
    );
    resolves.a7 = { status: 302, location: rdLocation("a7.mkv") };
    const { resolveCalls } = stubPipeline({
      streams: ids.map((id, index) => movieStream(id, 400 - index * 10)),
      resolves,
    });

    const result = await resolveStream(nextMovieTarget());

    expect(result).toMatchObject({ ok: true, url: rdLocation("a7.mkv") });
    expect(resolveCalls).toEqual(ids);
    // The routine RD-block skip is logged as such, without any url.
    const consoleText = allConsoleText();
    expect(consoleText).toContain("failure video");
    expect(consoleText).not.toContain(TEST_KEY);
  });

  it("relaxes pool-narrowing preferences in later rounds (HDR after SDR)", async () => {
    const { resolveCalls } = stubPipeline({
      streams: [
        movieStream("sdr", 300),
        {
          url: resolveUrlFor("hdr"),
          title:
            "Movie.hdr.2024.1080p.WEB-DL.HDR.x265\n👤 100 💾 2.50 GB ⚙️ TG",
          name: "[RD+] Torrentio\n1080p HDR",
        },
      ],
      resolves: {
        sdr: FAILURE_VIDEO,
        hdr: { status: 302, location: rdLocation("hdr.mkv") },
      },
    });

    const result = await resolveStream(nextMovieTarget());

    // Round 1 narrows to the SDR release; only after it fails does round 2
    // re-admit the HDR-only remainder.
    expect(result).toMatchObject({ ok: true, url: rdLocation("hdr.mkv") });
    expect(resolveCalls).toEqual(["sdr", "hdr"]);
  });

  it(`stops after ${MAX_RESOLVE_ATTEMPTS} attempts`, async () => {
    const ids = Array.from({ length: 25 }, (_, index) => `b${index}`);
    const { resolveCalls } = stubPipeline({
      streams: ids.map((id, index) => movieStream(id, 500 - index * 5)),
      resolves: Object.fromEntries(ids.map((id) => [id, { status: 404 }])),
    });

    const result = await resolveStream(nextMovieTarget());

    expect(result).toEqual({ ok: false, code: "NOT_CACHED" });
    expect(resolveCalls).toEqual(ids.slice(0, MAX_RESOLVE_ATTEMPTS));
  });
});

describe("exhaustion", () => {
  it("returns NOT_CACHED once every ranked stream failed, leaking nothing", async () => {
    const { resolveCalls } = stubPipeline({
      streams: [
        movieStream("s404", 300),
        movieStream("s500", 200),
        movieStream("netfail", 50),
      ],
      resolves: {
        s404: { status: 404 },
        s500: { status: 500 },
        netfail: "network-error",
      },
    });

    const result = await resolveStream(nextMovieTarget());

    expect(result).toEqual({ ok: false, code: "NOT_CACHED" });
    expect(resolveCalls).toEqual(["s404", "s500", "netfail"]);
    // The network error's message embedded the resolve url - the log line
    // built from it must arrive scrubbed.
    const consoleText = allConsoleText();
    expect(consoleText).toContain("resolve fetch failed");
    expect(consoleText).not.toContain(TEST_KEY);
    expect(consoleText).not.toContain(TEST_CONFIG);
  });
});

describe("Torrentio failures pass through", () => {
  it("maps an empty stream list to NOT_FOUND", async () => {
    stubPipeline({ streams: [] });
    const result = await resolveStream(nextMovieTarget());
    expect(result).toEqual({ ok: false, code: "NOT_FOUND" });
  });

  it("maps a Torrentio outage to PROVIDER_DOWN", async () => {
    stubPipeline({ streams: [], listingStatus: 503 });
    const result = await resolveStream(nextMovieTarget());
    expect(result).toEqual({ ok: false, code: "PROVIDER_DOWN" });
  });

  it("maps a missing TORRENTIO_CONFIG to PROVIDER_DOWN without fetching", async () => {
    vi.stubEnv("TORRENTIO_CONFIG", "");
    const { fetchMock } = stubPipeline({ streams: [] });
    const result = await resolveStream(nextMovieTarget());
    expect(result).toEqual({ ok: false, code: "PROVIDER_DOWN" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns NOT_CACHED with no resolve fetch when nothing survives the picker", async () => {
    const { fetchMock, resolveCalls } = stubPipeline({
      streams: [
        {
          url: resolveUrlFor("junk1"),
          title: "Movie.2024.CAM.x264\n👤 5 💾 1.00 GB ⚙️ TG",
          name: "[RD+] Torrentio\nCAM",
        },
      ],
    });

    const result = await resolveStream(nextMovieTarget());

    expect(result).toEqual({ ok: false, code: "NOT_CACHED" });
    expect(resolveCalls).toEqual([]);
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});

describe("host suffix constant", () => {
  it("carries the leading dot the validation depends on", () => {
    expect(RESOLVED_HOST_SUFFIX.startsWith(".")).toBe(true);
    expect(RD_HOST.endsWith(RESOLVED_HOST_SUFFIX)).toBe(true);
  });
});
