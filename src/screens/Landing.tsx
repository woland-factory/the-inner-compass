import { useState } from "react";
import { Link } from "react-router-dom";
import { computeSampleReveal } from "../game/sampleGuess";
import { RevealMeasurement } from "./RevealMeasurement";
import styles from "./Landing.module.css";

export function Landing() {
  const [showSample, setShowSample] = useState(false);

  return (
    <section className={styles.landing}>
      <h1 className={styles.title}>The Inner Compass</h1>
      <p className={styles.tagline}>
        Find out how well you know which way things really are.
      </p>

      <Link to="/guess" className={styles.primary}>
        Start a walk
      </Link>

      {showSample ? <SamplePanel /> : (
        <button
          type="button"
          className={styles.sampleButton}
          onClick={() => setShowSample(true)}
        >
          Try a sample guess
        </button>
      )}
    </section>
  );
}

// A read-only render of built-in demo data, scored by the real engine. It
// never touches the record or the walkthrough flag.
function SamplePanel() {
  const sample = computeSampleReveal();

  return (
    <div className={styles.resultCard}>
      <h2 className={styles.sampleHeading}>A sample guess</h2>
      <p className={styles.sampleIntro}>
        Here is a real guess scored against the truth.
      </p>
      <RevealMeasurement
        bearing={sample.bearing}
        directionWord={sample.directionWord}
        guessedDistanceM={sample.guessedDistanceM}
        trueDistanceM={sample.trueDistanceM}
        showCompassCaption={false}
        headingLevel="h3"
      />
      <p className={styles.sampleClose}>Now measure your own.</p>
    </div>
  );
}
