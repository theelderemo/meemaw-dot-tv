import { describe, expect, it } from "vitest";
import {
  browseRows,
  movieRows,
  MOVIE_GENRES,
  tvRows,
  TV_GENRES,
  type BrowseRow,
} from "./rows";

function keysOf(rows: readonly BrowseRow[]): string[] {
  return rows.map((row) => row.key);
}

describe("browse row config", () => {
  it("holds the curated rows in config order", () => {
    expect(keysOf(browseRows)).toEqual([
      "trending",
      "comedy-movies",
      "horror-thrillers",
      "popular-tv",
      "classic-sitcoms",
    ]);
    expect(browseRows.map((row) => row.label)).toEqual([
      "Trending Now",
      "Comedy Movies",
      "Horror & Thrillers",
      "Popular TV Shows",
      "Classic Sitcoms",
    ]);
    expect(browseRows[0].fetch).toEqual({ kind: "trending", scope: "all" });
  });

  it("has unique keys and non-empty labels on every page's rows", () => {
    for (const rows of [browseRows, tvRows, movieRows]) {
      const keys = keysOf(rows);
      expect(new Set(keys).size).toBe(keys.length);
      for (const row of rows) {
        expect(row.label.trim()).not.toBe("");
      }
    }
  });

  it("keeps Horror & Thrillers movie-based (TMDB TV has no Horror genre)", () => {
    const horror = browseRows.find((row) => row.key === "horror-thrillers");
    expect(horror?.fetch).toEqual({
      kind: "discover-movies",
      genreIds: [MOVIE_GENRES.horror, MOVIE_GENRES.thriller],
    });

    for (const row of [...browseRows, ...tvRows, ...movieRows]) {
      if (row.fetch.kind === "discover-tv") {
        expect(row.fetch.genreIds).not.toContain(MOVIE_GENRES.horror);
      }
    }
  });

  it("filters Classic Sitcoms toward older popular English comedy", () => {
    const sitcoms = browseRows.find((row) => row.key === "classic-sitcoms");
    if (sitcoms?.fetch.kind !== "discover-tv") {
      throw new Error("classic-sitcoms must be a discover-tv row");
    }
    expect(sitcoms.fetch.genreIds).toEqual([TV_GENRES.comedy]);
    expect(sitcoms.fetch.options?.firstAirDateLte).toMatch(
      /^\d{4}-\d{2}-\d{2}$/,
    );
    expect(sitcoms.fetch.options?.sortBy).toBe("vote_count.desc");
    expect(sitcoms.fetch.options?.withoutGenres).toContain(TV_GENRES.animation);
  });
});

describe("tv page rows", () => {
  it("opens with TV-scoped trending (feeds the /tv billboard)", () => {
    expect(tvRows[0].fetch).toEqual({ kind: "trending", scope: "tv" });
  });

  it("keeps every row TV-flavored - no movie discovers", () => {
    expect(tvRows.some((row) => row.fetch.kind === "discover-movies")).toBe(
      false,
    );
  });

  it("curates dramas and crime rows: English-only, dramas minus soaps", () => {
    const dramas = tvRows.find((row) => row.key === "tv-dramas");
    if (dramas?.fetch.kind !== "discover-tv") {
      throw new Error("tv-dramas must be a discover-tv row");
    }
    expect(dramas.fetch.genreIds).toEqual([TV_GENRES.drama]);
    expect(dramas.fetch.options?.withoutGenres).toContain(TV_GENRES.soap);
    expect(dramas.fetch.options?.originalLanguage).toBe("en");

    const crime = tvRows.find((row) => row.key === "crime-tv");
    if (crime?.fetch.kind !== "discover-tv") {
      throw new Error("crime-tv must be a discover-tv row");
    }
    expect(crime.fetch.genreIds).toEqual([TV_GENRES.crime]);
    expect(crime.fetch.options?.originalLanguage).toBe("en");
  });
});

describe("movies page rows", () => {
  it("opens with movie-scoped trending (feeds the /movies billboard)", () => {
    expect(movieRows[0].fetch).toEqual({ kind: "trending", scope: "movie" });
  });

  it("keeps every row movie-flavored - no TV discovers", () => {
    expect(movieRows.some((row) => row.fetch.kind === "discover-tv")).toBe(
      false,
    );
  });

  it("includes a Family row on TMDB's Family genre", () => {
    const family = movieRows.find((row) => row.key === "family-movies");
    expect(family?.fetch).toEqual({
      kind: "discover-movies",
      genreIds: [MOVIE_GENRES.family],
    });
  });
});
