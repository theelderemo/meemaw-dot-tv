import WatchError, {
  notOutYetMessage,
  WATCH_ERROR_CODES,
  WATCH_ERROR_INSTRUCTIONS,
  WATCH_ERROR_MESSAGES,
} from "@/components/watch/watch-error";
import { parseRouteInt } from "@/components/watch/watch-route";
import WatchPlayer from "@/components/watch/watch-player";
import { nextEpisode } from "@/lib/progress/next-episode";
import { requireUser } from "@/lib/supabase/require-user";
import { getSeason, getTvDetails } from "@/lib/tmdb/endpoints";
import { comingDate, todayIso } from "@/lib/tmdb/release";
import { savedStartAt } from "../../../../saved-progress";
import { orNotFound } from "../../../../tmdb-not-found";

// /watch/tv/[tmdbId]/[season]/[episode] - see the movie page for why the
// stream URL is client-fetched. Season 0 is TMDB's "Specials". The next
// episode is computed here from the same two fetches, so the player's Next
// Episode costs no extra TMDB call. An episode that hasn't aired (TMDB air
// date) is settled here before the player mounts.
export default async function WatchTvPage({
  params,
}: PageProps<"/watch/tv/[tmdbId]/[season]/[episode]">) {
  await requireUser();
  const raw = await params;
  const tmdbId = parseRouteInt(raw.tmdbId, 1);
  const season = parseRouteInt(raw.season, 0);
  const episode = parseRouteInt(raw.episode, 1);
  const validParams = tmdbId !== null && season !== null && episode !== null;
  const today = todayIso();

  const [fetched, startAt] = validParams
    ? await Promise.all([
        orNotFound(
          Promise.all([getTvDetails(tmdbId), getSeason(tmdbId, season)]),
        ),
        savedStartAt({ mediaType: "tv", tmdbId, season, episode }),
      ])
    : [null, 0];
  const episodeData =
    fetched?.[1].episodes.find((entry) => entry.episodeNumber === episode) ??
    null;
  if (!validParams || fetched === null || episodeData === null) {
    return (
      <WatchError
        message={WATCH_ERROR_MESSAGES["not-found"]}
        instruction={WATCH_ERROR_INSTRUCTIONS["not-found"]}
        code={WATCH_ERROR_CODES["not-found"]}
      />
    );
  }
  const coming = comingDate(episodeData.airDate, today);
  if (coming !== null) {
    return <WatchError message={notOutYetMessage(coming)} />;
  }

  return (
    <WatchPlayer
      // Next Episode navigates within this same route; the key remounts the
      // player per episode so resume, beat and countdown state never carry
      // over from the previous one.
      key={`${tmdbId}:${season}:${episode}`}
      target={{ type: "tv", tmdbId, season, episode }}
      title={fetched[0].title}
      subtitle={`S${season}:E${episode} ${episodeData.name}`}
      startAt={startAt}
      nextEpisode={nextEpisode(fetched[0].seasons, fetched[1], episode, today)}
    />
  );
}
