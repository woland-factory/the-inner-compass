// Thin, synchronous, defensive localStorage access for the guess record. Every
// read tolerates absent or corrupt storage by returning an empty record, and a
// blocked or throwing storage never crashes the app.

export const SCHEMA_VERSION = 1;

// Bounds the write path: keep at most this many rows so parse cost and storage
// size never grow without limit. Generous (years of daily walks); export is the
// archival path for a heavier user.
export const MAX_STORED_GUESSES = 2000;

const STORAGE_KEY = "ic_guesses_v1";

export type StoredGuess = {
  id: string;
  timestamp: number;
  targetKind: "home" | "walk_start";
  mode: "bearing" | "distance_only";
  guessedBearingDeg: number | null;
  trueBearingDeg: number;
  bearingErrorDeg: number | null;
  signedBearingErrorDeg: number | null;
  guessedDistanceM: number;
  trueDistanceM: number;
  distanceRatio: number;
  headingAccuracyDeg: number | null;
  nudgeIndex: number;
};

let idCounter = 0;

// Stable unique id: crypto.randomUUID when available, else a monotonic fallback.
export function makeGuessId(timestamp: number): string {
  try {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
      return crypto.randomUUID();
    }
  } catch {
    // Fall through to the counter-based id.
  }
  idCounter += 1;
  return `g-${timestamp}-${idCounter}`;
}

// A minimal shape check so one bad row cannot poison the whole screen.
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

function cap(guesses: StoredGuess[]): StoredGuess[] {
  if (guesses.length <= MAX_STORED_GUESSES) return guesses;
  return guesses.slice(guesses.length - MAX_STORED_GUESSES);
}

export function loadGuesses(): StoredGuess[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValidRow);
  } catch {
    return [];
  }
}

function write(guesses: StoredGuess[]): StoredGuess[] {
  const bounded = cap(guesses);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(bounded));
  } catch {
    // A blocked or full storage never breaks the caller.
  }
  return bounded;
}

export function appendGuess(g: StoredGuess): StoredGuess[] {
  const next = loadGuesses();
  next.push(g);
  return write(next);
}

export function replaceGuesses(gs: StoredGuess[]): StoredGuess[] {
  return write(gs.slice());
}

export function clearGuesses(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to do if storage is unavailable.
  }
}
