import { describe, expect, it } from "vitest";
import { NUDGES, nudgeAt } from "./nudges";

describe("nudges", () => {
  it("holds the fixed set of six", () => {
    expect(NUDGES).toHaveLength(6);
    expect(new Set(NUDGES).size).toBe(6);
  });

  it("returns each nudge in order", () => {
    for (let i = 0; i < NUDGES.length; i++) {
      expect(nudgeAt(i)).toBe(NUDGES[i]);
    }
  });

  it("wraps by modulo", () => {
    expect(nudgeAt(6)).toBe(NUDGES[0]);
    expect(nudgeAt(7)).toBe(NUDGES[1]);
    expect(nudgeAt(13)).toBe(NUDGES[1]);
  });
});
