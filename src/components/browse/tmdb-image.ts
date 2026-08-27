// TMDB image CDN (tmdb.md §Images) - public host, no auth, safe in client code.
const TMDB_IMAGE_BASE_URL = "https://image.tmdb.org/t/p";

// w300 is the largest episode-still size below original; w780 is the mid
// backdrop size (hover cards / similar cards).
export type TmdbImageSize =
  "w185" | "w300" | "w342" | "w500" | "w780" | "w1280" | "original";

export function tmdbImageUrl(size: TmdbImageSize, path: string): string {
  return `${TMDB_IMAGE_BASE_URL}/${size}${path}`;
}
