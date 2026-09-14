import { useEffect, useMemo, useState } from "react";
import {
  detectHeadingCapability,
  guessModeFor,
  needsHeadingPermission,
  requestHeadingPermission,
  ANDROID_ABSOLUTE_ACCURACY_FLOOR_DEG,
  type GuessMode,
  type HeadingCapability,
} from "../sensors/heading";
import { getPositionOnce, type GeoResult } from "../sensors/geolocation";
import { subscribeHeading } from "../sensors/liveHeading";
import {
  bearingErrorDeg,
  compassPoint8,
  haversineDistanceM,
  initialBearingDeg,
} from "../game/geoMath";
import {
  describeBearing,
  describeDistance,
  formatDistance,
  isMeasurable,
} from "../game/scoring";
import { nudgeAt } from "../game/nudges";
import styles from "./GuessFlow.module.css";

type Phase = "setup" | "guess" | "fixing" | "reveal" | "error";
type AnchorKind = "home" | "walk_start";
type GeoReason = Extract<GeoResult, { ok: false }>["reason"];
type Unit = "m" | "km";

type Anchor = { kind: AnchorKind; lat: number; lng: number; accuracyM: number };

const WALKTHROUGH_KEY = "ic_seen_walkthrough";
const MAX_DISTANCE_M = 20_000_000; // ~half the Earth's circumference

const FIX_ERROR_COPY: Record<GeoReason, string> = {
  permission_denied:
    "Location is blocked. Turn it on in your browser, then tap Retry.",
  timeout: "That took too long. Step into the open and tap Retry.",
  unavailable: "Location is not ready yet. Tap Retry.",
  unsupported:
    "This browser cannot share location. Open the app in Safari or Chrome.",
};

const VERDICT_COPY = {
  spot_on: "Spot on.",
  short: "You guessed short.",
  long: "You guessed long.",
} as const;

function parseDistanceM(raw: string, unit: Unit): number | null {
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) return null;
  const meters = unit === "km" ? value * 1000 : value;
  if (meters > MAX_DISTANCE_M) return null;
  return meters;
}

function floorFor(cap: HeadingCapability | null): number {
  if (cap && "accuracyDeg" in cap && cap.accuracyDeg != null) {
    return cap.accuracyDeg;
  }
  return ANDROID_ABSOLUTE_ACCURACY_FLOOR_DEG;
}

function hasSeenWalkthrough(): boolean {
  try {
    return localStorage.getItem(WALKTHROUGH_KEY) === "1";
  } catch {
    return false;
  }
}

function markWalkthroughSeen() {
  try {
    localStorage.setItem(WALKTHROUGH_KEY, "1");
  } catch {
    // A blocked storage never breaks the loop.
  }
}

