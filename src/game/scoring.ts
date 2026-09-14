// Turns raw geo math into honest, floor-aware display data. Pure. Never invents
// precision the compass cannot support and never flatters the user.

import { distanceRatio } from "./geoMath";

export type BearingBucket =
  | "Dead on"
  | "Close"
  | "Off by a bit"
  | "Well off"
  | "Turned around";

// Buckets by absolute bearing error in degrees, aligned to the 45 degree sectors.
export function bearingBucket(errorDeg: number): BearingBucket {
  if (errorDeg <= 22.5) return "Dead on";
  if (errorDeg <= 45) return "Close";
  if (errorDeg <= 90) return "Off by a bit";
  if (errorDeg <= 135) return "Well off";
  return "Turned around";
}

export type BearingResult = {
  bucket: BearingBucket;
  withinFloor: boolean;
  errorDeg: number;
  floorDeg: number;
};

// The bucket is always the raw error. `withinFloor` lets the component swap a
// false-precision sub-floor number for the honest margin caption.
export function describeBearing(
  errorDeg: number,
  floorDeg: number,
): BearingResult {
  return {
    bucket: bearingBucket(errorDeg),
    withinFloor: errorDeg <= floorDeg,
    errorDeg,
    floorDeg,
  };
}

export type DistanceVerdict = "spot_on" | "short" | "long";

export type DistanceResult = {
  ratio: number;
  verdict: DistanceVerdict;
};

export function describeDistance(guessM: number, trueM: number): DistanceResult {
  const ratio = distanceRatio(guessM, trueM);
  let verdict: DistanceVerdict;
  if (ratio < 0.8) verdict = "short";
  else if (ratio > 1.25) verdict = "long";
  else verdict = "spot_on";
  return { ratio, verdict };
}

// Below this, or within twice the GPS accuracy, bearing and ratio are noise.
export const MIN_MEASURABLE_M = 25;

// True only when the true distance clears both the minimum and twice the fix
// accuracy. Guards the standing-still case and divide-by-zero.
export function isMeasurable(trueM: number, accuracyM: number): boolean {
  return trueM >= Math.max(MIN_MEASURABLE_M, 2 * accuracyM);
}

// Meters under 1000 ("320 m"), kilometers at or above ("1.4 km", one decimal).
export function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }
  return `${(meters / 1000).toFixed(1)} km`;
}
