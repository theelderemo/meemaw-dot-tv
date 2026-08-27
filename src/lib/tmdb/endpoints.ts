import { tmdbFetch } from "./client";
import {
  externalIdsSchema,
  mixedSummarySchema,
  movieDetailsSchema,
  movieSummarySchema,
  parseList,
  resultsPageSchema,
  seasonSchema,
  tvDetailsSchema,
  tvSummarySchema,
  type MediaType,
  type MovieDetails,
  type Season,
  type Title,
  type TvDetails,
} from "./schemas";

// Cache windows in seconds, per tmdb.md §Rate limits & caching.
const REVALIDATE = {
  trending: 3_600,
  discover: 86_400,
  details: 86_400,
  season: 86_400,
  externalIds: 30 * 86_400,
  search: 0, // no-store
} as const;

// TMDB multi-value separators: pipe = OR, comma = AND. Rows want OR - e.g.
// Horror & Thrillers is "genre 27 OR 53", and excluding several genres means
// "NOT (a OR b)". Comma would demand every listed genre at once.
function genreParam(genreIds: number[]): string | undefined {
  return genreIds.length > 0 ? genreIds.join("|") : undefined;
}

// Maturity data rides the one detail call (tmdb.md's append rule): movies
// certify per release entry, TV per country rating. Related titles come from
// `recommendations` - what TMDB's own site shows - never `similar`, whose
// keyword matching put The Godfather Part III under Insidious (tmdb.md).
const MOVIE_DETAIL_APPENDS =
  "external_ids,credits,recommendations,videos,release_dates";
const TV_DETAIL_APPENDS =
  "external_ids,credits,recommendations,videos,content_ratings";

export type TrendingScope = "all" | "movie" | "tv";

// Scoped results still carry media_type (verified Aug 2026), so one mixed
// schema covers all three scopes.
export async function getTrending(
  scope: TrendingScope = "all",
): Promise<Title[]> {
  const path = `/trending/${scope}/week`;
  const data = await tmdbFetch(path, {
    revalidate: REVALIDATE.trending,
  });
  const page = resultsPageSchema.parse(data);
  return parseList(page.results, mixedSummarySchema, path);
}

export async function discoverMoviesByGenre(
  genreIds: number[],
): Promise<Title[]> {
  const data = await tmdbFetch("/discover/movie", {
    searchParams: {
      with_genres: genreParam(genreIds),
      sort_by: "popularity.desc",
    },
    revalidate: REVALIDATE.discover,
  });
  const page = resultsPageSchema.parse(data);
  return parseList(page.results, movieSummarySchema, "/discover/movie");
}

export type DiscoverTvOptions = {
  sortBy?: "popularity.desc" | "vote_count.desc";
  /** Only shows first aired on or before this date (YYYY-MM-DD). */
  firstAirDateLte?: string;
  withoutGenres?: number[];
  /** ISO 639-1 code, e.g. "en". */
  originalLanguage?: string;
};

export async function discoverTvByGenre(
  genreIds: number[],
  options: DiscoverTvOptions = {},
): Promise<Title[]> {
  const data = await tmdbFetch("/discover/tv", {
    searchParams: {
      with_genres: genreParam(genreIds),
      without_genres: options.withoutGenres
        ? genreParam(options.withoutGenres)
        : undefined,
      "first_air_date.lte": options.firstAirDateLte,
      with_original_language: options.originalLanguage,
      sort_by: options.sortBy ?? "popularity.desc",
    },
    revalidate: REVALIDATE.discover,
  });
  const page = resultsPageSchema.parse(data);
  return parseList(page.results, tvSummarySchema, "/discover/tv");
}

export async function getMovieDetails(movieId: number): Promise<MovieDetails> {
  const data = await tmdbFetch(`/movie/${movieId}`, {
    searchParams: { append_to_response: MOVIE_DETAIL_APPENDS },
    revalidate: REVALIDATE.details,
  });
  return movieDetailsSchema.parse(data);
}

export async function getTvDetails(tvId: number): Promise<TvDetails> {
  const data = await tmdbFetch(`/tv/${tvId}`, {
    searchParams: { append_to_response: TV_DETAIL_APPENDS },
    revalidate: REVALIDATE.details,
  });
  return tvDetailsSchema.parse(data);
}

export async function getSeason(
  tvId: number,
  seasonNumber: number,
): Promise<Season> {
  const data = await tmdbFetch(`/tv/${tvId}/season/${seasonNumber}`, {
    revalidate: REVALIDATE.season,
  });
  return seasonSchema.parse(data);
}

export async function searchMulti(query: string): Promise<Title[]> {
  const trimmed = query.trim();
  if (trimmed === "") return [];

  const data = await tmdbFetch("/search/multi", {
    searchParams: { query: trimmed },
    revalidate: REVALIDATE.search,
  });
  const page = resultsPageSchema.parse(data);
  // mixedSummarySchema maps media_type "person" to null; parseList drops them.
  return parseList(page.results, mixedSummarySchema, "/search/multi");
}

export async function getExternalIds(
  mediaType: MediaType,
  id: number,
): Promise<{ imdbId: string | null }> {
  const data = await tmdbFetch(`/${mediaType}/${id}/external_ids`, {
    revalidate: REVALIDATE.externalIds,
  });
  return externalIdsSchema.parse(data);
}
