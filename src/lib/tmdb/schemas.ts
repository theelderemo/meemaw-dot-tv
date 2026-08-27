import { z } from "zod";

// Boundary module (coding-standards §5): raw TMDB shapes are parsed and
// transformed into OUR types here. The movie/TV field split (title/release_date
// vs name/first_air_date) never leaks past this file.

export type MediaType = "movie" | "tv";

export type Title = {
  id: number;
  mediaType: MediaType;
  title: string;
  overview: string;
  posterPath: string | null;
  backdropPath: string | null;
  year: number | null;
  /** ISO YYYY-MM-DD release (movie) / first air (TV) date; null when TMDB has
   * none. Gates Play (release.ts) - never look for a file to decide that. */
  releaseDate: string | null;
  rating: number;
  /** TMDB genre ids as sent on summary results; map to names via genres.ts. */
  genreIds: number[];
};

export type CastMember = {
  id: number;
  name: string;
  character: string;
  profilePath: string | null;
};

type TitleDetailsBase = Omit<Title, "mediaType"> & {
  genres: string[];
  imdbId: string | null;
  /** US maturity rating (e.g. "PG-13", "TV-MA"); null when TMDB has none. */
  certification: string | null;
  cast: CastMember[];
  /** TMDB `recommendations` (behavior-based, what its site shows) - the
   * modal's More Like This. Never `similar`: keyword-matched junk (tmdb.md). */
  recommendations: Title[];
};

export type MovieDetails = TitleDetailsBase & {
  mediaType: "movie";
  runtimeMinutes: number | null;
};

export type SeasonSummary = {
  seasonNumber: number;
  name: string;
  episodeCount: number;
  /** The season opener's air date (ISO YYYY-MM-DD); null when unknown. */
  airDate: string | null;
};

export type TvDetails = TitleDetailsBase & {
  mediaType: "tv";
  seasonCount: number;
  /** Aired seasons for the modal's selector; Specials (season 0) listed last. */
  seasons: SeasonSummary[];
};

export type TitleDetails = MovieDetails | TvDetails;

export type Episode = {
  id: number;
  episodeNumber: number;
  name: string;
  overview: string;
  stillPath: string | null;
  runtimeMinutes: number | null;
  /** ISO YYYY-MM-DD; null when TMDB has none (counts as aired). */
  airDate: string | null;
};

export type Season = {
  id: number;
  seasonNumber: number;
  name: string;
  episodes: Episode[];
};

// TMDB's top-level dates are "YYYY-MM-DD" or "" when unknown. Only a
// well-formed calendar date crosses the boundary - release.ts compares and
// formats these strings without Date math, so this shape is its contract.
const ISO_DATE_PREFIX = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])/;

function isoDateFrom(raw: string | null | undefined): string | null {
  return raw && ISO_DATE_PREFIX.test(raw) ? raw.slice(0, 10) : null;
}

function yearFrom(date: string | null): number | null {
  if (!date) return null;
  const year = Number(date.slice(0, 4));
  return year > 1800 ? year : null;
}

// Obscure titles routinely miss poster/backdrop/overview/date - every field
// except id and the display name is lenient, normalized to our nulls/defaults.
const rawMovieFields = {
  id: z.number(),
  title: z.string(),
  overview: z.string().nullish(),
  poster_path: z.string().nullish(),
  backdrop_path: z.string().nullish(),
  release_date: z.string().nullish(),
  vote_average: z.number().nullish(),
  genre_ids: z.array(z.number()).nullish(),
};

const rawTvFields = {
  id: z.number(),
  name: z.string(),
  overview: z.string().nullish(),
  poster_path: z.string().nullish(),
  backdrop_path: z.string().nullish(),
  first_air_date: z.string().nullish(),
  vote_average: z.number().nullish(),
  genre_ids: z.array(z.number()).nullish(),
};

type RawMovieSummary = z.infer<z.ZodObject<typeof rawMovieFields>>;
type RawTvSummary = z.infer<z.ZodObject<typeof rawTvFields>>;

function toMovieTitle(raw: RawMovieSummary): Title {
  const releaseDate = isoDateFrom(raw.release_date);
  return {
    id: raw.id,
    mediaType: "movie",
    title: raw.title,
    overview: raw.overview ?? "",
    posterPath: raw.poster_path ?? null,
    backdropPath: raw.backdrop_path ?? null,
    year: yearFrom(releaseDate),
    releaseDate,
    rating: raw.vote_average ?? 0,
    genreIds: raw.genre_ids ?? [],
  };
}

