// Pure great-circle math for the guess-and-reveal loop. No I/O, no side effects.
// Coordinates are degrees.

export type Coord = { lat: number; lng: number };

const EARTH_RADIUS_M = 6_371_000;

const toRad = (deg: number): number => (deg * Math.PI) / 180;
const toDeg = (rad: number): number => (rad * 180) / Math.PI;

// Great-circle initial bearing from `from` toward `to`, normalized to [0, 360).
export function initialBearingDeg(from: Coord, to: Coord): number {
  const phi1 = toRad(from.lat);
  const phi2 = toRad(to.lat);
  const dLambda = toRad(to.lng - from.lng);

  const y = Math.sin(dLambda) * Math.cos(phi2);
  const x =
    Math.cos(phi1) * Math.sin(phi2) -
    Math.sin(phi1) * Math.cos(phi2) * Math.cos(dLambda);

  const bearing = toDeg(Math.atan2(y, x));
  return (bearing + 360) % 360;
}

// Great-circle distance in meters (haversine).
export function haversineDistanceM(from: Coord, to: Coord): number {
  const phi1 = toRad(from.lat);
  const phi2 = toRad(to.lat);
  const dPhi = toRad(to.lat - from.lat);
  const dLambda = toRad(to.lng - from.lng);

  const a =
    Math.sin(dPhi / 2) * Math.sin(dPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLambda / 2) * Math.sin(dLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_M * c;
}

// Smallest absolute angular difference in [0, 180]. Handles wraparound so that
// 350 and 10 are 20 apart.
export function bearingErrorDeg(guessDeg: number, trueDeg: number): number {
  const raw = Math.abs(guessDeg - trueDeg) % 360;
  return raw > 180 ? 360 - raw : raw;
}

// Ratio of the guessed distance to the true distance.
export function distanceRatio(guessM: number, trueM: number): number {
  return guessM / trueM;
}

const EIGHT_POINTS = [
  "north",
  "northeast",
  "east",
  "southeast",
  "south",
  "southwest",
  "west",
  "northwest",
] as const;

// Nearest of eight compass points as a lowercase word. Each point owns a 45°
// sector centered on it; north spans 337.5-360 and 0-22.5.
export function compassPoint8(deg: number): string {
  const normalized = ((deg % 360) + 360) % 360;
  const index = Math.round(normalized / 45) % 8;
  return EIGHT_POINTS[index];
}
