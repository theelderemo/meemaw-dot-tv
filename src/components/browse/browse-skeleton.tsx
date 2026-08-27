// Pulse skeleton shown while a browse-experience page (/browse,
// /tv, /movies) fetches TMDB rows. Mirrors the real page's flow geometry
// (billboard flow box = 40% of viewport width, 16 px row gap, same gutters) so
// the streamed page lands without shift.
const SKELETON_ROW_COUNT = 3;
const SKELETON_CARD_COUNT = 8;

export default function BrowseSkeleton() {
  return (
    <main className="flex-1" aria-busy="true">
      <p role="status" className="sr-only">
        Loading…
      </p>
      <div aria-hidden="true">
        <div className="bg-background-elevated mb-6 aspect-[5/2] w-full animate-pulse" />
        <div className="flex flex-col gap-4">
          {Array.from({ length: SKELETON_ROW_COUNT }, (_, rowIndex) => (
            <div key={rowIndex}>
              <div className="bg-background-elevated mb-4 ml-[30px] h-7 w-48 animate-pulse rounded sm:ml-[60px]" />
              <div className="mx-[30px] flex overflow-hidden sm:mx-[60px]">
                {Array.from({ length: SKELETON_CARD_COUNT }, (_, cardIndex) => (
                  <div
                    key={cardIndex}
                    className="w-1/2 shrink-0 pr-1 sm:w-1/3 sm:pr-2 md:w-1/4 lg:w-1/5 2xl:w-1/6"
                  >
                    <div className="bg-background-elevated aspect-[2/3] animate-pulse rounded" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
