import { describe, expect, it } from "vitest";
import {
  FINISHED_FRACTION,
  isFinished,
  progressFraction,
  resumePosition,
  type ProgressEntry,
} from "./rules";

function movieEntry(
  positionSeconds: number,
  durationSeconds: number,
): ProgressEntry {
  return {
    mediaType: "movie",
    tmdbId: 438631,
    season: 0,
    episode: 0,
    positionSeconds,
    durationSeconds,
  };
}

describe("isFinished", () => {
  it("finishes at the threshold, not before", () => {
    expect(FINISHED_FRACTION).toBe(0.9);
    expect(isFinished(899, 1000)).toBe(false);
    expect(isFinished(900, 1000)).toBe(true);
    expect(isFinished(1000, 1000)).toBe(true);
  });

  it("never finishes while the duration is unknown", () => {
    expect(isFinished(0, 0)).toBe(false);
    expect(isFinished(500, 0)).toBe(false);
  });
});

describe("resumePosition", () => {
  it("starts from the top with nothing saved", () => {
    expect(resumePosition(null)).toBe(0);
  });

  it("resumes an unfinished title where it stopped", () => {
    expect(resumePosition(movieEntry(1800, 6000))).toBe(1800);
  });

  it("restarts a finished title from the top", () => {
    expect(resumePosition(movieEntry(5900, 6000))).toBe(0);
  });
});

describe("progressFraction", () => {
  it("draws no bar for an unstarted or duration-less entry", () => {
    expect(progressFraction(movieEntry(0, 6000))).toBeNull();
    expect(progressFraction(movieEntry(0, 0))).toBeNull();
    expect(progressFraction(movieEntry(30, 0))).toBeNull();
  });

  it("fills proportionally and never past full", () => {
    expect(progressFraction(movieEntry(1500, 6000))).toBe(0.25);
    expect(progressFraction(movieEntry(6100, 6000))).toBe(1);
  });
});
