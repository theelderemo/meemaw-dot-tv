import { getMyListEntries, type MyListEntry } from "@/lib/db/my-list";
import { getOwnProfile } from "@/lib/db/profiles";
import {
  getProgressEntries,
  type ProgressEntry,
} from "@/lib/db/watch-progress";
import { resolveMyListTitles } from "@/lib/my-list-titles";
import {
  continueWatchingItems,
  resolveContinueWatchingTitles,
} from "@/lib/progress/continue-watching";
import { isReleased, todayIso } from "@/lib/tmdb/release";
import { fetchRowTitles, type BrowseRow } from "@/lib/tmdb/rows";
import type { Title } from "@/lib/tmdb/schemas";
import Billboard, { type BillboardTitle } from "./billboard";
import BrowseProviders from "./browse-providers";
import PosterRow from "./poster-row";

// One fetch feeds both My List consumers: entries seed the +/✓ membership Set,
// titles fill the row. A failure degrades to an absent row and all-"+" buttons
// (the toggles still work - adds are idempotent) rather than sinking browse.
async function loadMyList(): Promise<{
  entries: MyListEntry[];
  titles: Title[];
}> {
  try {
    const entries = await getMyListEntries();
    return { entries, titles: await resolveMyListTitles(entries) };
  } catch (error) {
    console.error("[browse] dropping My List row: read failed", error);
    return { entries: [], titles: [] };
  }
}

// Likewise for progress: entries seed the resume-aware Play lookup on every
// browse page; on home the same rows also become the Continue Watching cards.
// A failure degrades to no row and Play-from-the-top buttons, not a crash.
async function loadWatchProgress(withRow: boolean): Promise<{
  entries: ProgressEntry[];
  titles: Title[];
}> {
  try {
    const entries = await getProgressEntries();
    const titles = withRow
      ? await resolveContinueWatchingTitles(continueWatchingItems(entries))
      : [];
    return { entries, titles };
  } catch (error) {
    console.error("[browse] dropping Continue Watching: read failed", error);
    return { entries: [], titles: [] };
  }
}

// The browse experience shared by /browse, /tv and /movies - same machinery,
// different row config (rows.ts). Each page's billboard comes from its own
// trending row, so /tv and /movies feature media-scoped titles. Auth is NOT
// here: every page calls requireUser() itself (coding-standards §Security).
export default async function BrowseScreen({
  rows: rowConfig,
  continueWatching = false,
}: {
  rows: readonly BrowseRow[];
  /** Home only: the Continue Watching row, first (row order in rows.ts). */
  continueWatching?: boolean;
}) {
  // Today, once per render, for every release-date decision on this page and
  // (via BrowseProviders) in its client components.
  const today = todayIso();

  // One settled fetch per curated row - a row whose fetch fails is dropped with
  // a server log, never crashing the page.
  const [settled, myList, progress, profile] = await Promise.all([
    Promise.allSettled(rowConfig.map((row) => fetchRowTitles(row))),
    loadMyList(),
    loadWatchProgress(continueWatching),
    continueWatching ? getOwnProfile() : null,
  ]);
  const rows: { row: BrowseRow; titles: Title[] }[] = [];
  rowConfig.forEach((row, index) => {
    const result = settled[index];
    if (result.status === "fulfilled") {
      rows.push({ row, titles: result.value });
    } else {
      console.error(
        `[browse] dropping row "${row.key}": fetch failed`,
        result.reason,
      );
    }
  });

  // A hero that isn't out yet would have no Play - broken, not gated - so the
  // picker skips unreleased titles outright.
  const billboardTitle =
    rows
      .find(({ row }) => row.fetch.kind === "trending")
      ?.titles.find(
        (title): title is BillboardTitle =>
          title.backdropPath !== null && isReleased(title.releaseDate, today),
      ) ?? null;

  return (
    <main className="flex-1">
      <BrowseProviders
        today={today}
        myListEntries={myList.entries}
        progressEntries={progress.entries}
      >
        {billboardTitle ? (
          <Billboard title={billboardTitle} />
        ) : (
          // Degraded state (trending fetch failed): keep rows clear of the fixed header.
          <div aria-hidden="true" className="h-[90px]" />
        )}
        <div className="relative z-[1] flex flex-col gap-4">
          {/* [slot] Continue Watching first (rows.ts) - labeled with the
              profile's name; PosterRow hides it while there's nothing to
              continue. */}
          {profile && (
            <PosterRow
              rowKey="continue-watching"
              label={`Continue Watching for ${profile.displayName}`}
              titles={progress.titles}
              showProgress
            />
          )}
          {rows.map(({ row, titles }) => (
            <PosterRow
              key={row.key}
              rowKey={row.key}
              label={row.label}
              titles={titles}
            />
          ))}
          {/* [slot] My List last (rows.ts) - PosterRow hides itself while the
              list is empty. */}
          <PosterRow rowKey="my-list" label="My List" titles={myList.titles} />
        </div>
      </BrowseProviders>
    </main>
  );
}
