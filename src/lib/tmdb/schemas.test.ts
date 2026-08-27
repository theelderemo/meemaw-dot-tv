import { afterEach, describe, expect, it, vi } from "vitest";
import {
  mixedSummarySchema,
  movieDetailsSchema,
  movieSummarySchema,
  parseList,
  resultsPageSchema,
  seasonSchema,
  tvDetailsSchema,
  tvSummarySchema,
} from "./schemas";
// Fixtures are real TMDB responses (captured Aug 2026) trimmed to the fields
// we parse. search-multi.json holds a person entry and a null-poster movie.
import discoverMovieFixture from "./__fixtures__/discover-movie.json";
import discoverTvFixture from "./__fixtures__/discover-tv.json";
import movieDetailsFixture from "./__fixtures__/movie-details.json";
import searchMultiFixture from "./__fixtures__/search-multi.json";
import seasonFixture from "./__fixtures__/season.json";
import trendingFixture from "./__fixtures__/trending.json";
import tvDetailsFixture from "./__fixtures__/tv-details.json";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("mixed summaries (trending/search shape)", () => {
  it("normalizes movie and TV items into one Title shape", () => {
    const page = resultsPageSchema.parse(trendingFixture);
    const titles = parseList(page.results, mixedSummarySchema, "test");

    expect(titles).toHaveLength(2);
    const [movie, tv] = titles;
    expect(movie.mediaType).toBe("movie");
    expect(movie.title).toBe("Spider-Man: Brand New Day");
    expect(movie.year).toBe(2026);
    expect(movie.releaseDate).toBe("2026-07-29");
    expect(movie.genreIds).toEqual([28, 12, 878]);
    const movieKeys = Object.keys(movie).sort();
    expect(Object.keys(tv).sort()).toEqual(movieKeys);
    expect(movieKeys).not.toEqual(expect.arrayContaining(["name"]));
    expect(tv.mediaType).toBe("tv");
    expect(tv.title).toBeTruthy();
    expect(tv.year).toBeGreaterThan(1900);
    expect(tv.releaseDate).toBe("2026-08-16");
  });

  it("drops person results and keeps null poster/backdrop as null", () => {
    const page = resultsPageSchema.parse(searchMultiFixture);
    const titles = parseList(page.results, mixedSummarySchema, "test");

    expect(titles).toHaveLength(2);
    expect(titles.every((t) => t.mediaType !== ("person" as string))).toBe(
      true,
    );

    const nullPosterTitle = titles.find((t) => t.mediaType === "movie");
    expect(nullPosterTitle?.posterPath).toBeNull();
    expect(nullPosterTitle?.backdropPath).toBeNull();

    const tv = titles.find((t) => t.mediaType === "tv");
    expect(tv?.posterPath).toMatch(/^\//);
  });
});

describe("discover summaries (no media_type field)", () => {
  it("parses movie results with the endpoint-implied mediaType", () => {
    const page = resultsPageSchema.parse(discoverMovieFixture);
    const titles = parseList(page.results, movieSummarySchema, "test");

    expect(titles).toHaveLength(3);
    for (const title of titles) {
      expect(title.mediaType).toBe("movie");
      expect(title.id).toBeGreaterThan(0);
      expect(title.rating).toBeGreaterThanOrEqual(0);
      expect(title.releaseDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it("parses TV results with the endpoint-implied mediaType", () => {
    const page = resultsPageSchema.parse(discoverTvFixture);
    const titles = parseList(page.results, tvSummarySchema, "test");

    expect(titles.map((t) => t.title)).toContain("Friends");
    expect(titles.every((t) => t.mediaType === "tv")).toBe(true);
  });
});

describe("details", () => {
  it("transforms movie details with runtime, imdbId, cast and recommendations", () => {
    const details = movieDetailsSchema.parse(movieDetailsFixture);

    expect(details.mediaType).toBe("movie");
    expect(details.runtimeMinutes).toBe(145);
    expect(details.releaseDate).toBe("2026-07-29");
    expect(details.certification).toBe("PG-13");
    expect(details.imdbId).toMatch(/^tt\d+$/);
    expect(details.genres.length).toBeGreaterThan(0);
    expect(typeof details.genres[0]).toBe("string");
    expect(details.cast[0]).toMatchObject({ name: "Tom Holland" });
    expect(
      details.cast[0].profilePath === null ||
        details.cast[0].profilePath.startsWith("/"),
    ).toBe(true);
    expect(details.recommendations.every((t) => t.mediaType === "movie")).toBe(
      true,
    );
  });

  it("transforms TV details with seasonCount and tv-flavored recommendations", () => {
    const details = tvDetailsSchema.parse(tvDetailsFixture);

    expect(details.mediaType).toBe("tv");
    expect(details.title).toBe("Friends");
    expect(details.releaseDate).toBe("1994-09-22");
    expect(details.seasonCount).toBe(10);
    expect(details.imdbId).toBe("tt0108778");
    expect(details.recommendations.every((t) => t.mediaType === "tv")).toBe(
      true,
    );
  });

  it("reads the first US content rating (TMDB double-lists some shows)", () => {
    // Fixture holds both real US entries: TV-14 first, then TV-PG.
    const details = tvDetailsSchema.parse(tvDetailsFixture);

    expect(details.certification).toBe("TV-14");
  });

  it("maps missing, non-US or empty certifications to null", () => {
    const movieWithoutAppend = {
      ...movieDetailsFixture,
      release_dates: undefined,
    };
    expect(
      movieDetailsSchema.parse(movieWithoutAppend).certification,
    ).toBeNull();

    const noUs = movieDetailsSchema.parse({
      ...movieDetailsFixture,
      release_dates: {
        results: [
          { iso_3166_1: "GB", release_dates: [{ certification: "12A" }] },
        ],
      },
    });
    expect(noUs.certification).toBeNull();

    // Real pattern: festival/premiere US entries with certification "".
    const emptyUs = movieDetailsSchema.parse({
      ...movieDetailsFixture,
      release_dates: {
        results: [
          { iso_3166_1: "US", release_dates: [{ certification: "" }, {}] },
        ],
      },
    });
    expect(emptyUs.certification).toBeNull();

    const tvWithoutAppend = { ...tvDetailsFixture, content_ratings: undefined };
    expect(tvDetailsSchema.parse(tvWithoutAppend).certification).toBeNull();
  });

  it("lists aired seasons with Specials last and unaired seasons dropped", () => {
    const details = tvDetailsSchema.parse(tvDetailsFixture);

    expect(details.seasons.map((s) => s.seasonNumber)).toEqual([1, 2, 0]);
    expect(details.seasons[0]).toEqual({
      seasonNumber: 1,
      name: "Season 1",
      episodeCount: 24,
      airDate: "1994-09-22",
    });
    expect(details.seasons.at(-1)?.name).toBe("Specials");
  });

  it("keeps each season's opener air date, null when TMDB omits it", () => {
    const details = tvDetailsSchema.parse({
      ...tvDetailsFixture,
      seasons: [
        ...tvDetailsFixture.seasons,
        { season_number: 11, name: "Season 11", episode_count: 8 },
      ],
    });

    expect(
      details.seasons.map((season) => [season.seasonNumber, season.airDate]),
    ).toEqual([
      [1, "1994-09-22"],
      [2, "1995-09-21"],
      [11, null],
      [0, "2001-02-15"],
    ]);
  });
});

describe("season", () => {
  it("transforms episodes with numbers, stills and runtimes", () => {
    const season = seasonSchema.parse(seasonFixture);

    expect(season.seasonNumber).toBe(1);
    expect(season.episodes).toHaveLength(3);
    expect(season.episodes[0]).toMatchObject({
      episodeNumber: 1,
      name: "Pilot",
    });
    expect(season.episodes[0].runtimeMinutes).toBe(23);
  });

  it("keeps each episode's air date, null when TMDB has none", () => {
    const season = seasonSchema.parse(seasonFixture);
    expect(season.episodes.map((episode) => episode.airDate)).toEqual([
      "1994-09-22",
      "1994-09-29",
      "1994-10-06",
    ]);

    const [unaired] = seasonSchema.parse({
      ...seasonFixture,
      episodes: [{ ...seasonFixture.episodes[0], air_date: null }],
    }).episodes;
    expect(unaired.airDate).toBeNull();
  });
});

describe("transform edge cases (inline shapes)", () => {
  it("maps empty/missing dates to a null year and missing rating to 0", () => {
    const title = movieSummarySchema.parse({
      id: 1,
      title: "Obscure",
      release_date: "",
    });
    expect(title.year).toBeNull();
    expect(title.releaseDate).toBeNull();
    expect(title.rating).toBe(0);
    expect(title.overview).toBe("");
    expect(title.posterPath).toBeNull();
    expect(title.genreIds).toEqual([]);
  });

  it("only lets a well-formed calendar date through as releaseDate", () => {
    const parse = (release_date: string | undefined) =>
      movieSummarySchema.parse({ id: 1, title: "T", release_date });

    expect(parse(undefined).releaseDate).toBeNull();
    expect(parse("2026").releaseDate).toBeNull();
    expect(parse("2026-13-01").releaseDate).toBeNull();
    expect(parse("2026-10-03").releaseDate).toBe("2026-10-03");
    // A datetime variant (TMDB uses one inside release_dates) still reads as
    // its calendar date.
    expect(parse("2026-10-03T00:00:00.000Z").releaseDate).toBe("2026-10-03");
  });

  it("drops malformed list items instead of failing the whole list", () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const titles = parseList(
      [
        { id: "not-a-number" },
        { id: 2, title: "Kept", release_date: "1999-01-01" },
      ],
      movieSummarySchema,
      "test",
    );

    expect(titles).toHaveLength(1);
    expect(titles[0].year).toBe(1999);
    expect(consoleError).toHaveBeenCalledOnce();
  });
});
