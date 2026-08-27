import {
  discoverMoviesByGenre,
  discoverTvByGenre,
  getTrending,
  type DiscoverTvOptions,
  type TrendingScope,
} from "./endpoints";
import type { Title } from "./schemas";

// Curated browse rows. Re-curating is a config edit here - components never
// hardcode rows. Genre IDs are TMDB's stable taxonomy (tmdb.md §Genre IDs).
// Rows shared between pages (home reuses the TV/movie pages' strongest rows)
// are defined once below and composed per page.

export const MOVIE_GENRES = {
  comedy: 35,
  horror: 27,
  thriller: 53,
  family: 10751,
} as const;

export const TV_GENRES = {
  comedy: 35,
  drama: 18,
  crime: 80,
  animation: 16,
  news: 10763,
  talk: 10767,
  soap: 10766,
} as const;

export type RowFetchDescriptor =
  | { kind: "trending"; scope: TrendingScope }
  | { kind: "discover-movies"; genreIds: number[] }
  | { kind: "discover-tv"; genreIds: number[]; options?: DiscoverTvOptions };

export type BrowseRow = {
  key: string;
  label: string;
  fetch: RowFetchDescriptor;
};

const comedyMovies: BrowseRow = {
  key: "comedy-movies",
  label: "Comedy Movies",
  fetch: { kind: "discover-movies", genreIds: [MOVIE_GENRES.comedy] },
};

const horrorThrillers: BrowseRow = {
  // ⚠️ Movie-based on purpose: TMDB's TV taxonomy has no Horror genre
  // (tmdb.md §Genre IDs) - do not add a discover-tv variant with genre 27.
  key: "horror-thrillers",
  label: "Horror & Thrillers",
  fetch: {
    kind: "discover-movies",
    genreIds: [MOVIE_GENRES.horror, MOVIE_GENRES.thriller],
  },
};

const popularTv: BrowseRow = {
  // News/talk shows and non-English reality dominate raw TV popularity but
  // aren't what "Popular TV Shows" means here - both filtered out.
  key: "popular-tv",
  label: "Popular TV Shows",
  fetch: {
    kind: "discover-tv",
    genreIds: [],
    options: {
      withoutGenres: [TV_GENRES.news, TV_GENRES.talk],
      originalLanguage: "en",
    },
  },
};

const classicSitcoms: BrowseRow = {
  // Query choice: English-language TV Comedy that premiered 2005 or earlier,
  // minus animation (cartoons aren't sitcoms), ordered by all-time vote
  // count rather than current popularity - vote_count.desc surfaces the
  // enduringly loved classics (Friends, Seinfeld, Fresh Prince) instead of
  // whatever old show is spiking this week; the language filter keeps
  // high-vote telenovelas out of a sitcom row.
  key: "classic-sitcoms",
  label: "Classic Sitcoms",
  fetch: {
    kind: "discover-tv",
    genreIds: [TV_GENRES.comedy],
    options: {
      withoutGenres: [TV_GENRES.animation],
      firstAirDateLte: "2005-12-31",
      sortBy: "vote_count.desc",
      originalLanguage: "en",
    },
  },
};

export const browseRows: readonly BrowseRow[] = [
  // [slot] Continue Watching renders first, above Trending - personalized row
  // from watch_progress, rendered by the browse page (not a TMDB fetch, so no
  // entry here).
  {
    key: "trending",
    label: "Trending Now",
    fetch: { kind: "trending", scope: "all" },
  },
  comedyMovies,
  horrorThrillers,
  popularTv,
  classicSitcoms,
  // [slot] My List renders last - personalized row from Supabase my_list,
  // rendered by the browse page after these rows (not a TMDB fetch, so no
  // entry here).
];

// /tv - every row TV-scoped; first row also feeds the page's billboard.
export const tvRows: readonly BrowseRow[] = [
  {
    key: "trending-tv",
    label: "Trending TV",
    fetch: { kind: "trending", scope: "tv" },
  },
  popularTv,
  classicSitcoms,
  {
    // Popularity-sorted Drama is swamped by daily soaps (EastEnders-style,
    // hundreds of episodes) that aren't what a "TV Dramas" shelf should
    // mean - soap excluded; English filter keeps telenovelas/K-dramas out.
    key: "tv-dramas",
    label: "TV Dramas",
    fetch: {
      kind: "discover-tv",
      genreIds: [TV_GENRES.drama],
      options: {
        withoutGenres: [TV_GENRES.soap],
        originalLanguage: "en",
      },
    },
  },
  {
    // English filter for the same reason as Popular TV - this row means
    // English-language procedurals, not subtitled imports.
    key: "crime-tv",
    label: "Crime TV",
    fetch: {
      kind: "discover-tv",
      genreIds: [TV_GENRES.crime],
      options: { originalLanguage: "en" },
    },
  },
];

// /movies - every row movie-scoped; first row also feeds the page's billboard.
export const movieRows: readonly BrowseRow[] = [
  {
    key: "trending-movies",
    label: "Trending Movies",
    fetch: { kind: "trending", scope: "movie" },
  },
  comedyMovies,
  horrorThrillers,
  {
    // Family (10751) alone covers family-visit viewing; plain popularity
    // sort - family films chart globally, no language skew to fix.
    key: "family-movies",
    label: "Family Movies",
    fetch: { kind: "discover-movies", genreIds: [MOVIE_GENRES.family] },
  },
];

export function fetchRowTitles(row: BrowseRow): Promise<Title[]> {
  const descriptor = row.fetch;
  switch (descriptor.kind) {
    case "trending":
      return getTrending(descriptor.scope);
    case "discover-movies":
      return discoverMoviesByGenre(descriptor.genreIds);
    case "discover-tv":
      return discoverTvByGenre(descriptor.genreIds, descriptor.options);
  }
}
