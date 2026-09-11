import { useState } from "react";
import {
  detectHeadingCapability,
  guessModeFor,
  needsHeadingPermission,
  requestHeadingPermission,
  type GuessMode,
  type HeadingCapability,
} from "../sensors/heading";
import styles from "./Landing.module.css";

type Phase = "idle" | "checking" | "result";

function resultCopy(cap: HeadingCapability): string {
  switch (cap.state) {
    case "compass_ok":
      return `Compass ready. Readings land within about ${cap.accuracyDeg}°.`;
    case "compass_unreliable":
      return "Compass readings look unsteady here. You will measure by distance.";
    case "absent":
      return "This device has no compass. You will measure by distance.";
  }
}

function modeLabel(mode: GuessMode): string {
  return mode === "bearing" ? "Direction and distance" : "Distance only";
}

export function Landing() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [capability, setCapability] = useState<HeadingCapability | null>(null);

  const checking = phase === "checking";

  async function handleCheck() {
    // Synchronous state change gives the button immediate feedback.
    setPhase("checking");
    setCapability(null);

    if (needsHeadingPermission()) {
      await requestHeadingPermission();
    }
    const cap = await detectHeadingCapability();

    setCapability(cap);
    setPhase("result");
  }

  return (
    <section className={styles.landing}>
      <h1 className={styles.title}>The Inner Compass</h1>
      <p className={styles.tagline}>
        Find out how well you know which way things really are.
      </p>

      <button
        type="button"
        className={styles.primary}
        onClick={handleCheck}
        disabled={checking}
        aria-busy={checking}
      >
        {checking ? "Checking your compass…" : "Check my compass"}
      </button>

      {/* Status region always reserves space so the layout holds steady. */}
      <div className={styles.status} aria-live="polite">
        {checking && (
          <p className={styles.statusText}>Checking your compass…</p>
        )}
        {phase === "result" && capability && (
          <div
            className={styles.resultCard}
            data-mode={guessModeFor(capability)}
          >
            <p className={styles.statusText}>{resultCopy(capability)}</p>
            <p className={styles.mode}>{modeLabel(guessModeFor(capability))}</p>
          </div>
        )}
      </div>
    </section>
  );
}
