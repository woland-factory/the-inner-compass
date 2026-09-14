// Turns the record into a small set of plain, honest sentences. Pure, no I/O.
// Every statement is derived only from the user's own rows. Nothing here claims
// the user is improving; trajectory belongs to the chart.

import type { StoredGuess } from "./store";

export const SIGNATURE_MIN_GUESSES = 5;

function median(nums: number[]): number {
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}

export function deriveSignature(guesses: StoredGuess[]): string[] {
  if (guesses.length < SIGNATURE_MIN_GUESSES) return [];

  const statements: string[] = [];

  // Distance calibration first: distance is the hero metric.
  const m = median(guesses.map((g) => g.distanceRatio));
  if (m > 1.25) {
    statements.push(
      `Your distance guesses run long, about ${m.toFixed(1)}× the real distance.`,
    );
  } else if (m < 0.8) {
    statements.push(
      `Your distance guesses run short, about ${m.toFixed(1)}× the real distance.`,
    );
  } else {
    statements.push("Your distance guesses land close to the real distance.");
  }

  // Bearing typical error, only with enough bearing-mode guesses.
  const bearingGuesses = guesses.filter(
    (g) => g.mode === "bearing" && g.bearingErrorDeg !== null,
  );
  if (bearingGuesses.length >= SIGNATURE_MIN_GUESSES) {
    const e = median(bearingGuesses.map((g) => g.bearingErrorDeg as number));
    statements.push(`Your bearings are usually about ${Math.round(e)}° off.`);

    // Bearing lean, only when it is a real lean and not noise.
    const signed = bearingGuesses
      .map((g) => g.signedBearingErrorDeg)
      .filter((s): s is number => s !== null);
    if (signed.length > 0) {
      const s = median(signed);
      const agree =
        signed.filter((v) => (v >= 0 ? s >= 0 : s < 0)).length / signed.length;
      if (Math.abs(s) >= 15 && agree >= 0.6) {
        statements.push(`You lean ${s > 0 ? "right" : "left"} of true.`);
      }
    }
  }

  return statements;
}
