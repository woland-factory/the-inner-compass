// Single-fix geolocation wrapper. Always resolves within the timeout, never
// rejects, never throws. Later epics build the reveal on this proven module.

export type GeoResult =
  | {
      ok: true;
      lat: number;
      lng: number;
      accuracyM: number;
      timestamp: number;
    }
  | {
      ok: false;
      reason: "permission_denied" | "timeout" | "unavailable" | "unsupported";
    };

export const GEO_TIMEOUT_MS = 10000;

export function getPositionOnce(opts?: {
  timeoutMs?: number;
}): Promise<GeoResult> {
  const timeout = opts?.timeoutMs ?? GEO_TIMEOUT_MS;

  return new Promise((resolve) => {
    const geo =
      typeof navigator !== "undefined" ? navigator.geolocation : undefined;

    if (!geo || typeof geo.getCurrentPosition !== "function") {
      resolve({ ok: false, reason: "unsupported" });
      return;
    }

    let settled = false;
    const settle = (result: GeoResult) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };

    try {
      geo.getCurrentPosition(
        (pos) => {
          settle({
            ok: true,
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracyM: pos.coords.accuracy,
            timestamp: pos.timestamp,
          });
        },
        (err) => {
          if (err.code === err.PERMISSION_DENIED) {
            settle({ ok: false, reason: "permission_denied" });
          } else if (err.code === err.TIMEOUT) {
            settle({ ok: false, reason: "timeout" });
          } else {
            settle({ ok: false, reason: "unavailable" });
          }
        },
        { enableHighAccuracy: true, maximumAge: 0, timeout },
      );
    } catch {
      settle({ ok: false, reason: "unavailable" });
    }
  });
}
