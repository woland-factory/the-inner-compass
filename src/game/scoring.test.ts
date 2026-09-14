import { describe, expect, it } from "vitest";
import {
  describeBearing,
  describeDistance,
  formatDistance,
  isMeasurable,
  MIN_MEASURABLE_M,
} from "./scoring";

describe("describeBearing", () => {
  it("buckets errors at the sector boundaries", () => {
    expect(describeBearing(0, 15).bucket).toBe("Dead on");
    expect(describeBearing(22.5, 15).bucket).toBe("Dead on");
    expect(describeBearing(22.6, 15).bucket).toBe("Close");
    expect(describeBearing(45, 15).bucket).toBe("Close");
    expect(describeBearing(45.1, 15).bucket).toBe("Off by a bit");
    expect(describeBearing(90, 15).bucket).toBe("Off by a bit");
    expect(describeBearing(90.1, 15).bucket).toBe("Well off");
    expect(describeBearing(135, 15).bucket).toBe("Well off");
    expect(describeBearing(135.1, 15).bucket).toBe("Turned around");
    expect(describeBearing(180, 15).bucket).toBe("Turned around");
  });

  it("sets withinFloor at and past the floor", () => {
    expect(describeBearing(15, 15).withinFloor).toBe(true);
    expect(describeBearing(14, 15).withinFloor).toBe(true);
    expect(describeBearing(16, 15).withinFloor).toBe(false);
  });

  it("carries the raw error and floor through", () => {
    const r = describeBearing(30, 15);
    expect(r.errorDeg).toBe(30);
    expect(r.floorDeg).toBe(15);
  });
});

describe("describeDistance", () => {
  it("marks spot_on inside the 0.8 to 1.25 band", () => {
    expect(describeDistance(80, 100).verdict).toBe("spot_on");
    expect(describeDistance(125, 100).verdict).toBe("spot_on");
    expect(describeDistance(100, 100).verdict).toBe("spot_on");
  });

  it("marks short below 0.8 and long above 1.25", () => {
    expect(describeDistance(79, 100).verdict).toBe("short");
    expect(describeDistance(126, 100).verdict).toBe("long");
  });

  it("returns the ratio", () => {
    expect(describeDistance(200, 100).ratio).toBe(2);
  });
});

describe("isMeasurable", () => {
  it("is false at or below max(MIN, 2*accuracy)", () => {
    // accuracy small: MIN dominates.
    expect(isMeasurable(MIN_MEASURABLE_M - 1, 5)).toBe(false);
    expect(isMeasurable(MIN_MEASURABLE_M, 5)).toBe(true);
    // accuracy large: 2*accuracy dominates.
    expect(isMeasurable(40, 30)).toBe(false); // needs >= 60
    expect(isMeasurable(60, 30)).toBe(true);
  });
});

describe("formatDistance", () => {
  it("uses meters under 1000", () => {
    expect(formatDistance(320)).toBe("320 m");
    expect(formatDistance(999)).toBe("999 m");
  });

  it("switches to kilometers at 1000", () => {
    expect(formatDistance(1000)).toBe("1.0 km");
    expect(formatDistance(1400)).toBe("1.4 km");
  });
});
