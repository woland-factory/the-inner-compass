import { afterEach, describe, expect, it, vi } from "vitest";
import { headingFromEvent, subscribeHeading } from "./liveHeading";

function makeEvent(type: string, props: Record<string, unknown>): Event {
  const event = new Event(type);
  Object.assign(event, props);
  return event;
}

describe("headingFromEvent", () => {
  it("reads webkitCompassHeading for ios_compass", () => {
    expect(
      headingFromEvent(
        "ios_compass",
        makeEvent("deviceorientation", { webkitCompassHeading: 123 }) as never,
      ),
    ).toBe(123);
  });

  it("returns null for ios_compass without a webkit heading", () => {
    expect(
      headingFromEvent(
        "ios_compass",
        makeEvent("deviceorientation", { alpha: 90 }) as never,
      ),
    ).toBeNull();
  });

  it("maps android_absolute alpha to (360 - alpha) mod 360", () => {
    expect(
      headingFromEvent(
        "android_absolute",
        makeEvent("deviceorientationabsolute", { alpha: 90 }) as never,
      ),
    ).toBe(270);
    expect(
      headingFromEvent(
        "android_absolute",
        makeEvent("deviceorientationabsolute", { alpha: 0 }) as never,
      ),
    ).toBe(0);
  });

  it("returns null for android_absolute without alpha", () => {
    expect(
      headingFromEvent(
        "android_absolute",
        makeEvent("deviceorientationabsolute", {}) as never,
      ),
    ).toBeNull();
  });

  it("returns null for source none", () => {
    expect(
      headingFromEvent(
        "none",
        makeEvent("deviceorientation", { webkitCompassHeading: 10 }) as never,
      ),
    ).toBeNull();
  });
});

describe("subscribeHeading", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("forwards mapped iOS readings and unsubscribes", () => {
    const cb = vi.fn();
    const unsubscribe = subscribeHeading("ios_compass", cb);

    window.dispatchEvent(
      makeEvent("deviceorientation", { webkitCompassHeading: 42 }),
    );
    expect(cb).toHaveBeenCalledWith(42);

    // Unusable event is dropped.
    window.dispatchEvent(makeEvent("deviceorientation", { alpha: 5 }));
    expect(cb).toHaveBeenCalledTimes(1);

    unsubscribe();
    window.dispatchEvent(
      makeEvent("deviceorientation", { webkitCompassHeading: 99 }),
    );
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it("listens on the absolute channel for android_absolute", () => {
    const cb = vi.fn();
    const unsubscribe = subscribeHeading("android_absolute", cb);

    window.dispatchEvent(
      makeEvent("deviceorientationabsolute", { alpha: 90 }),
    );
    expect(cb).toHaveBeenCalledWith(270);

    unsubscribe();
  });

  it("subscribes to nothing for source none", () => {
    const cb = vi.fn();
    const unsubscribe = subscribeHeading("none", cb);
    window.dispatchEvent(
      makeEvent("deviceorientation", { webkitCompassHeading: 10 }),
    );
    expect(cb).not.toHaveBeenCalled();
    expect(() => unsubscribe()).not.toThrow();
  });
});
