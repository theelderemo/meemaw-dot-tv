import BrowseProviders from "@/components/browse/browse-providers";
import PosterGrid from "@/components/browse/poster-grid";
import type { PosterTitle } from "@/components/browse/poster-slider";
import { getMyListEntries, type MyListEntry } from "@/lib/db/my-list";
import {
  getProgressEntries,
  type ProgressEntry,
} from "@/lib/db/watch-progress";
import { resolveMyListTitles } from "@/lib/my-list-titles";
import { requireUser } from "@/lib/supabase/require-user";
import { todayIso } from "@/lib/tmdb/release";

// The My List page: heading + the same poster grid as search results
// (hover-portal cards, so +/✓ and the modal work right here). Unlike browse,
// a failed read can't silently degrade - an empty grid would lie ("you haven't
// added any titles") - so it renders the error copy instead.
export default async function MyListPage() {
  await requireUser();

  // Seeds the resume-aware Play buttons, concurrently with the list read; a
  // failure just means Play starts from the top.
  const progressEntriesPromise = getProgressEntries().catch(
    (error): ProgressEntry[] => {
      console.error("[my-list] progress read failed", error);
      return [];
    },
  );

  let titles: PosterTitle[] | null = null;
  let entries: MyListEntry[] = [];
  try {
    entries = await getMyListEntries();
    const resolved = await resolveMyListTitles(entries);
    // Posterless titles can't render as grid tiles - skip them (tmdb.md).
    titles = resolved.filter(
      (title): title is PosterTitle => title.posterPath !== null,
    );
  } catch (error) {
    console.error("[my-list] page read failed", error);
  }
  const progressEntries = await progressEntriesPromise;

  return (
    <main className="flex-1 px-[30px] pt-[100px] pb-12 sm:px-[60px]">
      <BrowseProviders
        today={todayIso()}
        myListEntries={entries}
        progressEntries={progressEntries}
      >
        <h1 className="mb-8 text-2xl font-bold sm:text-4xl">My List</h1>
        {titles === null ? (
          <p className="text-muted text-lg">
            Meemaw&apos;s photo album is stuck together. Give it another try.
          </p>
        ) : titles.length === 0 ? (
          <p className="text-lg">
            You haven&apos;t added any titles to your list yet.
          </p>
        ) : (
          <PosterGrid titles={titles} />
        )}
      </BrowseProviders>
    </main>
  );
}