export function GuessFlow() {
  const [phase, setPhase] = useState<Phase>("setup");
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const [capability, setCapability] = useState<HeadingCapability | null>(null);
  const [guessMode, setGuessMode] = useState<GuessMode>("bearing");

  const [anchorLoading, setAnchorLoading] = useState(false);
  const [anchorError, setAnchorError] = useState<GeoReason | null>(null);
  const [pendingKind, setPendingKind] = useState<AnchorKind>("walk_start");

  const [liveHeading, setLiveHeading] = useState(0);
  const [lockedBearing, setLockedBearing] = useState<number | null>(null);
  const [distanceRaw, setDistanceRaw] = useState("");
  const [unit, setUnit] = useState<Unit>("m");

  const [revealFix, setRevealFix] = useState<
    Extract<GeoResult, { ok: true }> | null
  >(null);
  const [revealError, setRevealError] = useState<GeoReason | null>(null);
  const [nudgeIndex, setNudgeIndex] = useState(0);

  const [seenWalkthrough, setSeenWalkthrough] = useState(hasSeenWalkthrough);

  const distanceM = parseDistanceM(distanceRaw, unit);
  const canCommit =
    distanceM !== null &&
    (guessMode === "distance_only" || lockedBearing !== null);

  // Live compass stream drives the aim dial while pointing in bearing mode.
  useEffect(() => {
    if (phase !== "guess" || guessMode !== "bearing" || !capability) return;
    if (capability.state !== "compass_ok") return;
    const unsubscribe = subscribeHeading(capability.source, (deg) =>
      setLiveHeading(deg),
    );
    return unsubscribe;
  }, [phase, guessMode, capability]);

  async function runAnchorFix(kind: AnchorKind) {
    setPendingKind(kind);
    setAnchorError(null);
    setAnchorLoading(true);

    const fix = await getPositionOnce();
    if (!fix.ok) {
      setAnchorError(fix.reason);
      setAnchorLoading(false);
      return;
    }

    setAnchor({
      kind,
      lat: fix.lat,
      lng: fix.lng,
      accuracyM: fix.accuracyM,
    });

    if (needsHeadingPermission()) {
      await requestHeadingPermission();
    }
    const cap = await detectHeadingCapability();
    setCapability(cap);
    setGuessMode(guessModeFor(cap));

    setAnchorLoading(false);
    setPhase("guess");
  }

  function lockDirection() {
    setLockedBearing(liveHeading);
  }

  function skipDirection() {
    setGuessMode("distance_only");
    setLockedBearing(null);
  }

  async function runRevealFix() {
    setPhase("fixing");
    setRevealError(null);

    const fix = await getPositionOnce();
    if (!fix.ok) {
      setRevealError(fix.reason);
      setPhase("error");
      return;
    }

    setRevealFix(fix);
    if (!seenWalkthrough) {
      markWalkthroughSeen();
      setSeenWalkthrough(true);
    }
    setPhase("reveal");
  }

  function resetGuessInputs() {
    setLockedBearing(null);
    setDistanceRaw("");
    setUnit("m");
    setGuessMode(guessModeFor(capability ?? { state: "absent", source: "none" }));
  }

  function guessAgain() {
    setNudgeIndex((i) => i + 1);
    setRevealFix(null);
    resetGuessInputs();
    if (anchor?.kind === "home") {
      setPhase("guess");
    } else {
      setAnchor(null);
      setPhase("setup");
    }
  }

  function newStart() {
    setNudgeIndex((i) => i + 1);
    setRevealFix(null);
    resetGuessInputs();
    setAnchor(null);
    setPhase("setup");
  }

  function skipWalkthrough() {
    markWalkthroughSeen();
    setSeenWalkthrough(true);
  }

  const showWalkthrough =
    !seenWalkthrough && (phase === "setup" || phase === "guess");

  return (
    <section className={styles.flow}>
      {showWalkthrough && (
        <Walkthrough
          mode={guessMode}
          anchorSet={anchor !== null}
          bearingLocked={lockedBearing !== null}
          distanceValid={distanceM !== null}
          onSkip={skipWalkthrough}
        />
      )}

      {phase === "setup" && (
        <SetupPhase
          loading={anchorLoading}
          error={anchorError}
          pendingKind={pendingKind}
          onMark={() => runAnchorFix("walk_start")}
          onHome={() => runAnchorFix("home")}
          onRetry={() => runAnchorFix(pendingKind)}
        />
      )}

      {phase === "guess" && (
        <GuessPhase
          mode={guessMode}
          liveHeading={liveHeading}
          lockedBearing={lockedBearing}
          distanceRaw={distanceRaw}
          unit={unit}
          canCommit={canCommit}
          onLock={lockDirection}
          onChange={() => setLockedBearing(null)}
          onSkip={skipDirection}
          onDistanceChange={setDistanceRaw}
          onUnitChange={setUnit}
          onReveal={runRevealFix}
        />
      )}

      {phase === "fixing" && (
        <div className={styles.card} aria-live="polite">
          <div className={styles.spinner} aria-hidden="true" />
          <p className={styles.statusText}>Getting your location.</p>
        </div>
      )}

      {(phase === "reveal" || phase === "error") && (
        <div className={styles.reveal} data-testid="reveal" data-mode={guessMode}>
          {phase === "error" && revealError && (
            <FixError
              reason={revealError}
              onRetry={() => runRevealFix()}
            />
          )}
          {phase === "reveal" && revealFix && anchor && (
            <Reveal
              anchor={anchor}
              fix={revealFix}
              mode={guessMode}
              lockedBearing={lockedBearing}
              distanceM={distanceM}
              floorDeg={floorFor(capability)}
              nudgeIndex={nudgeIndex}
              onGuessAgain={guessAgain}
              onNewStart={newStart}
            />
          )}
        </div>
      )}
    </section>
  );
}

