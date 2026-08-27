import { describe, expect, it } from "vitest";
import { MIN_PASSWORD_LENGTH, validateNewPassword } from "./password-rules";

describe("validateNewPassword", () => {
  it("accepts a matching pair at the minimum length", () => {
    const password = "a".repeat(MIN_PASSWORD_LENGTH);
    expect(validateNewPassword(password, password)).toBeNull();
  });

  it("rejects a password below the minimum length", () => {
    const short = "a".repeat(MIN_PASSWORD_LENGTH - 1);
    expect(validateNewPassword(short, short)).toBe("too-short");
  });

  it("rejects empty fields as too short", () => {
    expect(validateNewPassword("", "")).toBe("too-short");
  });

  it("rejects a non-matching confirmation", () => {
    expect(validateNewPassword("longenough", "different")).toBe("mismatch");
  });

  it("reports too-short before mismatch for a short non-matching pair", () => {
    expect(validateNewPassword("abc", "xyz")).toBe("too-short");
  });
});
