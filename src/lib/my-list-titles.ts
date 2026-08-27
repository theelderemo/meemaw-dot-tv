import type { MyListEntry } from "@/lib/db/my-list";
import { getMovieDetails, getTvDetails } from "@/lib/tmdb/endpoints";
import type { Title } from "@/lib/tmdb/schemas";

// Shared by the browse My List row and the /my-list grid: list rows resolved
// into displayable titles through the same 24h-cached detail fetchers the
// modal uses, preserving the entries' newest-first order. A title whose fetch
// fails is dropped with a log - one bad TMDB id never sinks the page.
export async function resolveMyListTitles(
  entries: MyListEntry[],
): Promise<Title[]> {
  const settled = await Promise.allSettled(
    entries.map((entry) =>
      entry.mediaType === "movie"
        ? getMovieDetails(entry.tmdbId)
        : getTvDetails(entry.tmdbId),
    ),
  );

  const titles: Title[] = [];
  settled.forEach((result, index) => {
    const { mediaType, tmdbId } = entries[index];
    if (result.status === "fulfilled") {
      titles.push(result.value);
    } else {
      console.error(
        `[my-list] dropping ${mediaType}/${tmdbId}: details fetch failed`,
        result.reason,
      );
    }
  });
  return titles;
}
