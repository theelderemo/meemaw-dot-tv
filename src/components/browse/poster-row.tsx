import type { Title } from "@/lib/tmdb/schemas";
import PosterSlider, { type PosterTitle } from "./poster-slider";

// Server component: receives already-fetched titles (the page fetches all rows
// with Promise.allSettled) and hands the client slider a poster-only list.
export default function PosterRow({
  rowKey,
  label,
  titles,
  showProgress = false,
}: {
  rowKey: string;
  label: string;
  titles: Title[];
  /** Continue Watching only: tiles draw their watched bar. */
  showProgress?: boolean;
}) {
  const withPosters = titles.filter(
    (title): title is PosterTitle => title.posterPath !== null,
  );
  if (withPosters.length === 0) return null;

  const headingId = `browse-row-${rowKey}`;

  return (
    <section aria-labelledby={headingId}>
      <h2
        id={headingId}
        className="mb-4 pl-[30px] text-2xl font-bold sm:pl-[60px]"
      >
        {label}
      </h2>
      <PosterSlider
        label={label}
        titles={withPosters}
        showProgress={showProgress}
      />
    </section>
  );
}