function SetupPhase(props: {
  loading: boolean;
  error: GeoReason | null;
  pendingKind: AnchorKind;
  onMark: () => void;
  onHome: () => void;
  onRetry: () => void;
}) {
  if (props.loading) {
    return (
      <div className={styles.card} aria-live="polite">
        <div className={styles.spinner} aria-hidden="true" />
        <p className={styles.statusText}>Finding where you are.</p>
      </div>
    );
  }

  if (props.error) {
    return <FixError reason={props.error} onRetry={props.onRetry} />;
  }

  return (
    <div className={styles.setup}>
      <h1 className={styles.heading}>Where are you measuring from?</h1>
      <p className={styles.helper}>
        Pick a spot now, walk away, then find your way back.
      </p>
      <button
        type="button"
        className={styles.primary}
        onClick={props.onMark}
        data-step="mark"
      >
        Mark this spot
      </button>
      <button type="button" className={styles.secondary} onClick={props.onHome}>
        Set as home
      </button>
    </div>
  );
}

function GuessPhase(props: {
  mode: GuessMode;
  liveHeading: number;
  lockedBearing: number | null;
  distanceRaw: string;
  unit: Unit;
  canCommit: boolean;
  onLock: () => void;
  onChange: () => void;
  onSkip: () => void;
  onDistanceChange: (value: string) => void;
  onUnitChange: (unit: Unit) => void;
  onReveal: () => void;
}) {
  return (
    <div className={styles.guess} data-mode={props.mode}>
      {props.mode === "bearing" ? (
        <div className={styles.bearing}>
          <h1 className={styles.heading}>Point your phone at it and lock it in.</h1>
          <Dial degrees={props.lockedBearing ?? props.liveHeading} />
          {props.lockedBearing === null ? (
            <>
              <p className={styles.readout} aria-live="polite">
                {Math.round(props.liveHeading)}°
              </p>
              <button
                type="button"
                className={styles.primary}
                onClick={props.onLock}
                data-step="lock"
              >
                Lock direction
              </button>
              <button
                type="button"
                className={styles.subtle}
                onClick={props.onSkip}
              >
                Skip direction
              </button>
            </>
          ) : (
            <div className={styles.lockedRow}>
              <span className={styles.locked}>
                Locked {Math.round(props.lockedBearing)}°
              </span>
              <button
                type="button"
                className={styles.subtle}
                onClick={props.onChange}
              >
                Change
              </button>
            </div>
          )}
        </div>
      ) : (
        <p className={styles.helper}>
          This device measures by distance. Guess how far away it is.
        </p>
      )}

      <div className={styles.distance}>
        <label className={styles.label} htmlFor="distance-input">
          How far away is it?
        </label>
        <div className={styles.distanceRow}>
          <input
            id="distance-input"
            className={styles.input}
            type="number"
            inputMode="decimal"
            min="0"
            step="any"
            value={props.distanceRaw}
            onChange={(e) => props.onDistanceChange(e.target.value)}
            data-step="distance"
          />
          <div className={styles.unitToggle} role="group" aria-label="Distance unit">
            <button
              type="button"
              className={props.unit === "m" ? styles.unitOn : styles.unitOff}
              aria-pressed={props.unit === "m"}
              onClick={() => props.onUnitChange("m")}
            >
              m
            </button>
            <button
              type="button"
              className={props.unit === "km" ? styles.unitOn : styles.unitOff}
              aria-pressed={props.unit === "km"}
              onClick={() => props.onUnitChange("km")}
            >
              km
            </button>
          </div>
        </div>
      </div>

      <button
        type="button"
        className={styles.primary}
        onClick={props.onReveal}
        disabled={!props.canCommit}
        data-step="reveal"
      >
        Reveal
      </button>
    </div>
  );
}

function Dial(props: { degrees: number }) {
  return (
    <div className={styles.dial} aria-hidden="true">
      <div
        className={styles.needle}
        style={{ transform: `rotate(${props.degrees}deg)` }}
      />
    </div>
  );
}

function FixError(props: { reason: GeoReason; onRetry: () => void }) {
  return (
    <div className={styles.card} role="alert">
      <p className={styles.statusText}>{FIX_ERROR_COPY[props.reason]}</p>
      {props.reason !== "unsupported" && (
        <button type="button" className={styles.primary} onClick={props.onRetry}>
          Retry
        </button>
      )}
    </div>
  );
}

