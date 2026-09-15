import { describe, expect, it } from "vitest";
import { computeSampleReveal, SAMPLE_GUESS } from "./sampleGuess";

describe("computeSampleReveal", () => {
  it("yields a measurable, non-zero, honest measurement", () => {
    const reveal = computeSampleReveal();

    expect(reveal.measurable).toBe(true);
    expect(reveal.bearing.errorDeg).toBeGreaterThan(0);
    // Above the floor, so the concrete degrees-off line shows.
    expect(reveal.bearing.errorDeg).toBeGreaterThan(SAMPLE_GUESS.floorDeg);
    expect(reveal.bearing.withinFloor).toBe(false);
    expect(reveal.trueDistanceM).toBeGreaterThan(0);
    // A real over- or under-estimate, never a flattering spot-on.
    expect(reveal.distance.verdict).not.toBe("spot_on");
  });

  it("matches the built-in scenario within tolerance", () => {
    const reveal = computeSampleReveal();

    expect(reveal.directionWord).toBe("northeast");
    expect(reveal.bearing.errorDeg).toBeGreaterThan(20);
    expect(reveal.bearing.errorDeg).toBeLessThan(32);
    expect(reveal.bearing.bucket).toBe("Close");
    expect(reveal.trueDistanceM).toBeGreaterThan(430);
    expect(reveal.trueDistanceM).toBeLessThan(520);
    expect(reveal.guessedDistanceM).toBe(650);
    expect(reveal.distance.verdict).toBe("long");
  });
});
