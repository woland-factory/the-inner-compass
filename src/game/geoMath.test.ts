import { describe, expect, it } from "vitest";
import {
  bearingErrorDeg,
  compassPoint8,
  distanceRatio,
  haversineDistanceM,
  initialBearingDeg,
  signedBearingErrorDeg,
} from "./geoMath";

describe("initialBearingDeg", () => {
  it("points due east along the equator", () => {
    expect(initialBearingDeg({ lat: 0, lng: 0 }, { lat: 0, lng: 1 })).toBeCloseTo(
      90,
      5,
    );
  });

  it("points due north, south, and west from the origin", () => {
    expect(initialBearingDeg({ lat: 0, lng: 0 }, { lat: 1, lng: 0 })).toBeCloseTo(
      0,
      5,
    );
    expect(
      initialBearingDeg({ lat: 0, lng: 0 }, { lat: -1, lng: 0 }),
    ).toBeCloseTo(180, 5);
    expect(
      initialBearingDeg({ lat: 0, lng: 0 }, { lat: 0, lng: -1 }),
    ).toBeCloseTo(270, 5);
  });

  it("is normalized to [0, 360)", () => {
    const b = initialBearingDeg({ lat: 0, lng: 0 }, { lat: 0, lng: -1 });
    expect(b).toBeGreaterThanOrEqual(0);
    expect(b).toBeLessThan(360);
  });

  it("points southeast from London to Paris (initial great-circle bearing ~148 degrees)", () => {
    const london = { lat: 51.5074, lng: -0.1278 };
    const paris = { lat: 48.8566, lng: 2.3522 };
    const b = initialBearingDeg(london, paris);
    // Paris is south and east of London, so the bearing sits between east and
    // south. The exact initial great-circle bearing for these points is ~148.1.
    expect(b).toBeGreaterThan(145);
    expect(b).toBeLessThan(152);
  });
});

describe("haversineDistanceM", () => {
  it("measures one degree of longitude at the equator (~111.2 km)", () => {
    const d = haversineDistanceM({ lat: 0, lng: 0 }, { lat: 0, lng: 1 });
    expect(d).toBeGreaterThan(111_145);
    expect(d).toBeLessThan(111_245);
  });

  it("measures London to Paris (~343 km)", () => {
    const london = { lat: 51.5074, lng: -0.1278 };
    const paris = { lat: 48.8566, lng: 2.3522 };
    const km = haversineDistanceM(london, paris) / 1000;
    expect(km).toBeGreaterThan(340);
    expect(km).toBeLessThan(346);
  });

  it("is zero for identical points", () => {
    expect(haversineDistanceM({ lat: 12, lng: 34 }, { lat: 12, lng: 34 })).toBe(
      0,
    );
  });
});

describe("bearingErrorDeg", () => {
  it("handles wraparound both ways", () => {
    expect(bearingErrorDeg(350, 10)).toBe(20);
    expect(bearingErrorDeg(10, 350)).toBe(20);
  });

  it("caps at 180 for opposite bearings", () => {
    expect(bearingErrorDeg(90, 270)).toBe(180);
  });

  it("is zero for equal bearings", () => {
    expect(bearingErrorDeg(0, 0)).toBe(0);
    expect(bearingErrorDeg(123, 123)).toBe(0);
  });
});

describe("signedBearingErrorDeg", () => {
  it("is positive when the guess sits clockwise of true (right)", () => {
    expect(signedBearingErrorDeg(10, 350)).toBe(20);
  });

  it("is negative when the guess sits counter-clockwise of true (left)", () => {
    expect(signedBearingErrorDeg(350, 10)).toBe(-20);
  });

  it("caps at ±180 for opposite bearings", () => {
    expect(Math.abs(signedBearingErrorDeg(90, 270))).toBe(180);
  });

  it("is zero for equal bearings", () => {
    expect(signedBearingErrorDeg(0, 0)).toBe(0);
    expect(signedBearingErrorDeg(123, 123)).toBe(0);
  });

  it("has a magnitude equal to bearingErrorDeg", () => {
    const pairs: Array<[number, number]> = [
      [10, 350],
      [350, 10],
      [90, 270],
      [45, 200],
      [300, 20],
    ];
    for (const [g, t] of pairs) {
      expect(Math.abs(signedBearingErrorDeg(g, t))).toBeCloseTo(
        bearingErrorDeg(g, t),
        10,
      );
    }
  });
});

describe("distanceRatio", () => {
  it("divides guess by truth", () => {
    expect(distanceRatio(200, 100)).toBe(2);
    expect(distanceRatio(50, 100)).toBe(0.5);
  });
});

describe("compassPoint8", () => {
  const expected: Array<[number, string]> = [
    [0, "north"],
    [45, "northeast"],
    [90, "east"],
    [135, "southeast"],
    [180, "south"],
    [225, "southwest"],
    [270, "west"],
    [315, "northwest"],
    [337.6, "north"],
    [360, "north"],
  ];

  for (const [deg, word] of expected) {
    it(`maps ${deg} to ${word}`, () => {
      expect(compassPoint8(deg)).toBe(word);
    });
  }

  it("keeps the north sector boundaries", () => {
    expect(compassPoint8(22.4)).toBe("north");
    expect(compassPoint8(22.6)).toBe("northeast");
  });
});
