// Heading capability detection. Figures out whether this device can give a
// trustworthy compass heading, and how good it is, without ever hanging: every
// path is time-bounded and resolves to a typed state.

export type HeadingSource = "ios_compass" | "android_absolute" | "none";

export type HeadingCapability =
  | {
      state: "compass_ok";
      source: "ios_compass" | "android_absolute";
      accuracyDeg: number;
    }
  | {
      state: "compass_unreliable";
      source: "ios_compass" | "android_absolute";
      accuracyDeg: number | null;
    }
  | { state: "absent"; source: "none" };

export type GuessMode = "bearing" | "distance_only";

// iOS webkitCompassAccuracy at or below this (and above 0) is trustworthy.
// A value of -1 or 0 means uncalibrated; above this is too noisy to trust.
export const COMPASS_OK_MAX_ACCURACY_DEG = 25;

// Android exposes no per-reading accuracy. An absolute-heading device reports
// this conservative floor as its accuracyDeg.
export const ANDROID_ABSOLUTE_ACCURACY_FLOOR_DEG = 15;

// If no usable orientation event arrives within this window, resolve to absent.
// Never wait longer: a magnetometer that will not answer must not stall the app.
export const HEADING_DETECT_TIMEOUT_MS = 2500;

type OrientationEventLike = DeviceOrientationEvent & {
  webkitCompassHeading?: number;
  webkitCompassAccuracy?: number;
};

// iOS 13+ gates DeviceOrientationEvent behind a permission prompt. This is true
// only when that prompt API exists. No side effects.
export function needsHeadingPermission(): boolean {
  return (
    typeof DeviceOrientationEvent !== "undefined" &&
    typeof (
      DeviceOrientationEvent as unknown as {
        requestPermission?: unknown;
      }
    ).requestPermission === "function"
  );
}

// MUST be called from a user gesture. Resolves 'unsupported' when the prompt API
// is absent (Android and desktop need no prompt). Never throws: a rejected or
// thrown prompt resolves 'denied'.
export async function requestHeadingPermission(): Promise<
  "granted" | "denied" | "unsupported"
> {
  if (!needsHeadingPermission()) return "unsupported";
  try {
    const request = (
      DeviceOrientationEvent as unknown as {
        requestPermission: () => Promise<"granted" | "denied">;
      }
    ).requestPermission;
    const result = await request();
    return result === "granted" ? "granted" : "denied";
  } catch {
    return "denied";
  }
}

function classifyIos(event: OrientationEventLike): HeadingCapability {
  const accuracy = event.webkitCompassAccuracy;
  const acc = typeof accuracy === "number" ? accuracy : -1;
  if (acc > 0 && acc <= COMPASS_OK_MAX_ACCURACY_DEG) {
    return { state: "compass_ok", source: "ios_compass", accuracyDeg: acc };
  }
  return {
    state: "compass_unreliable",
    source: "ios_compass",
    accuracyDeg: acc > 0 ? acc : null,
  };
}

// Subscribes to a single orientation event, classifies it, unsubscribes, and
// resolves. Always resolves (never rejects) within HEADING_DETECT_TIMEOUT_MS.
export function detectHeadingCapability(): Promise<HeadingCapability> {
  return new Promise((resolve) => {
    const canListen =
      typeof window !== "undefined" &&
      typeof window.addEventListener === "function" &&
      typeof DeviceOrientationEvent !== "undefined";

    if (!canListen) {
      resolve({ state: "absent", source: "none" });
      return;
    }

    let settled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const cleanup = () => {
      window.removeEventListener("deviceorientationabsolute", onAbsolute);
      window.removeEventListener("deviceorientation", onRelative);
      if (timer !== undefined) clearTimeout(timer);
    };

    const settle = (cap: HeadingCapability) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(cap);
    };

    const onAbsolute = (raw: Event) => {
      const event = raw as OrientationEventLike;
      // Prefer the iOS branch when a webkit compass heading is present.
      if (typeof event.webkitCompassHeading === "number") {
        settle(classifyIos(event));
        return;
      }
      if (event.absolute === true && typeof event.alpha === "number") {
        settle({
          state: "compass_ok",
          source: "android_absolute",
          accuracyDeg: ANDROID_ABSOLUTE_ACCURACY_FLOOR_DEG,
        });
      }
      // A non-absolute event on this channel is ignored; the relative listener
      // or the timeout handles it.
    };

    const onRelative = (raw: Event) => {
      const event = raw as OrientationEventLike;
      if (typeof event.webkitCompassHeading === "number") {
        settle(classifyIos(event));
        return;
      }
      if (event.absolute === true && typeof event.alpha === "number") {
        settle({
          state: "compass_ok",
          source: "android_absolute",
          accuracyDeg: ANDROID_ABSOLUTE_ACCURACY_FLOOR_DEG,
        });
        return;
      }
      if (typeof event.alpha === "number") {
        // Relative heading only. It drifts, so it is not trustworthy.
        settle({
          state: "compass_unreliable",
          source: "android_absolute",
          accuracyDeg: null,
        });
      }
    };

    try {
      window.addEventListener("deviceorientationabsolute", onAbsolute);
      window.addEventListener("deviceorientation", onRelative);
    } catch {
      settle({ state: "absent", source: "none" });
      return;
    }

    timer = setTimeout(() => {
      settle({ state: "absent", source: "none" });
    }, HEADING_DETECT_TIMEOUT_MS);
  });
}

// The single decision point later epics call to choose the flow. Pure.
export function guessModeFor(cap: HeadingCapability): GuessMode {
  return cap.state === "compass_ok" ? "bearing" : "distance_only";
}
