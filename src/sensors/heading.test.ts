import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ANDROID_ABSOLUTE_ACCURACY_FLOOR_DEG,
  detectHeadingCapability,
  guessModeFor,
  HEADING_DETECT_TIMEOUT_MS,
  needsHeadingPermission,
  requestHeadingPermission,
  type HeadingCapability,
} from "./heading";

const g = globalThis as unknown as { DeviceOrientationEvent?: unknown };
const originalDOE = g.DeviceOrientationEvent;

function defineDOE(requestPermission?: unknown) {
  const stub = function () {} as unknown as Record<string, unknown>;
  if (requestPermission !== undefined) {
    stub.requestPermission = requestPermission;
  }
  g.DeviceOrientationEvent = stub;
}

function fireOrientation(type: string, props: Record<string, unknown>) {
  const event = new Event(type);
  Object.assign(event, props);
  window.dispatchEvent(event);
}

afterEach(() => {
  g.DeviceOrientationEvent = originalDOE;
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("needsHeadingPermission", () => {
  it("is true only when requestPermission is a function", () => {
    defineDOE(() => Promise.resolve("granted"));
    expect(needsHeadingPermission()).toBe(true);
  });

  it("is false when requestPermission is absent", () => {
    defineDOE();
    expect(needsHeadingPermission()).toBe(false);
  });

  it("is false when DeviceOrientationEvent is undefined", () => {
    g.DeviceOrientationEvent = undefined;
    expect(needsHeadingPermission()).toBe(false);
  });
});

describe("requestHeadingPermission", () => {
  it("returns 'unsupported' when the prompt API is absent", async () => {
    defineDOE();
    await expect(requestHeadingPermission()).resolves.toBe("unsupported");
  });

  it("returns 'granted' when the prompt resolves granted", async () => {
    defineDOE(() => Promise.resolve("granted"));
    await expect(requestHeadingPermission()).resolves.toBe("granted");
  });

  it("returns 'denied' when the prompt resolves denied", async () => {
    defineDOE(() => Promise.resolve("denied"));
    await expect(requestHeadingPermission()).resolves.toBe("denied");
  });

  it("returns 'denied' and never throws when the prompt rejects", async () => {
    defineDOE(() => Promise.reject(new Error("nope")));
    await expect(requestHeadingPermission()).resolves.toBe("denied");
  });
});

describe("detectHeadingCapability", () => {
  beforeEach(() => {
    defineDOE();
  });

  it("classifies an iOS event with good accuracy as compass_ok", async () => {
    const promise = detectHeadingCapability();
    fireOrientation("deviceorientation", {
      webkitCompassHeading: 90,
      webkitCompassAccuracy: 8,
    });
    await expect(promise).resolves.toEqual({
      state: "compass_ok",
      source: "ios_compass",
      accuracyDeg: 8,
    });
  });

  it("treats webkitCompassAccuracy = 25 as the compass_ok boundary", async () => {
    const promise = detectHeadingCapability();
    fireOrientation("deviceorientation", {
      webkitCompassHeading: 12,
      webkitCompassAccuracy: 25,
    });
    await expect(promise).resolves.toMatchObject({
      state: "compass_ok",
      accuracyDeg: 25,
    });
  });

  it("treats webkitCompassAccuracy = 26 as compass_unreliable", async () => {
    const promise = detectHeadingCapability();
    fireOrientation("deviceorientation", {
      webkitCompassHeading: 12,
      webkitCompassAccuracy: 26,
    });
    await expect(promise).resolves.toEqual({
      state: "compass_unreliable",
      source: "ios_compass",
      accuracyDeg: 26,
    });
  });

  it("treats webkitCompassAccuracy = -1 (uncalibrated) as compass_unreliable with null accuracy", async () => {
    const promise = detectHeadingCapability();
    fireOrientation("deviceorientation", {
      webkitCompassHeading: 0,
      webkitCompassAccuracy: -1,
    });
    await expect(promise).resolves.toEqual({
      state: "compass_unreliable",
      source: "ios_compass",
      accuracyDeg: null,
    });
  });

  it("treats webkitCompassAccuracy = 40 as compass_unreliable", async () => {
    const promise = detectHeadingCapability();
    fireOrientation("deviceorientation", {
      webkitCompassHeading: 0,
      webkitCompassAccuracy: 40,
    });
    await expect(promise).resolves.toEqual({
      state: "compass_unreliable",
      source: "ios_compass",
      accuracyDeg: 40,
    });
  });

  it("classifies an Android absolute event as compass_ok", async () => {
    const promise = detectHeadingCapability();
    fireOrientation("deviceorientationabsolute", {
      absolute: true,
      alpha: 123,
    });
    await expect(promise).resolves.toEqual({
      state: "compass_ok",
      source: "android_absolute",
      accuracyDeg: ANDROID_ABSOLUTE_ACCURACY_FLOOR_DEG,
    });
  });

  it("classifies a relative-only Android event as compass_unreliable", async () => {
    const promise = detectHeadingCapability();
    fireOrientation("deviceorientation", {
      absolute: false,
      alpha: 200,
    });
    await expect(promise).resolves.toEqual({
      state: "compass_unreliable",
      source: "android_absolute",
      accuracyDeg: null,
    });
  });

  it("resolves to absent when no event arrives within the timeout", async () => {
    vi.useFakeTimers();
    const promise = detectHeadingCapability();
    vi.advanceTimersByTime(HEADING_DETECT_TIMEOUT_MS);
    await expect(promise).resolves.toEqual({ state: "absent", source: "none" });
  });

  it("resolves to absent without throwing when DeviceOrientationEvent is undefined", async () => {
    g.DeviceOrientationEvent = undefined;
    await expect(detectHeadingCapability()).resolves.toEqual({
      state: "absent",
      source: "none",
    });
  });
});

describe("guessModeFor", () => {
  it("maps compass_ok to bearing", () => {
    const cap: HeadingCapability = {
      state: "compass_ok",
      source: "ios_compass",
      accuracyDeg: 10,
    };
    expect(guessModeFor(cap)).toBe("bearing");
  });

  it("maps compass_unreliable to distance_only", () => {
    const cap: HeadingCapability = {
      state: "compass_unreliable",
      source: "android_absolute",
      accuracyDeg: null,
    };
    expect(guessModeFor(cap)).toBe("distance_only");
  });

  it("maps absent to distance_only", () => {
    const cap: HeadingCapability = { state: "absent", source: "none" };
    expect(guessModeFor(cap)).toBe("distance_only");
  });
});
