// The landing's built-in sample: one fixed scenario scored by the real engine
// so a visitor sees a true, non-zero measurement before their first walk.
// Pure and stateless. Nothing here reads sensors or touches storage.

import {
  bearingErrorDeg,
  compassPoint8,
  haversineDistanceM,
  initialBearingDeg,
} from "./geoMath";
import {
  describeBearing,
  describeDistance,
  isMeasurable,
  type BearingResult,
  type DistanceResult,
} from "./scoring";

// A fixed, believable scenario: someone standing at `current` guessed the way
// back to `start`. Coordinates chosen so the truth is clearly non-zero and
// measurable, the bearing error is real but not humiliating, and the distance
// guess is honestly off. These are demo constants, not user data.
export const SAMPLE_GUESS = {
  current: { lat: 40.0, lng: -74.0 }, // where the sample walker is now
  start: { lat: 40.003, lng: -73.996 }, // the spot they are guessing back to
  guessedBearingDeg: 20, // they guessed roughly north-northeast
  guessedDistanceM: 650, // they guessed long
  fixAccuracyM: 8, // a good fix, so the reveal is measurable
  floorDeg: 10, // a decent compass margin
} as const;

export type SampleReveal = {
  directionWord: string;
  bearing: BearingResult;
  guessedDistanceM: number;
  trueDistanceM: number;
  distance: DistanceResult;
  measurable: boolean;
};

export function computeSampleReveal(): SampleReveal {
  const trueBearingDeg = initialBearingDeg(
    SAMPLE_GUESS.current,
    SAMPLE_GUESS.start,
  );
  const trueDistanceM = haversineDistanceM(
    SAMPLE_GUESS.current,
    SAMPLE_GUESS.start,
  );

  return {
    directionWord: compassPoint8(trueBearingDeg),
    bearing: describeBearing(
      bearingErrorDeg(SAMPLE_GUESS.guessedBearingDeg, trueBearingDeg),
      SAMPLE_GUESS.floorDeg,
    ),
    guessedDistanceM: SAMPLE_GUESS.guessedDistanceM,
    trueDistanceM,
    distance: describeDistance(SAMPLE_GUESS.guessedDistanceM, trueDistanceM),
    measurable: isMeasurable(trueDistanceM, SAMPLE_GUESS.fixAccuracyM),
  };
}