function toTvTitle(raw: RawTvSummary): Title {
  const releaseDate = isoDateFrom(raw.first_air_date);
  return {
    id: raw.id,
    mediaType: "tv",
    title: raw.name,
    overview: raw.overview ?? "",
    posterPath: raw.poster_path ?? null,
    backdropPath: raw.backdrop_path ?? null,
    year: yearFrom(releaseDate),
    releaseDate,
    rating: raw.vote_average ?? 0,
    genreIds: raw.genre_ids ?? [],
  };
}

// Discover results carry no media_type - the endpoint implies it.
export const movieSummarySchema = z
  .object(rawMovieFields)
  .transform(toMovieTitle);
export const tvSummarySchema = z.object(rawTvFields).transform(toTvTitle);

// Trending/search items carry media_type and may be a person (dropped -> null).
export const mixedSummarySchema = z.union([
  z
    .object({ ...rawMovieFields, media_type: z.literal("movie") })
    .transform(toMovieTitle),
  z
    .object({ ...rawTvFields, media_type: z.literal("tv") })
    .transform(toTvTitle),
  z.object({ media_type: z.literal("person") }).transform(() => null),
]);

export const resultsPageSchema = z.object({ results: z.array(z.unknown()) });

// Parses list items one by one so a single malformed TMDB result is dropped
// (with a server log) instead of blanking a whole row or modal.
export function parseList<T>(
  items: unknown[],
  schema: z.ZodType<T>,
  context: string,
): NonNullable<T>[] {
  const parsed: NonNullable<T>[] = [];
  let dropped = 0;
  for (const item of items) {
    const result = schema.safeParse(item);
    if (!result.success) {
      dropped += 1;
      continue;
    }
    if (result.data != null) parsed.push(result.data);
  }
  if (dropped > 0) {
    console.error(
      `[tmdb] dropped ${dropped} malformed result(s) from ${context}`,
    );
  }
  return parsed;
}

const rawGenreSchema = z.object({ name: z.string() });

export const castMemberSchema = z
  .object({
    id: z.number(),
    name: z.string(),
    character: z.string().nullish(),
    profile_path: z.string().nullish(),
  })
  .transform((raw): CastMember => ({
    id: raw.id,
    name: raw.name,
    character: raw.character ?? "",
    profilePath: raw.profile_path ?? null,
  }));

const TOP_CAST_COUNT = 10;

const rawExternalIdsSchema = z.object({ imdb_id: z.string().nullish() });

export const externalIdsSchema = rawExternalIdsSchema.transform((raw) => ({
  imdbId: raw.imdb_id ?? null,
}));

// Maturity ratings ride the detail appends: movies carry per-country
// release_dates, TV a flat content_ratings list. Both normalize to the US
// certification string or null (honest data only - no fake chips).
// Lenient (.nullish() at the use sites) like every non-id field: a missing or
// odd-shaped append degrades to null, never fails the whole detail parse.
const rawReleaseDatesSchema = z.object({
  results: z.array(
    z.object({
      iso_3166_1: z.string(),
      release_dates: z.array(z.object({ certification: z.string().nullish() })),
    }),
  ),
});

function usMovieCertification(
  raw: z.infer<typeof rawReleaseDatesSchema> | null | undefined,
): string | null {
  const us = raw?.results.find((entry) => entry.iso_3166_1 === "US");
  const certified = us?.release_dates.find(
    (release) => (release.certification ?? "").trim() !== "",
  );
  return certified?.certification?.trim() ?? null;
}

const rawContentRatingsSchema = z.object({
  results: z.array(
    z.object({ iso_3166_1: z.string(), rating: z.string().nullish() }),
  ),
});

// TMDB lists some shows under US twice (e.g. TV-14 and TV-PG) - first wins.
function usTvCertification(
  raw: z.infer<typeof rawContentRatingsSchema> | null | undefined,
): string | null {
  const us = raw?.results.find(
    (entry) => entry.iso_3166_1 === "US" && (entry.rating ?? "").trim() !== "",
  );
  return us?.rating?.trim() ?? null;
}