function Reveal(props: {
  anchor: Anchor;
  fix: Extract<GeoResult, { ok: true }>;
  mode: GuessMode;
  lockedBearing: number | null;
  distanceM: number | null;
  floorDeg: number;
  nudgeIndex: number;
  onGuessAgain: () => void;
  onNewStart: () => void;
}) {
  const current = { lat: props.fix.lat, lng: props.fix.lng };
  const target = { lat: props.anchor.lat, lng: props.anchor.lng };

  const trueBearing = useMemo(
    () => initialBearingDeg(current, target),
    [current.lat, current.lng, target.lat, target.lng],
  );
  const trueDist = useMemo(
    () => haversineDistanceM(current, target),
    [current.lat, current.lng, target.lat, target.lng],
  );

  const measurable = isMeasurable(trueDist, props.fix.accuracyM);
  const word = compassPoint8(trueBearing);

  if (!measurable) {
    return (
      <div className={styles.revealCard}>
        <p className={styles.statusText}>
          You barely moved. Walk a bit farther, then guess again.
        </p>
        <RevealActions
          onGuessAgain={props.onGuessAgain}
          onNewStart={props.onNewStart}
        />
      </div>
    );
  }

  const bearing =
    props.mode === "bearing" && props.lockedBearing !== null
      ? describeBearing(
          bearingErrorDeg(props.lockedBearing, trueBearing),
          props.floorDeg,
        )
      : null;

  const distance =
    props.distanceM !== null
      ? describeDistance(props.distanceM, trueDist)
      : null;

  return (
    <div className={styles.revealCard}>
      {bearing && <h1 className={styles.headline}>{bearing.bucket}</h1>}
      <p className={styles.direction}>It was to the {word}.</p>

      {bearing &&
        (bearing.withinFloor ? (
          <p className={styles.detail}>
            Inside your compass's ±{props.floorDeg}° margin.
          </p>
        ) : (
          <p className={styles.detail}>{Math.round(bearing.errorDeg)}° off.</p>
        ))}
      {bearing && (
        <p className={styles.caption}>
          Your compass reads to about ±{props.floorDeg}°.
        </p>
      )}

      {distance && props.distanceM !== null && (
        <div className={styles.distanceBlock}>
          <p className={styles.distanceLine}>
            You guessed {formatDistance(props.distanceM)}. It was{" "}
            {formatDistance(trueDist)}.
          </p>
          <p className={styles.verdict}>{VERDICT_COPY[distance.verdict]}</p>
        </div>
      )}

      <p className={styles.nudge}>For next time: {nudgeAt(props.nudgeIndex)}</p>

      <RevealActions
        onGuessAgain={props.onGuessAgain}
        onNewStart={props.onNewStart}
      />
    </div>
  );
}

function RevealActions(props: {
  onGuessAgain: () => void;
  onNewStart: () => void;
}) {
  return (
    <div className={styles.actions}>
      <button
        type="button"
        className={styles.primary}
        onClick={props.onGuessAgain}
      >
        Guess again
      </button>
      <button
        type="button"
        className={styles.secondary}
        onClick={props.onNewStart}
      >
        New start
      </button>
    </div>
  );
}

function Walkthrough(props: {
  mode: GuessMode;
  anchorSet: boolean;
  bearingLocked: boolean;
  distanceValid: boolean;
  onSkip: () => void;
}) {
  const step3 =
    props.mode === "distance_only"
      ? "Guess how far you walked."
      : "Point your phone back at your start and lock it.";

  const steps = [
    "Mark where you are standing now.",
    "Walk somewhere, then open this again.",
    step3,
    "Type the distance, then tap Reveal.",
  ];

  const done = [
    props.anchorSet,
    props.anchorSet,
    props.mode === "distance_only" ? props.distanceValid : props.bearingLocked,
    props.distanceValid,
  ];
  const current = done.findIndex((d) => !d);

  return (
    <aside className={styles.walkthrough} aria-label="Getting started">
      <ol className={styles.steps}>
        {steps.map((text, i) => (
          <li
            key={i}
            className={[
              styles.stepItem,
              done[i] ? styles.stepDone : "",
              i === current ? styles.stepCurrent : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            <span className={styles.stepMark} aria-hidden="true">
              {done[i] ? "✓" : i + 1}
            </span>
            {text}
          </li>
        ))}
      </ol>
      <button type="button" className={styles.subtle} onClick={props.onSkip}>
        Skip
      </button>
    </aside>
  );
}
