import { afterEach, describe, expect, it, vi } from "vitest";
import { getPositionOnce } from "./geolocation";

// GeolocationPositionError code constants (per the W3C spec).
const PERMISSION_DENIED = 1;
const POSITION_UNAVAILABLE = 2;
const TIMEOUT = 3;

function setGeolocation(value: unknown) {
  Object.defineProperty(navigator, "geolocation", {
    value,
    configurable: true,
    writable: true,
  });
}

afterEach(() => {
  // Restore to a benign stub so other suites are unaffected.
  setGeolocation(undefined);
  vi.restoreAllMocks();
});

describe("getPositionOnce", () => {
  it("resolves ok with mapped fields on success", async () => {
    setGeolocation({
      getCurrentPosition: (success: PositionCallback) => {
        success({
          coords: {
            latitude: 51.5,
            longitude: -0.12,
            accuracy: 12,
          },
          timestamp: 1_700_000_000_000,
        } as GeolocationPosition);
      },
    });

    await expect(getPositionOnce()).resolves.toEqual({
      ok: true,
      lat: 51.5,
      lng: -0.12,
      accuracyM: 12,
      timestamp: 1_700_000_000_000,
    });
  });

  it("maps PERMISSION_DENIED", async () => {
    setGeolocation({
      getCurrentPosition: (_s: PositionCallback, error: PositionErrorCallback) => {
        error({
          code: PERMISSION_DENIED,
          PERMISSION_DENIED,
          POSITION_UNAVAILABLE,
          TIMEOUT,
        } as GeolocationPositionError);
      },
    });
    await expect(getPositionOnce()).resolves.toEqual({
      ok: false,
      reason: "permission_denied",
    });
  });

  it("maps TIMEOUT", async () => {
    setGeolocation({
      getCurrentPosition: (_s: PositionCallback, error: PositionErrorCallback) => {
        error({
          code: TIMEOUT,
          PERMISSION_DENIED,
          POSITION_UNAVAILABLE,
          TIMEOUT,
        } as GeolocationPositionError);
      },
    });
    await expect(getPositionOnce()).resolves.toEqual({
      ok: false,
      reason: "timeout",
    });
  });

  it("maps POSITION_UNAVAILABLE", async () => {
    setGeolocation({
      getCurrentPosition: (_s: PositionCallback, error: PositionErrorCallback) => {
        error({
          code: POSITION_UNAVAILABLE,
          PERMISSION_DENIED,
          POSITION_UNAVAILABLE,
          TIMEOUT,
        } as GeolocationPositionError);
      },
    });
    await expect(getPositionOnce()).resolves.toEqual({
      ok: false,
      reason: "unavailable",
    });
  });

  it("returns unsupported when navigator.geolocation is absent", async () => {
    setGeolocation(undefined);
    await expect(getPositionOnce()).resolves.toEqual({
      ok: false,
      reason: "unsupported",
    });
  });

  it("never rejects even if getCurrentPosition throws", async () => {
    setGeolocation({
      getCurrentPosition: () => {
        throw new Error("boom");
      },
    });
    await expect(getPositionOnce()).resolves.toEqual({
      ok: false,
      reason: "unavailable",
    });
  });

  it("passes the requested timeout through to the browser API", async () => {
    const spy = vi.fn((success: PositionCallback) => {
      success({
        coords: { latitude: 1, longitude: 2, accuracy: 3 },
        timestamp: 10,
      } as GeolocationPosition);
    });
    setGeolocation({ getCurrentPosition: spy });

    await getPositionOnce({ timeoutMs: 4321 });
    expect(spy).toHaveBeenCalledWith(
      expect.any(Function),
      expect.any(Function),
      expect.objectContaining({
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 4321,
      }),
    );
  });
});
