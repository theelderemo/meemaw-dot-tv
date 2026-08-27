import BrowseProviders from "@/components/browse/browse-providers";
import PosterGrid from "@/components/browse/poster-grid";
import type { PosterTitle } from "@/components/browse/poster-slider";
import { getMyListEntries, type MyListEntry } from "@/lib/db/my-list";
import {
  getProgressEntries,
  type ProgressEntry,
} from "@/lib/db/watch-progress";
import { requireUser } from "@/lib/supabase/require-user";
import { searchMulti } from "@/lib/tmdb/endpoints";
import { todayIso } from "@/lib/tmdb/release";

// The search results page: the browse chrome stays (header via the (app)
// layout), results render as a poster grid whose tiles are the same
// hover-portal cards as the rows. No loading.tsx here on purpose - while a
// keystroke's navigation is in flight the previous results stay visible,
// which is exactly how live search should feel.
export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireUser();
  const { q } = await searchParams;
  const query = (Array.isArray(q) ? q[0] : (q ?? "")).trim();

  // Runs concurrently with the search fetch; seeds the +/✓ membership Set. A
  // failure degrades to all-"+" buttons (adds are idempotent), not a crash.
  const myListEntriesPromise = getMyListEntries().catch(
    (error): MyListEntry[] => {
      console.error("[search] my_list read failed", error);
      return [];
    },
  );
  // Same for saved progress (resume-aware Play); a failure plays from the top.
  const progressEntriesPromise = getProgressEntries().catch(
    (error): ProgressEntry[] => {
      console.error("[search] progress read failed", error);
      return [];
    },
  );

  let titles: PosterTitle[] | null = null;
  if (query !== "") {
    try {
      const results = await searchMulti(query);
      // Posterless obscurities render as broken tiles - skip them (tmdb.md).
      titles = results.filter(
        (title): title is PosterTitle => title.posterPath !== null,
      );
    } catch (error) {
      console.error(`[search] searchMulti failed for query "${query}"`, error);
    }
  }
  const [myListEntries, progressEntries] = await Promise.all([
    myListEntriesPromise,
    progressEntriesPromise,
  ]);

  return (
    <main className="flex-1 px-[30px] pt-[150px] pb-12 sm:px-[60px]">
      <BrowseProviders
        today={todayIso()}
        myListEntries={myListEntries}
        progressEntries={progressEntries}
      >
        {query === "" ? (
          <p className="text-muted text-lg">
            Type in the search box above to find a movie or TV show.
          </p>
        ) : titles === null ? (
          <p className="text-muted text-lg">
            Search isn&apos;t working right now - try again in a moment.
          </p>
        ) : titles.length === 0 ? (
          <div className="text-lg">
            <p>Your search for &quot;{query}&quot; did not have any matches.</p>
            <p className="mt-6">Suggestions:</p>
            <ul className="mt-2 list-disc pl-8">
              <li>Try different keywords</li>
              <li>Looking for a movie or TV show?</li>
              <li>Try using a movie or TV show title</li>
            </ul>
          </div>
        ) : (
          <PosterGrid titles={titles} />
        )}
      </BrowseProviders>
    </main>
  );
}
