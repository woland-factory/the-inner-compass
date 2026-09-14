// Pure serialize / parse for export and import. The DOM download and file-read
// wiring stays in the component; this module holds the format and validation so
// it is unit-testable. parseRecord is the input-validation boundary for
// imported data.

import { SCHEMA_VERSION, type StoredGuess } from "./store";

export type RecordFile = {
  schemaVersion: number;
  exportedAt: string;
  guesses: StoredGuess[];
};

export function serializeRecord(
  guesses: StoredGuess[],
  exportedAt: string,
): string {
  const file: RecordFile = {
    schemaVersion: SCHEMA_VERSION,
    exportedAt,
    guesses,
  };
  return JSON.stringify(file, null, 2);
}

function isValidRow(row: unknown): row is StoredGuess {
  if (typeof row !== "object" || row === null) return false;
  const r = row as Record<string, unknown>;
  return (
    typeof r.id === "string" &&
    typeof r.timestamp === "number" &&
    (r.targetKind === "home" || r.targetKind === "walk_start") &&
    (r.mode === "bearing" || r.mode === "distance_only") &&
    (typeof r.guessedBearingDeg === "number" || r.guessedBearingDeg === null) &&
    typeof r.trueBearingDeg === "number" &&
    (typeof r.bearingErrorDeg === "number" || r.bearingErrorDeg === null) &&
    (typeof r.signedBearingErrorDeg === "number" ||
      r.signedBearingErrorDeg === null) &&
    typeof r.guessedDistanceM === "number" &&
    typeof r.trueDistanceM === "number" &&
    typeof r.distanceRatio === "number" &&
    (typeof r.headingAccuracyDeg === "number" ||
      r.headingAccuracyDeg === null) &&
    typeof r.nudgeIndex === "number"
  );
}

export type ParseResult =
  | { ok: true; guesses: StoredGuess[] }
  | { ok: false; reason: "unreadable" | "wrong_format" };

export function parseRecord(text: string): ParseResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, reason: "unreadable" };
  }

  if (typeof parsed !== "object" || parsed === null) {
    return { ok: false, reason: "wrong_format" };
  }
  const file = parsed as Record<string, unknown>;
  if (file.schemaVersion !== SCHEMA_VERSION || !Array.isArray(file.guesses)) {
    return { ok: false, reason: "wrong_format" };
  }
  if (!file.guesses.every(isValidRow)) {
    return { ok: false, reason: "wrong_format" };
  }

  return { ok: true, guesses: file.guesses };
}
