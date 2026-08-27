// TMDB's genre taxonomy is stable and documented as hardcodeable (tmdb.md
// §Genre IDs) - a static map avoids an extra fetch just to label hover cards.
// Movie and TV lists share ids wherever they share a name (Comedy is 35 in
// both), so one merged map covers summaries from every endpoint.
const GENRE_NAMES: Readonly<Record<number, string>> = {
  // Movie list
  28: "Action",
  12: "Adventure",
  16: "Animation",
  35: "Comedy",
  80: "Crime",
  99: "Documentary",
  18: "Drama",
  10751: "Family",
  14: "Fantasy",
  36: "History",
  27: "Horror",
  10402: "Music",
  9648: "Mystery",
  10749: "Romance",
  878: "Science Fiction",
  10770: "TV Movie",
  53: "Thriller",
  10752: "War",
  37: "Western",
  // TV-only additions
  10759: "Action & Adventure",
  10762: "Kids",
  10763: "News",
  10764: "Reality",
  10765: "Sci-Fi & Fantasy",
  10766: "Soap",
  10767: "Talk",
  10768: "War & Politics",
};

/** Maps TMDB genre ids to display names, silently dropping unknown ids. */
export function genreNames(genreIds: number[]): string[] {
  const names: string[] = [];
  for (const id of genreIds) {
    const name = GENRE_NAMES[id];
    if (name) names.push(name);
  }
  return names;
}