// Shape shared by both detail responses with append_to_response=
// external_ids,credits,recommendations,videos. `videos` rides along per tmdb.md's
// one-call rule but isn't consumed yet; zod strips unparsed keys.
const rawDetailAppends = {
  genres: z.array(rawGenreSchema),
  external_ids: rawExternalIdsSchema,
  credits: z.object({ cast: z.array(z.unknown()) }),
  recommendations: z.object({ results: z.array(z.unknown()) }),
};

type RawDetailAppends = z.infer<z.ZodObject<typeof rawDetailAppends>>;

function toDetailsBase(
  raw: RawDetailAppends,
  summarySchema: z.ZodType<Title>,
  context: string,
): Pick<TitleDetailsBase, "genres" | "imdbId" | "cast" | "recommendations"> {
  return {
    genres: raw.genres.map((genre) => genre.name),
    imdbId: raw.external_ids.imdb_id ?? null,
    cast: parseList(
      raw.credits.cast.slice(0, TOP_CAST_COUNT),
      castMemberSchema,
      `${context} credits`,
    ),
    recommendations: parseList(
      raw.recommendations.results,
      summarySchema,
      `${context} recommendations`,
    ),
  };
}

export const movieDetailsSchema = z
  .object({
    ...rawMovieFields,
    ...rawDetailAppends,
    runtime: z.number().nullish(),
    release_dates: rawReleaseDatesSchema.nullish(),
  })
  .transform((raw): MovieDetails => ({
    ...toMovieTitle(raw),
    mediaType: "movie",
    ...toDetailsBase(raw, movieSummarySchema, "movie details"),
    certification: usMovieCertification(raw.release_dates),
    runtimeMinutes: raw.runtime ?? null,
  }));

const rawSeasonSummarySchema = z.object({
  season_number: z.number(),
  name: z.string(),
  episode_count: z.number().nullish(),
  air_date: z.string().nullish(),
});

type RawSeasonSummary = z.infer<typeof rawSeasonSummarySchema>;

// Selector data for the detail modal: skip empty seasons, keep TMDB's
// "Specials" (season 0) but list it after the regular seasons, as viewers expect.
// An announced season whose episodes are listed but unaired stays - its rows
// and the next-episode rollover are gated by air date (release.ts).
function toSeasonSummaries(raw: RawSeasonSummary[]): SeasonSummary[] {
  return raw
    .filter((season) => (season.episode_count ?? 0) > 0)
    .map((season) => ({
      seasonNumber: season.season_number,
      name: season.name,
      episodeCount: season.episode_count ?? 0,
      airDate: isoDateFrom(season.air_date),
    }))
    .sort((a, b) => {
      if (a.seasonNumber === 0) return 1;
      if (b.seasonNumber === 0) return -1;
      return a.seasonNumber - b.seasonNumber;
    });
}

export const tvDetailsSchema = z
  .object({
    ...rawTvFields,
    ...rawDetailAppends,
    number_of_seasons: z.number().nullish(),
    seasons: z.array(rawSeasonSummarySchema).nullish(),
    content_ratings: rawContentRatingsSchema.nullish(),
  })
  .transform((raw): TvDetails => ({
    ...toTvTitle(raw),
    mediaType: "tv",
    ...toDetailsBase(raw, tvSummarySchema, "tv details"),
    certification: usTvCertification(raw.content_ratings),
    seasonCount: raw.number_of_seasons ?? 0,
    seasons: toSeasonSummaries(raw.seasons ?? []),
  }));

const rawEpisodeSchema = z.object({
  id: z.number(),
  episode_number: z.number(),
  name: z.string(),
  overview: z.string().nullish(),
  still_path: z.string().nullish(),
  runtime: z.number().nullish(),
  air_date: z.string().nullish(),
});

export const seasonSchema = z
  .object({
    id: z.number(),
    season_number: z.number(),
    name: z.string(),
    episodes: z.array(rawEpisodeSchema),
  })
  .transform((raw): Season => ({
    id: raw.id,
    seasonNumber: raw.season_number,
    name: raw.name,
    episodes: raw.episodes.map((episode) => ({
      id: episode.id,
      episodeNumber: episode.episode_number,
      name: episode.name,
      overview: episode.overview ?? "",
      stillPath: episode.still_path ?? null,
      runtimeMinutes: episode.runtime ?? null,
      airDate: isoDateFrom(episode.air_date),
    })),
  }));
