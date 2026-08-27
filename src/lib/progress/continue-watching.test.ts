import { describe, expect, it } from "vitest";
import {
  CONTINUE_WATCHING_LIMIT,
  continueWatchingItems,
} from "./continue-watching";
import type { ProgressEntry } from "./rules";

function movie(
  tmdbId: number,
  positionSeconds: number,
  durationSeconds = 6000,
): ProgressEntry {
  return {
    mediaType: "movie",
    tmdbId,
    season: 0,
    episode: 0,
    positionSeconds,
    durationSeconds,
  };
}

function episode(
  tmdbId: number,
  season: number,
  episodeNumber: number,
  positionSeconds: number,
  durationSeconds = 1300,
): ProgressEntry {
  return {
    mediaType: "tv",
    tmdbId,
    season,
    episode: episodeNumber,
    positionSeconds,
    durationSeconds,
  };
}

function cardsOf(items: ProgressEntry[]): string[] {
  return items.map((item) =>
    item.mediaType === "movie"
      ? `movie:${item.tmdbId}`
      : `tv:${item.tmdbId}:S${item.season}E${item.episode}`,
  );
}

describe("continueWatchingItems", () => {
  it("keeps one card per title - the newest entry - in newest-first order", () => {
    const items = continueWatchingItems([
      episode(1668, 2, 5, 300), // Friends, most recent
      movie(438631, 1800), // Dune
      episode(1668, 2, 4, 1200), // older Friends episode
      episode(1668, 1, 1, 1300),
      movie(603, 100), // The Matrix
    ]);

    expect(cardsOf(items)).toEqual([
      "tv:1668:S2E5",
      "movie:438631",
      "movie:603",
    ]);
  });

  it("drops finished movies but keeps finished episodes", () => {
    const items = continueWatchingItems([
      movie(438631, 5900, 6000),
      episode(1668, 10, 18, 1290, 1300),
      movie(603, 3000, 6000),
    ]);

    expect(cardsOf(items)).toEqual(["tv:1668:S10E18", "movie:603"]);
  });

  it("keeps a queued next episode at position 0 (the show's next-up card)", () => {
    const items = continueWatchingItems([
      episode(1668, 1, 4, 0, 0),
      episode(1668, 1, 3, 1300),
    ]);

    expect(cardsOf(items)).toEqual(["tv:1668:S1E4"]);
  });

  it("treats a movie and a show sharing a TMDB id as different titles", () => {
    const items = continueWatchingItems([
      movie(1668, 10),
      episode(1668, 1, 1, 10),
    ]);
    expect(items).toHaveLength(2);
  });

  it("caps the row after dedupe and drops", () => {
    const entries: ProgressEntry[] = [
      movie(1, 5900, 6000), // finished - doesn't count toward the cap
      ...Array.from({ length: CONTINUE_WATCHING_LIMIT + 5 }, (_, i) =>
        movie(100 + i, 10),
      ),
    ];

    const items = continueWatchingItems(entries);
    expect(items).toHaveLength(CONTINUE_WATCHING_LIMIT);
    expect(items[0].tmdbId).toBe(100);
    expect(items[CONTINUE_WATCHING_LIMIT - 1].tmdbId).toBe(
      100 + CONTINUE_WATCHING_LIMIT - 1,
    );
  });

  it("returns nothing for no history", () => {
    expect(continueWatchingItems([])).toEqual([]);
  });
});
