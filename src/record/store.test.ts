import { afterEach, describe, expect, it } from "vitest";
import {
  MAX_STORED_GUESSES,
  SCHEMA_VERSION,
  appendGuess,
  clearGuesses,
  loadGuesses,
  replaceGuesses,
  type StoredGuess,
} from "./store";

const STORAGE_KEY = "ic_guesses_v1";

function makeRow(overrides: Partial<StoredGuess> = {}): StoredGuess {
  return {
    id: `id-${Math.random()}`,
    timestamp: 1_000,
    targetKind: "walk_start",
    mode: "bearing",
    guessedBearingDeg: 90,
    trueBearingDeg: 100,
    bearingErrorDeg: 10,
    signedBearingErrorDeg: -10,
    guessedDistanceM: 200,
    trueDistanceM: 180,
    distanceRatio: 200 / 180,
    headingAccuracyDeg: 12,
    nudgeIndex: 0,
    ...overrides,
  };
}

afterEach(() => {
  localStorage.clear();
});

describe("store constants", () => {
  it("exposes the schema version and the storage cap", () => {
    expect(SCHEMA_VERSION).toBe(1);
    expect(MAX_STORED_GUESSES).toBe(2000);
  });
});

describe("appendGuess and loadGuesses", () => {
  it("persists a row that a fresh load returns (survives a reload)", () => {
    const row = makeRow({ id: "keep-me" });
    appendGuess(row);

    // A separate load reading the same localStorage is the reload proof.
    const reloaded = loadGuesses();
    expect(reloaded).toHaveLength(1);
    expect(reloaded[0]).toEqual(row);
  });

  it("keeps the most recent rows and drops the oldest past the cap", () => {
    // Pre-seed a full record, then append past the cap on the write path.
    const seed = Array.from({ length: MAX_STORED_GUESSES }, (_, i) =>
      makeRow({ id: `row-${i}`, timestamp: i }),
    );
    replaceGuesses(seed);
    for (let i = 0; i < 5; i += 1) {
      appendGuess(
        makeRow({
          id: `row-${MAX_STORED_GUESSES + i}`,
          timestamp: MAX_STORED_GUESSES + i,
        }),
      );
    }
    const stored = loadGuesses();
    expect(stored).toHaveLength(MAX_STORED_GUESSES);
    // The first five rows were dropped; the newest is last.
    expect(stored[0].id).toBe("row-5");
    expect(stored[stored.length - 1].id).toBe(`row-${MAX_STORED_GUESSES + 4}`);
  });
});

describe("loadGuesses defensiveness", () => {
  it("returns [] when the key is absent", () => {
    expect(loadGuesses()).toEqual([]);
  });

  it("returns [] on non-JSON without throwing", () => {
    localStorage.setItem(STORAGE_KEY, "not json{");
    expect(loadGuesses()).toEqual([]);
  });

  it("returns [] on a non-array value", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ nope: true }));
    expect(loadGuesses()).toEqual([]);
  });

  it("filters out malformed rows so one bad row cannot poison the screen", () => {
    const good = makeRow({ id: "good" });
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([good, { id: "bad", timestamp: "nope" }]),
    );
    const stored = loadGuesses();
    expect(stored).toHaveLength(1);
    expect(stored[0].id).toBe("good");
  });
});

describe("replaceGuesses and clearGuesses", () => {
  it("writes and returns the given array, applying the cap", () => {
    const rows = Array.from({ length: MAX_STORED_GUESSES + 3 }, (_, i) =>
      makeRow({ id: `r-${i}`, timestamp: i }),
    );
    const written = replaceGuesses(rows);
    expect(written).toHaveLength(MAX_STORED_GUESSES);
    expect(loadGuesses()).toHaveLength(MAX_STORED_GUESSES);
    expect(written[0].id).toBe("r-3");
  });

  it("clears the record", () => {
    appendGuess(makeRow());
    clearGuesses();
    expect(loadGuesses()).toEqual([]);
  });
});
