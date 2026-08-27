import WatchError, {
  notOutYetMessage,
  WATCH_ERROR_CODES,
  WATCH_ERROR_INSTRUCTIONS,
  WATCH_ERROR_MESSAGES,
} from "@/components/watch/watch-error";
import { parseRouteInt } from "@/components/watch/watch-route";
import WatchPlayer from "@/components/watch/watch-player";
import { requireUser } from "@/lib/supabase/require-user";
import { getMovieDetails } from "@/lib/tmdb/endpoints";
import { comingDate, todayIso } from "@/lib/tmdb/release";
import { savedStartAt } from "../../saved-progress";
import { orNotFound } from "../../tmdb-not-found";

// /watch/movie/[tmdbId] - full-bleed player, deliberately outside the
// (browse) chrome group. Only the title and the saved position render
// server-side; the stream URL is fetched client-side on mount because it's
// short-lived and account-tied (stream-resolution.md) - HTML carrying it could
// serve a dead link. A movie that isn't out yet (TMDB release date)
// is settled here too, so the player - and its stream fetch - never mounts.
export default async function WatchMoviePage({
  params,
}: PageProps<"/watch/movie/[tmdbId]">) {
  await requireUser();
  const { tmdbId } = await params;
  const id = parseRouteInt(tmdbId, 1);
  const today = todayIso();

  const [details, startAt] =
    id === null
      ? [null, 0]
      : await Promise.all([
          orNotFound(getMovieDetails(id)),
          savedStartAt({
            mediaType: "movie",
            tmdbId: id,
            season: 0,
            episode: 0,
          }),
        ]);
  if (id === null || details === null) {
    return (
      <WatchError
        message={WATCH_ERROR_MESSAGES["not-found"]}
        instruction={WATCH_ERROR_INSTRUCTIONS["not-found"]}
        code={WATCH_ERROR_CODES["not-found"]}
      />
    );
  }
  const coming = comingDate(details.releaseDate, today);
  if (coming !== null) {
    return <WatchError message={notOutYetMessage(coming)} />;
  }

  return (
    <WatchPlayer
      target={{ type: "movie", tmdbId: id }}
      title={details.title}
      startAt={startAt}
    />
  );
}
