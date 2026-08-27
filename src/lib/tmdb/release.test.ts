import { describe, expect, it } from "vitest";
import { comingDate, formatComingDate, isReleased, todayIso } from "./release";

const TODAY = "2026-08-22";

describe("isReleased", () => {
  it("treats a missing date as released - thin TMDB data never blocks", () => {
    expect(isReleased(null, TODAY)).toBe(true);
    expect(isReleased("", TODAY)).toBe(true);
  });

  it("releases past dates and today itself", () => {
    expect(isReleased("1994-09-22", TODAY)).toBe(true);
    expect(isReleased("2026-08-21", TODAY)).toBe(true);
    expect(isReleased("2026-08-22", TODAY)).toBe(true);
  });

  it("holds back anything dated after today", () => {
    expect(isReleased("2026-08-23", TODAY)).toBe(false);
    expect(isReleased("2027-01-01", TODAY)).toBe(false);
  });
});

describe("formatComingDate", () => {
  it("drops the year when it's this year", () => {
    expect(formatComingDate("2026-10-03", TODAY)).toBe("October 3");
    expect(formatComingDate("2026-12-25", TODAY)).toBe("December 25");
  });

  it("keeps the year when it isn't", () => {
    expect(formatComingDate("2027-01-09", TODAY)).toBe("January 9, 2027");
  });
});

describe("comingDate", () => {
  it("is null for anything already out or undated", () => {
    expect(comingDate(null, TODAY)).toBeNull();
    expect(comingDate("1994-09-22", TODAY)).toBeNull();
    expect(comingDate(TODAY, TODAY)).toBeNull();
  });

  it("formats a date still to come", () => {
    expect(comingDate("2026-10-03", TODAY)).toBe("October 3");
    expect(comingDate("2027-03-01", TODAY)).toBe("March 1, 2027");
  });
});

describe("todayIso", () => {
  it("writes the UTC calendar date the way TMDB does", () => {
    expect(todayIso(new Date("2026-08-22T12:00:00Z"))).toBe("2026-08-22");
    // Late evening in the US is already tomorrow in UTC.
    expect(todayIso(new Date("2026-08-22T23:30:00-05:00"))).toBe("2026-08-23");
  });
});
