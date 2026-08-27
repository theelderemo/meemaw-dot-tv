import { describe, expect, it } from "vitest";
import { STREAM_KEY_PATTERN, streamKey } from "./stream-key.ts";

describe("streamKey", () => {
  it("is deterministic, 16 hex chars, and url-specific", () => {
    const a = streamKey("https://torrentio.example/resolve/a");
    expect(a).toMatch(STREAM_KEY_PATTERN);
    expect(streamKey("https://torrentio.example/resolve/a")).toBe(a);
    expect(streamKey("https://torrentio.example/resolve/b")).not.toBe(a);
  });

  it("never echoes the url it hashes", () => {
    const secret = "https://torrentio.example/realdebrid=SECRETKEY/resolve";
    expect(streamKey(secret)).not.toContain("SECRET");
  });
});
