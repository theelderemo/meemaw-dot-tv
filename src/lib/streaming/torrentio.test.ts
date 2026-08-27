import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  configuredStreamUrl,
  fetchTorrentioStreams,
  parseStreams,
  scrubStreamingSecrets,
  streamPath,
  TORRENTIO_BASE_URL,
  TorrentioError,
} from "./torrentio";
import { asConfiguredStreams } from "./__fixtures__/as-configured";
import duneFixture from "./__fixtures__/movie-dune-part-two.json";
import matrixFixture from "./__fixtures__/movie-the-matrix.json";
import tlouFixture from "./__fixtures__/series-the-last-of-us-s01e03.json";
import friendsFixture from "./__fixtures__/series-friends-s05e14.json";

// Test-only sentinel secret - asserted ABSENT from every error message.
const TEST_KEY = "TESTKEY-SENTINEL-3f9a";
const TEST_CONFIG = `qualityfilter=cam,unknown|realdebrid=${TEST_KEY}`;

beforeEach(() => {
  vi.stubEnv("TORRENTIO_CONFIG", TEST_CONFIG);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("configured URL construction", () => {
  it("builds config-free paths for movies and series", () => {
    expect(streamPath({ type: "movie", imdbId: "tt0133093" })).toBe(
      "/stream/movie/tt0133093.json",
    );
    expect(
      streamPath({
        type: "series",
        imdbId: "tt0108778",
        season: 5,
        episode: 14,
      }),
    ).toBe("/stream/series/tt0108778:5:14.json");
  });

  it("mounts the config segment between host and stream path", () => {
    expect(
      configuredStreamUrl(TEST_CONFIG, { type: "movie", imdbId: "tt0133093" }),
    ).toBe(`${TORRENTIO_BASE_URL}/${TEST_CONFIG}/stream/movie/tt0133093.json`);
    expect(
      configuredStreamUrl(TEST_CONFIG, {
        type: "series",
        imdbId: "tt0108778",
        season: 5,
        episode: 14,
      }),
    ).toBe(
      `${TORRENTIO_BASE_URL}/${TEST_CONFIG}/stream/series/tt0108778:5:14.json`,
    );
  });
});

describe("secret scrubbing", () => {
  it("removes the config string and the bare key from text", () => {
    const scrubbed = scrubStreamingSecrets(
      `url https://torrentio.strem.fun/${TEST_CONFIG}/stream/movie/tt1.json ` +
        `and resolver /resolve/realdebrid/${TEST_KEY}/abcd`,
    );
    expect(scrubbed).not.toContain(TEST_KEY);
    expect(scrubbed).not.toContain(TEST_CONFIG);
    expect(scrubbed).toContain("[redacted]");
  });

  it("scrubs every TorrentioError message at construction", () => {
    const poisoned = new TorrentioError(
      "PROVIDER_DOWN",
      `fetch failed for ${configuredStreamUrl(TEST_CONFIG, {
        type: "movie",
        imdbId: "tt1",
      })} with key ${TEST_KEY}`,
    );
    expect(poisoned.message).not.toContain(TEST_KEY);
    expect(poisoned.message).not.toContain(TEST_CONFIG);
    expect(poisoned.message).toContain("[redacted]");
  });
});

describe("boundary schema against captured fixtures (configured shape)", () => {
  it("parses every adapted stream without drops", () => {
    for (const [name, fixture] of [
      ["dune", duneFixture],
      ["matrix", matrixFixture],
      ["tlou", tlouFixture],
      ["friends", friendsFixture],
    ] as const) {
      const adapted = asConfiguredStreams(fixture.streams);
      expect(parseStreams(adapted, name)).toHaveLength(adapted.length);
    }
  });

  it("keeps url and defaults missing name/title to empty strings", () => {
    const streams = parseStreams(
      [{ url: "https://torrentio.example/fake-resolve/abc/0" }],
      "test",
    );
    expect(streams).toEqual([
      {
        url: "https://torrentio.example/fake-resolve/abc/0",
        name: "",
        title: "",
      },
    ]);
  });

  it("drops entries without a url but keeps the rest", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const streams = parseStreams(
      [
        {
          url: "https://torrentio.example/fake-resolve/abc/0",
          title: "x",
          name: "y",
        },
        { infoHash: "plain-endpoint-entry", title: "no url" },
        42,
      ],
      "test",
    );
    expect(streams).toEqual([
      {
        url: "https://torrentio.example/fake-resolve/abc/0",
        name: "y",
        title: "x",
      },
    ]);
    expect(errorSpy).toHaveBeenCalledOnce();
    errorSpy.mockRestore();
  });
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// Each test uses its own imdbId - the module-level 15-minute cache is shared
// across tests by design (it is exactly what the cache test relies on).
describe("fetchTorrentioStreams", () => {
  it("fetches the configured URL and serves repeats from the cache", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        jsonResponse({ streams: asConfiguredStreams(duneFixture.streams) }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const first = await fetchTorrentioStreams({
      type: "movie",
      imdbId: "tt9000001",
    });
    const second = await fetchTorrentioStreams({
      type: "movie",
      imdbId: "tt9000001",
    });

    expect(first).toHaveLength(duneFixture.streams.length);
    expect(second).toEqual(first);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      configuredStreamUrl(TEST_CONFIG, { type: "movie", imdbId: "tt9000001" }),
    );
  });

  it("throws PROVIDER_DOWN without fetching when TORRENTIO_CONFIG is unset", async () => {
    vi.stubEnv("TORRENTIO_CONFIG", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      fetchTorrentioStreams({ type: "movie", imdbId: "tt9000006" }),
    ).rejects.toMatchObject({
      code: "PROVIDER_DOWN",
      message: expect.stringContaining("TORRENTIO_CONFIG"),
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("throws NOT_FOUND on an empty stream list and caches that too", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ streams: [] }));
    vi.stubGlobal("fetch", fetchMock);
    const target = {
      type: "series",
      imdbId: "tt9000002",
      season: 1,
      episode: 1,
    } as const;

    await expect(fetchTorrentioStreams(target)).rejects.toMatchObject({
      name: "TorrentioError",
      code: "NOT_FOUND",
    });
    await expect(fetchTorrentioStreams(target)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("throws PROVIDER_DOWN on 5xx responses", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ error: "boom" }, 503)),
    );

    await expect(
      fetchTorrentioStreams({ type: "movie", imdbId: "tt9000003" }),
    ).rejects.toMatchObject({ code: "PROVIDER_DOWN", status: 503 });
  });

  it("throws PROVIDER_DOWN when the network fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new TypeError("fetch failed")),
    );

    const failure = fetchTorrentioStreams({
      type: "movie",
      imdbId: "tt9000004",
    });
    await expect(failure).rejects.toBeInstanceOf(TorrentioError);
    await expect(failure).rejects.toMatchObject({ code: "PROVIDER_DOWN" });
  });

  it("throws PROVIDER_DOWN on a non-JSON body", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("<html>down</html>")),
    );

    await expect(
      fetchTorrentioStreams({ type: "movie", imdbId: "tt9000005" }),
    ).rejects.toMatchObject({ code: "PROVIDER_DOWN" });
  });

  it("never carries the config or key in a thrown error's message", async () => {
    const scenarios: Array<() => unknown> = [
      () => jsonResponse({ error: "boom" }, 503),
      () => jsonResponse({ streams: [] }),
      () => new Response("<html>down</html>"),
      () => jsonResponse({ unexpected: true }),
    ];
    let imdbCounter = 9000100;
    for (const respond of scenarios) {
      imdbCounter += 1;
      vi.stubGlobal(
        "fetch",
        vi.fn().mockImplementation(async () => respond()),
      );
      const error = await fetchTorrentioStreams({
        type: "movie",
        imdbId: `tt${imdbCounter}`,
      }).then(
        () => null,
        (thrown: unknown) => thrown,
      );
      expect(error).toBeInstanceOf(TorrentioError);
      const message = (error as TorrentioError).message;
      expect(message).not.toContain(TEST_KEY);
      expect(message).not.toContain(TEST_CONFIG);
    }
  });
});
