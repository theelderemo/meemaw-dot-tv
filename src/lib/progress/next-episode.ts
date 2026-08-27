import { isReleased } from "../tmdb/release";
import type { Season, SeasonSummary } from "../tmdb/schemas";
import type { EpisodeRef } from "./rules";

// The "next episode" rule for the TV watch page: the entry after the current
// one in TMDB's list for this season, else the opener of the next season, else
// null (end of the show). Pure, and fed by data the page already fetched - no
// extra TMDB call per episode. `seasons` is the detail-parsed list (empty
// seasons already dropped). Nothing unaired as of `today` is ever offered
// - episodes air in order, so an unaired next one means there is
// nothing further to queue - the player then shows no Next Episode and sends
// no advanceTo. Specials (season 0) are a side shelf, not a sequel
// to the last regular season - they never follow one, and a special's end
// doesn't roll into Season 1.
export function nextEpisode(
  seasons: SeasonSummary[],
  current: Season,
  episodeNumber: number,
  today: string,
): EpisodeRef | null {
  const index = current.episodes.findIndex(
    (episode) => episode.episodeNumber === episodeNumber,
  );
  if (index === -1) return null;

  const following = current.episodes[index + 1];
  if (following) {
    return isReleased(following.airDate, today)
      ? { season: current.seasonNumber, episode: following.episodeNumber }
      : null;
  }

  if (current.seasonNumber === 0) return null;
  const nextSeason = seasons
    .filter((season) => season.seasonNumber > current.seasonNumber)
    .sort((a, b) => a.seasonNumber - b.seasonNumber)[0];
  if (!nextSeason || !isReleased(nextSeason.airDate, today)) return null;
  return { season: nextSeason.seasonNumber, episode: 1 };
}
