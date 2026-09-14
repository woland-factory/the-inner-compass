import { describe, expect, it } from "vitest";
import { SIGNATURE_MIN_GUESSES, deriveSignature } from "./signature";
import type { StoredGuess } from "./store";

function row(overrides: Partial<StoredGuess> = {}): StoredGuess {
  return {
    id: `id-${Math.random()}`,
    timestamp: 1,
    targetKind: "walk_start",
    mode: "bearing",
    guessedBearingDeg: 90,
    trueBearingDeg: 100,
    bearingErrorDeg: 10,
    signedBearingErrorDeg: -10,
    guessedDistanceM: 100,
    trueDistanceM: 100,
    distanceRatio: 1,
    headingAccuracyDeg: 12,
    nudgeIndex: 0,
    ...overrides,
  };
}

// A distance-only row so distance statements can be exercised without bearings.
function distanceRow(ratio: number): StoredGuess {
  return row({
    mode: "distance_only",
    guessedBearingDeg: null,
    bearingErrorDeg: null,
    signedBearingErrorDeg: null,
    distanceRatio: ratio,
  });
}

function bearingRow(errorDeg: number, signed: number, ratio = 1): StoredGuess {
  return row({
    mode: "bearing",
    bearingErrorDeg: errorDeg,
    signedBearingErrorDeg: signed,
    distanceRatio: ratio,
  });
}

const MANY = SIGNATURE_MIN_GUESSES;

describe("deriveSignature threshold", () => {
  it("returns [] below the minimum guess count", () => {
    const few = Array.from({ length: MANY - 1 }, () => distanceRow(1.5));
    expect(deriveSignature(few)).toEqual([]);
  });
});

describe("distance calibration statement", () => {
  it("reports run long for ratios well above 1", () => {
    const guesses = Array.from({ length: MANY }, () => distanceRow(1.5));
    expect(deriveSignature(guesses)[0]).toBe(
      "Your distance guesses run long, about 1.5× the real distance.",
    );
  });

  it("reports run short for ratios well below 1", () => {
    const guesses = Array.from({ length: MANY }, () => distanceRow(0.6));
    expect(deriveSignature(guesses)[0]).toBe(
      "Your distance guesses run short, about 0.6× the real distance.",
    );
  });

  it("reports land close inside the [0.8, 1.25] band", () => {
    const guesses = Array.from({ length: MANY }, () => distanceRow(1.0));
    expect(deriveSignature(guesses)[0]).toBe(
      "Your distance guesses land close to the real distance.",
    );
  });

  it("treats the 1.25 boundary as close, not long", () => {
    const guesses = Array.from({ length: MANY }, () => distanceRow(1.25));
    expect(deriveSignature(guesses)[0]).toBe(
      "Your distance guesses land close to the real distance.",
    );
  });

  it("treats the 0.8 boundary as close, not short", () => {
    const guesses = Array.from({ length: MANY }, () => distanceRow(0.8));
    expect(deriveSignature(guesses)[0]).toBe(
      "Your distance guesses land close to the real distance.",
    );
  });
});

describe("bearing statements", () => {
  it("omits bearing statements without enough bearing-mode guesses", () => {
    const guesses = Array.from({ length: MANY }, () => distanceRow(1.0));
    const out = deriveSignature(guesses);
    expect(out.some((s) => s.includes("bearings"))).toBe(false);
    expect(out.some((s) => s.includes("lean"))).toBe(false);
  });

  it("reports typical error with enough bearing-mode guesses", () => {
    const guesses = Array.from({ length: MANY }, () => bearingRow(20, 20));
    const out = deriveSignature(guesses);
    expect(out).toContain("Your bearings are usually about 20° off.");
  });

  it("reports a lean right for a consistent positive median", () => {
    const guesses = Array.from({ length: MANY }, () => bearingRow(25, 25));
    const out = deriveSignature(guesses);
    expect(out).toContain("You lean right of true.");
  });

  it("reports a lean left for a consistent negative median", () => {
    const guesses = Array.from({ length: MANY }, () => bearingRow(25, -25));
    const out = deriveSignature(guesses);
    expect(out).toContain("You lean left of true.");
  });

  it("omits the lean statement for mixed-sign noise", () => {
    const guesses = [
      bearingRow(20, 20),
      bearingRow(20, -20),
      bearingRow(20, 18),
      bearingRow(20, -18),
      bearingRow(20, 5),
    ];
    const out = deriveSignature(guesses);
    expect(out.some((s) => s.includes("lean"))).toBe(false);
  });

  it("orders distance, then typical error, then lean", () => {
    const guesses = Array.from({ length: MANY }, () => bearingRow(25, 25, 1.5));
    const out = deriveSignature(guesses);
    expect(out[0]).toContain("distance guesses run long");
    expect(out[1]).toContain("bearings are usually");
    expect(out[2]).toContain("lean right");
  });
});

describe("no improvement claim", () => {
  it("never uses improvement phrasing", () => {
    const guesses = Array.from({ length: MANY }, () => bearingRow(25, 25, 1.5));
    const out = deriveSignature(guesses).join(" ").toLowerCase();
    for (const banned of ["improv", "better", "worse", "progress"]) {
      expect(out).not.toContain(banned);
    }
  });
});
