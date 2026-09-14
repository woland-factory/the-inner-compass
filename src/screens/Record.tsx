import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  loadGuesses,
  replaceGuesses,
  type StoredGuess,
} from "../record/store";
import { SIGNATURE_MIN_GUESSES, deriveSignature } from "../record/signature";
import { parseRecord, serializeRecord } from "../record/recordFile";
import { formatDistance } from "../game/scoring";
import styles from "./Record.module.css";

const CHART_WINDOW = 100;
const PAGE_SIZE = 10;
const MAX_DRAWN_RATIO = 3;

function median(nums: number[]): number {
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) return (sorted[mid - 1] + sorted[mid]) / 2;
  return sorted[mid];
}

// Newest first, tolerant of an unordered imported record.
function sortNewestFirst(guesses: StoredGuess[]): StoredGuess[] {
  return [...guesses].sort((a, b) => b.timestamp - a.timestamp);
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function Record() {
  const [guesses, setGuesses] = useState<StoredGuess[]>(() => loadGuesses());
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [importError, setImportError] = useState(false);
  const [confirmImport, setConfirmImport] = useState<StoredGuess[] | null>(null);

  const ordered = useMemo(() => sortNewestFirst(guesses), [guesses]);
  const signature = useMemo(() => deriveSignature(guesses), [guesses]);

  function applyImport(gs: StoredGuess[]) {
    const written = replaceGuesses(gs);
    setGuesses(written);
    setConfirmImport(null);
    setImportError(false);
    setVisibleCount(PAGE_SIZE);
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setImportError(false);
    const text = await file.text();
    const result = parseRecord(text);
    if (!result.ok) {
      setImportError(true);
      return;
    }
    if (guesses.length > 0) {
      setConfirmImport(result.guesses);
    } else {
      applyImport(result.guesses);
    }
  }

  function handleExport() {
    const text = serializeRecord(guesses, new Date().toISOString());
    const blob = new Blob([text], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "inner-compass-record.json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  if (guesses.length === 0) {
    return (
      <section className={styles.record}>
        <div className={styles.empty}>
          <h1 className={styles.title}>Your record starts with one walk.</h1>
          <p className={styles.body}>
            Every guess you commit lands here, scored against the truth.
          </p>
          <Link to="/guess" className={styles.primary}>
            Start a walk
          </Link>
        </div>
        <ImportBlock
          onFile={handleFile}
          error={importError}
          minimal
        />
      </section>
    );
  }

  const remaining = SIGNATURE_MIN_GUESSES - guesses.length;
  const belowThreshold = signature.length === 0;

  return (
    <section className={styles.record}>
      <div className={styles.topRow}>
        <h1 className={styles.title}>Your record</h1>
        <Link to="/guess" className={styles.startLink}>
          Start a walk
        </Link>
      </div>

      <DistanceRatioChart guesses={guesses} />
      <BearingErrorChart guesses={guesses} />

      <section className={styles.signature} aria-label="Your error signature">
        <h2 className={styles.heading}>Your error signature</h2>
        {belowThreshold ? (
          <p className={styles.body}>
            Your error signature appears after{" "}
            {remaining === 1 ? "1 more guess" : `${remaining} more guesses`}.
          </p>
        ) : (
          <ul className={styles.statements}>
            {signature.map((s) => (
              <li key={s} className={styles.statement}>
                {s}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={styles.history} aria-label="Your guesses">
        <h2 className={styles.heading}>Your guesses</h2>
        <ul className={styles.rows}>
          {ordered.slice(0, visibleCount).map((g) => (
            <li key={g.id} className={styles.row}>
              <div className={styles.rowTop}>
                <span className={styles.rowDate}>{formatDate(g.timestamp)}</span>
                <span className={styles.rowKind}>
                  {g.targetKind === "home" ? "Home" : "Walk start"}
                </span>
              </div>
              <p className={styles.rowDistance}>
                You guessed {formatDistance(g.guessedDistanceM)}. It was{" "}
                {formatDistance(g.trueDistanceM)}.
              </p>
              {g.mode === "bearing" && g.bearingErrorDeg !== null && (
                <p className={styles.rowBearing}>
                  {Math.round(g.bearingErrorDeg)}° off.
                </p>
              )}
            </li>
          ))}
        </ul>
        {visibleCount < ordered.length && (
          <button
            type="button"
            className={styles.secondary}
            onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
          >
            Show more
          </button>
        )}
      </section>

      <section className={styles.export} aria-label="Your record, on your device">
        <h2 className={styles.heading}>Your record, on your device</h2>
        <div className={styles.exportRow}>
          <button
            type="button"
            className={styles.secondary}
            onClick={handleExport}
            disabled={guesses.length === 0}
          >
            Export
          </button>
          <ImportBlock onFile={handleFile} error={importError} />
        </div>
        {confirmImport && (
          <div className={styles.confirm} role="alertdialog" aria-label="Confirm import">
            <p className={styles.body}>Importing replaces your record. Continue?</p>
            <div className={styles.confirmActions}>
              <button
                type="button"
                className={styles.primary}
                onClick={() => applyImport(confirmImport)}
              >
                Replace
              </button>
              <button
                type="button"
                className={styles.secondary}
                onClick={() => setConfirmImport(null)}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </section>
    </section>
  );
}

function ImportBlock(props: {
  onFile: (e: React.ChangeEvent<HTMLInputElement>) => void;
  error: boolean;
  minimal?: boolean;
}) {
  return (
    <div className={props.minimal ? styles.importMinimal : styles.import}>
      <label className={styles.importLabel}>
        Import a record file
        <input
          type="file"
          accept="application/json,.json"
          className={styles.importInput}
          onChange={props.onFile}
        />
      </label>
      {props.error && (
        <p className={styles.importError} role="alert">
          That file is not a record this app can read. Pick a file you exported
          here.
        </p>
      )}
    </div>
  );
}

function DistanceRatioChart(props: { guesses: StoredGuess[] }) {
  const window = props.guesses.slice(-CHART_WINDOW);
  const ratios = window.map((g) => g.distanceRatio);
  const med = median(ratios);
  const summary = `Distance calibration. Your last ${
    window.length
  } guesses plotted as a ratio to the real distance, where 1 is exact. Median ${med.toFixed(
    1,
  )} times the real distance.`;

  const W = 320;
  const H = 180;
  const padX = 10;
  const padY = 16;
  const plotH = H - padY * 2;
  const drawn = ratios.map((r) => Math.min(Math.max(r, 0), MAX_DRAWN_RATIO));
  const yFor = (r: number) => padY + (1 - r / MAX_DRAWN_RATIO) * plotH;
  const xFor = (i: number) =>
    window.length === 1
      ? W / 2
      : padX + (i * (W - padX * 2)) / (window.length - 1);
  const baselineY = yFor(1);
  const points = drawn.map((r, i) => `${xFor(i)},${yFor(r)}`).join(" ");

  return (
    <section className={styles.chartCard} data-role="hero-chart">
      <h2 className={styles.chartHeading}>Distance calibration</h2>
      <svg
        className={styles.heroSvg}
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={summary}
      >
        <line
          x1={padX}
          y1={baselineY}
          x2={W - padX}
          y2={baselineY}
          className={styles.baseline}
        />
        {window.length > 1 && (
          <polyline className={styles.dataLine} points={points} />
        )}
        {drawn.map((r, i) => (
          <circle
            key={i}
            cx={xFor(i)}
            cy={yFor(r)}
            r={3}
            className={styles.dataPoint}
          />
        ))}
      </svg>
      <p className={styles.baselineLabel}>1× is exact</p>
    </section>
  );
}

function BearingErrorChart(props: { guesses: StoredGuess[] }) {
  const window = props.guesses
    .filter((g) => g.mode === "bearing" && g.bearingErrorDeg !== null)
    .slice(-CHART_WINDOW);

  const W = 320;
  const H = 120;
  const padX = 10;
  const padY = 14;
  const plotH = H - padY * 2;

  if (window.length === 0) {
    return (
      <section className={styles.chartCard} data-role="bearing-chart">
        <h2 className={styles.chartHeading}>Bearing error</h2>
        <p className={styles.body}>
          Lock a bearing on your next walk to chart it here.
        </p>
      </section>
    );
  }

  const errors = window.map((g) => g.bearingErrorDeg as number);
  const med = median(errors);
  const summary = `Bearing error. Your last ${window.length} bearing guesses in degrees off, from 0 to 180 where lower is closer. Median ${Math.round(
    med,
  )} degrees.`;

  const yFor = (e: number) => padY + (1 - e / 180) * plotH;
  const xFor = (i: number) =>
    window.length === 1
      ? W / 2
      : padX + (i * (W - padX * 2)) / (window.length - 1);
  const points = errors.map((e, i) => `${xFor(i)},${yFor(e)}`).join(" ");

  return (
    <section className={styles.chartCard} data-role="bearing-chart">
      <h2 className={styles.chartHeading}>Bearing error</h2>
      <svg
        className={styles.bearingSvg}
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={summary}
      >
        <line
          x1={padX}
          y1={yFor(0)}
          x2={W - padX}
          y2={yFor(0)}
          className={styles.baseline}
        />
        {window.length > 1 && (
          <polyline className={styles.dataLine} points={points} />
        )}
        {errors.map((e, i) => (
          <circle
            key={i}
            cx={xFor(i)}
            cy={yFor(e)}
            r={3}
            className={styles.dataPoint}
          />
        ))}
      </svg>
    </section>
  );
}
