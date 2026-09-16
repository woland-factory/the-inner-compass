// The measurement body of a reveal: bucket headline, direction word, degrees
// off, and the distance comparison. Shared by the live reveal and the landing
// sample so both render the same words from the same engine.

import {
  describeDistance,
  formatDistance,
  type BearingResult,
} from "../game/scoring";
import styles from "./GuessFlow.module.css";

const VERDICT_COPY = {
  spot_on: "Spot on.",
  short: "You guessed short.",
  long: "You guessed long.",
} as const;

export function RevealMeasurement(props: {
  bearing: BearingResult | null;
  directionWord: string;
  guessedDistanceM: number | null;
  trueDistanceM: number;
  showCompassCaption?: boolean;
  headingLevel?: "h1" | "h2" | "h3";
}) {
  const showCompassCaption = props.showCompassCaption ?? true;
  const Heading = props.headingLevel ?? "h1";
  const bearing = props.bearing;
  const distance =
    props.guessedDistanceM !== null
      ? describeDistance(props.guessedDistanceM, props.trueDistanceM)
      : null;

  return (
    <>
      {bearing ? (
        <>
          <Heading className={styles.headline}>{bearing.bucket}</Heading>
          <p className={styles.direction}>It was to the {props.directionWord}.</p>
        </>
      ) : (
        // Distance-only mode has no bucket, so the direction line carries the
        // heading. Same class, same words: only the element changes.
        <Heading className={styles.direction}>
          It was to the {props.directionWord}.
        </Heading>
      )}

      {bearing &&
        (bearing.withinFloor ? (
          <p className={styles.detail}>
            Inside your compass's ±{bearing.floorDeg}° margin.
          </p>
        ) : (
          <p className={styles.detail}>{Math.round(bearing.errorDeg)}° off.</p>
        ))}
      {bearing && showCompassCaption && (
        <p className={styles.caption}>
          Your compass reads to about ±{bearing.floorDeg}°.
        </p>
      )}

      {distance && props.guessedDistanceM !== null && (
        <div className={styles.distanceBlock}>
          <p className={styles.distanceLine}>
            You guessed {formatDistance(props.guessedDistanceM)}. It was{" "}
            {formatDistance(props.trueDistanceM)}.
          </p>
          <p className={styles.verdict}>{VERDICT_COPY[distance.verdict]}</p>
        </div>
      )}
    </>
  );
}
