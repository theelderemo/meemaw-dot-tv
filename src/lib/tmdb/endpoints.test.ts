import { beforeEach, describe, expect, it, vi } from "vitest";
import { tmdbFetch } from "./client";
import { getMovieDetails, getTrending, getTvDetails } from "./endpoints";
import movieDetailsFixture from "./__fixtures__/movie-details.json";
import trendingFixture from "./__fixtures__/trending.json";
import trendingTvFixture from "./__fixtures__/trending-tv.json";
import tvDetailsFixture from "./__fixtures__/tv-details.json";

// Path/param assembly is the logic under test - the HTTP layer is mocked, the
// responses are the real captured fixtures.
vi.mock("./client", () => ({ tmdbFetch: vi.fn() }));
const tmdbFetchMock = vi.mocked(tmdbFetch);

beforeEach(() => {
  tmdbFetchMock.mockReset();
});

describe("getTrending scope", () => {
  it("defaults to the mixed all/week feed", async () => {
    tmdbFetchMock.mockResolvedValue(trendingFixture);
    const titles = await getTrending();

    expect(tmdbFetchMock).toHaveBeenCalledWith(
      "/trending/all/week",
      expect.objectContaining({ revalidate: 3_600 }),
    );
    expect(titles.map((t) => t.mediaType)).toEqual(["movie", "tv"]);
  });

  it("scopes to /trending/tv/week and still parses media_type-carrying results", async () => {
    tmdbFetchMock.mockResolvedValue(trendingTvFixture);
    const titles = await getTrending("tv");

    expect(tmdbFetchMock).toHaveBeenCalledWith(
      "/trending/tv/week",
      expect.objectContaining({ revalidate: 3_600 }),
    );
    expect(titles.length).toBeGreaterThan(0);
    expect(titles.every((t) => t.mediaType === "tv")).toBe(true);
  });

  it("scopes to /trending/movie/week", async () => {
    tmdbFetchMock.mockResolvedValue({ results: [] });
    await getTrending("movie");

    expect(tmdbFetchMock).toHaveBeenCalledWith(
      "/trending/movie/week",
      expect.objectContaining({ revalidate: 3_600 }),
    );
  });
});

describe("detail appends", () => {
  it("requests release_dates with movie details (maturity chip data)", async () => {
    tmdbFetchMock.mockResolvedValue(movieDetailsFixture);
    const details = await getMovieDetails(969681);

    expect(tmdbFetchMock).toHaveBeenCalledWith(
      "/movie/969681",
      expect.objectContaining({
        searchParams: {
          append_to_response:
            "external_ids,credits,recommendations,videos,release_dates",
        },
      }),
    );
    expect(details.certification).toBe("PG-13");
  });

  it("requests content_ratings with TV details", async () => {
    tmdbFetchMock.mockResolvedValue(tvDetailsFixture);
    const details = await getTvDetails(1668);

    expect(tmdbFetchMock).toHaveBeenCalledWith(
      "/tv/1668",
      expect.objectContaining({
        searchParams: {
          append_to_response:
            "external_ids,credits,recommendations,videos,content_ratings",
        },
      }),
    );
    expect(details.certification).toBe("TV-14");
  });
});
