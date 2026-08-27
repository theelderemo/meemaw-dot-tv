import { describe, expect, it } from "vitest";
import seasonFixture from "../tmdb/__fixtures__/season.json";
import tvDetailsFixture from "../tmdb/__fixtures__/tv-details.json";
import { seasonSchema, tvDetailsSchema, type Season } from "../tmdb/schemas";
import { nextEpisode } from "./next-episode";

// Real captured Friends data: the detail fixture lists Specials (39), Season 1
// (24), Season 2 (24) and an empty Season 3 (dropped by the boundary parse);
// the season fixture is Season 1 with episodes 1–3, all aired in 1994.
const { seasons } = tvDetailsSchema.parse(tvDetailsFixture);
const seasonOne = seasonSchema.parse(seasonFixture);
const TODAY = "2026-08-22";

function asSeason(seasonNumber: number): Season {
  return { ...seasonOne, seasonNumber };
}

// Season 1 as a running show would list it: episodes 1–2 aired, 3 still to come.
function airingSeasonOne(thirdAirDate: string | null): Season {
  return {
    ...seasonOne,
    episodes: seasonOne.episodes.map((episode) =>
      episode.episodeNumber === 3
        ? { ...episode, airDate: thirdAirDate }
        : episode,
    ),
  };
}

function withSeasonTwoAirDate(airDate: string | null) {
  return seasons.map((season) =>
    season.seasonNumber === 2 ? { ...season, airDate } : season,
  );
}

describe("nextEpisode", () => {
  it("parses the fixture the way the page will see it", () => {
    expect(seasons.map((season) => season.seasonNumber)).toEqual([1, 2, 0]);
    expect(seasonOne.episodes.map((episode) => episode.episodeNumber)).toEqual([
      1, 2, 3,
    ]);
  });

  it("steps to the next episode in the same season", () => {
    expect(nextEpisode(seasons, seasonOne, 1, TODAY)).toEqual({
      season: 1,
      episode: 2,
    });
    expect(nextEpisode(seasons, seasonOne, 2, TODAY)).toEqual({
      season: 1,
      episode: 3,
    });
  });

  it("rolls the last episode of a season into the next season's opener", () => {
    expect(nextEpisode(seasons, seasonOne, 3, TODAY)).toEqual({
      season: 2,
      episode: 1,
    });
  });

  it("skips a gap in season numbering rather than stopping at it", () => {
    const withGap = seasons.filter((season) => season.seasonNumber !== 2);
    const seasonThree = {
      seasonNumber: 3,
      name: "Season 3",
      episodeCount: 5,
      airDate: "1996-09-16",
    };
    expect(nextEpisode([...withGap, seasonThree], seasonOne, 3, TODAY)).toEqual(
      {
        season: 3,
        episode: 1,
      },
    );
  });

  it("never offers Specials after the last regular season", () => {
    // Season 2 is the last aired season in the fixture; Specials exist but
    // must not be "next".
    expect(nextEpisode(seasons, asSeason(2), 3, TODAY)).toBeNull();
  });

  it("does not roll a special into Season 1", () => {
    expect(nextEpisode(seasons, asSeason(0), 3, TODAY)).toBeNull();
    expect(nextEpisode(seasons, asSeason(0), 1, TODAY)).toEqual({
      season: 0,
      episode: 2,
    });
  });

  it("returns null for an episode TMDB doesn't list", () => {
    expect(nextEpisode(seasons, seasonOne, 99, TODAY)).toBeNull();
  });
});

describe("nextEpisode release-date gating", () => {
  it("offers nothing after the last aired episode of a running season", () => {
    const airing = airingSeasonOne("2026-08-29");
    expect(nextEpisode(seasons, airing, 1, TODAY)).toEqual({
      season: 1,
      episode: 2,
    });
    expect(nextEpisode(seasons, airing, 2, TODAY)).toBeNull();
  });

  it("offers an episode that airs today", () => {
    expect(nextEpisode(seasons, airingSeasonOne(TODAY), 2, TODAY)).toEqual({
      season: 1,
      episode: 3,
    });
  });

  it("treats an undated episode as aired - missing data never blocks", () => {
    expect(nextEpisode(seasons, airingSeasonOne(null), 2, TODAY)).toEqual({
      season: 1,
      episode: 3,
    });
  });

  it("does not roll into a season whose opener hasn't aired", () => {
    expect(
      nextEpisode(withSeasonTwoAirDate("2026-09-10"), seasonOne, 3, TODAY),
    ).toBeNull();
  });

  it("rolls into an undated next season", () => {
    expect(
      nextEpisode(withSeasonTwoAirDate(null), seasonOne, 3, TODAY),
    ).toEqual({ season: 2, episode: 1 });
  });
});
