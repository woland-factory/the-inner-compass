import { describe, expect, it } from "vitest";
import { parseRecord, serializeRecord } from "./recordFile";
import type { StoredGuess } from "./store";

const BEARING_ROW: StoredGuess = {
  id: "a",
  timestamp: 100,
  targetKind: "home",
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
};

const DISTANCE_ROW: StoredGuess = {
  id: "b",
  timestamp: 200,
  targetKind: "walk_start",
  mode: "distance_only",
  guessedBearingDeg: null,
  trueBearingDeg: 42,
  bearingErrorDeg: null,
  signedBearingErrorDeg: null,
  guessedDistanceM: 500,
  trueDistanceM: 480,
  distanceRatio: 500 / 480,
  headingAccuracyDeg: null,
  nudgeIndex: 3,
};

describe("serialize / parse round-trip", () => {
  it("is deep-equal for a mixed record", () => {
    const gs = [BEARING_ROW, DISTANCE_ROW];
    const text = serializeRecord(gs, "2026-09-14T00:00:00.000Z");
    const result = parseRecord(text);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.guesses).toEqual(gs);
    }
  });

  it("round-trips an empty record", () => {
    const text = serializeRecord([], "2026-09-14T00:00:00.000Z");
    const result = parseRecord(text);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.guesses).toEqual([]);
  });
});

describe("parseRecord validation", () => {
  it("returns unreadable for non-JSON text without throwing", () => {
    expect(parseRecord("not json{")).toEqual({
      ok: false,
      reason: "unreadable",
    });
  });

  it("returns wrong_format for a valid-JSON object with no guesses", () => {
    expect(parseRecord(JSON.stringify({ schemaVersion: 1 }))).toEqual({
      ok: false,
      reason: "wrong_format",
    });
  });

  it("returns wrong_format for the wrong schema version", () => {
    const text = JSON.stringify({ schemaVersion: 2, guesses: [] });
    expect(parseRecord(text)).toEqual({ ok: false, reason: "wrong_format" });
  });

  it("returns wrong_format when a row is missing required fields", () => {
    const text = JSON.stringify({
      schemaVersion: 1,
      guesses: [{ id: "x", timestamp: 1 }],
    });
    expect(parseRecord(text)).toEqual({ ok: false, reason: "wrong_format" });
  });

  it("returns wrong_format for a top-level array", () => {
    const text = JSON.stringify([BEARING_ROW]);
    expect(parseRecord(text)).toEqual({ ok: false, reason: "wrong_format" });
  });
});
