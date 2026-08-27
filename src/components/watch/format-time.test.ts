import { describe, expect, it } from "vitest";
import { formatTime } from "./format-time";

describe("formatTime", () => {
  it("renders sub-hour times as mm:ss", () => {
    expect(formatTime(0)).toBe("00:00");
    expect(formatTime(59)).toBe("00:59");
    expect(formatTime(61)).toBe("01:01");
    expect(formatTime(3599)).toBe("59:59");
  });

  it("renders hour-plus times with unpadded hours", () => {
    expect(formatTime(3600)).toBe("1:00:00");
    expect(formatTime(6730)).toBe("1:52:10");
    expect(formatTime(36_000)).toBe("10:00:00");
  });

  it("floors fractional seconds", () => {
    expect(formatTime(59.9)).toBe("00:59");
  });

  it("clamps garbage to 00:00 - a video with no duration yet must not render NaN", () => {
    expect(formatTime(NaN)).toBe("00:00");
    expect(formatTime(-5)).toBe("00:00");
    expect(formatTime(Infinity)).toBe("00:00");
  });
});
