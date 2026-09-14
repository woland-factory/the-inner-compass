# EPIC SPEC — The record: persistence, trends, error signature, export

The compounding half of The Inner Compass. Until now every guess vanished when
the tab closed. This EPIC keeps them: each committed, measurable reveal is
appended to a local time series, and a new `/record` screen turns that series
into the durable artifact the product promises. It leads with distance-ratio
calibration (the hero metric the evidence backs), shows bearing error second,
states plain error-signature sentences once there is enough data, and lets the
user carry the whole record out as a file and back in. No server, no account, no
sync. The record lives on the device and in a file the user owns.

---

## Quality differentiator (this EPIC lives or dies here)

**Immediacy: from opening the page to a true, surprising measurement of your own
sense of direction in under a minute, no install, no account, on the phone
already in your pocket.**

What that demands of THIS EPIC: persistence must never slow the loop or the
record screen. Writing a guess happens in one synchronous, bounded step at the
moment of reveal, and it must never block or delay the reveal the user is
reading. The record screen must render its real content fast (parse once, render
a bounded page and a windowed chart), never a blank page and never a list that
gets slower with every walk. And the honesty bar carries straight over from the
loop: the record shows only what the user's own data supports. It never flatters
with a promise of improvement, never invents precision below the compass floor,
and never claims a pattern the numbers do not show. A record the user trusts is
the whole reason it compounds.

---

## Scope

### In scope
- **Persist every measurable guess.** On each reveal that clears the
  measurability guard, append one `StoredGuess` to a localStorage time series.
  A "barely moved" reveal (fails `isMeasurable`) has no meaningful data and is
  NOT stored.
- **A `/record` screen** with, in this vertical order:
  1. A **distance-ratio calibration chart** as the hero (largest, first).
  2. A **bearing-error chart** as the secondary surface.
  3. **Error-signature statements** derived from the user's own data, shown only
     past a stated guess threshold.
  4. A **paginated guess history** list, newest first, that never renders the
     whole record at once.
  5. A subordinate **export / import** section.
- **Designed empty and low-data states** for the record screen (zero guesses,
  and below the signature threshold).
- **File export**: download the whole record as one JSON file.
- **File import**: read a record file, validate it at the boundary, and REPLACE
  the local record with it (a round-trip is identical).
- **Reachability**: a subordinate nav link so `/record` is reachable from the
  app shell, plus a subordinate "See your record" link on the reveal.

### Out of scope (binding non-goals — do NOT build)
- **No cloud sync.** Nothing leaves the device except the file the user
  explicitly exports.
- **No accounts, no server, no auth surface.** The app stays a static SPA.
- **No cross-device merge.** Import REPLACES the record; it never merges two
  records. (Merge would require identity and conflict resolution the product
  does not have.)
- **No new capture features.** No new target types, no address entry, no map,
  no LLM narration. This EPIC reads and displays the guesses the existing loop
  already produces; it does not change how a guess is made.
- **No `/settings` screen.** The plan reserves `/settings` for units, home
  management, and sensor status. Only export/import belongs to THIS EPIC, and it
  lives on `/record`. Do not build the rest of `/settings`.
- **No improvement promise.** The chart may show the user's own trajectory over
  time (that is their data, plotted honestly), but no statement, caption, or
  label may claim the user is improving or will improve.

---

## Technical design

### Stack facts (already in place — do not change)
- React 18 + TypeScript + Vite; routing via `react-router-dom`; tests via
  Vitest + Testing Library in jsdom. `npm run build` runs `tsc --noEmit && vite
  build`; `npm test` runs `vitest run`.
- Design tokens in `src/styles/global.css`: `--bg`, `--surface`,
  `--surface-raised`, `--border`, `--text`, `--text-muted`, `--accent`,
  `--accent-strong`, `--accent-contrast`, `--danger`, `--focus`, `--radius`,
  `--content-max` (34rem), `--tap` (44px). Dark theme, `color-scheme: dark`,
  global `:focus-visible` ring, `prefers-reduced-motion` reset. Use these; add
  no new color system and no charting dependency.
- `src/game/geoMath.ts` — `initialBearingDeg`, `haversineDistanceM`,
  `bearingErrorDeg` (unsigned `[0,180]`), `distanceRatio`, `compassPoint8`.
- `src/game/scoring.ts` — `describeBearing`, `describeDistance`, `isMeasurable`,
  `formatDistance`, `MIN_MEASURABLE_M`. Reuse `formatDistance` and
  `isMeasurable`; do not duplicate them.
- `src/game/nudges.ts` — `NUDGES`, `nudgeAt`.
- `src/screens/GuessFlow.tsx` — the whole loop on `/guess`. It already holds, at
  reveal time, the anchor (`{ kind, lat, lng, accuracyM }`), the locked bearing
  (or null in distance-only), the parsed `distanceM`, the `HeadingCapability`
  (for the floor via `floorFor`), the `guessMode`, and the `nudgeIndex`. The
  reveal fix is `{ ok:true, lat, lng, accuracyM, timestamp }`. This EPIC reads
  those values to build a record row; it does not change the loop's phases.
- `src/App.tsx` — routes `/` (Landing) and `/guess` (GuessFlow) inside `Shell`;
  `/reveal` is reserved and unused. `*` redirects to `/`.
- `src/shell/Shell.tsx` — header with a `brand` span, `<Outlet/>` in `main`.

### Data model / migrations
There is no database and no server; no SQL migrations apply. The record is a
localStorage time series. Its shape is forward-versioned so a future change can
migrate rather than corrupt.

**localStorage key** `ic_guesses_v1` — a JSON array of `StoredGuess`. (Keep the
existing `ic_seen_walkthrough` key untouched.)

```ts
// src/record/store.ts
export const SCHEMA_VERSION = 1;

export type StoredGuess = {
  id: string;                       // stable unique id (see id generation)
  timestamp: number;                // ms epoch at reveal (Date.now())
  targetKind: "home" | "walk_start";
  mode: "bearing" | "distance_only";
  guessedBearingDeg: number | null; // null in distance_only
  trueBearingDeg: number;           // [0,360)
  bearingErrorDeg: number | null;   // unsigned [0,180], null in distance_only
  signedBearingErrorDeg: number | null; // [-180,180], + = clockwise / right of true
  guessedDistanceM: number;
  trueDistanceM: number;
  distanceRatio: number;            // guessedDistanceM / trueDistanceM
  headingAccuracyDeg: number | null;// the shown floor at reveal, or null
  nudgeIndex: number;
};
```

- **id generation**: `crypto.randomUUID()` when available, else a fallback
  `` `g-${timestamp}-${counter}` `` with a module-scoped counter. The id must be
  stable once written (it survives export/import verbatim).
- **Storage cap (bounds the hot path).** A module constant
  `MAX_STORED_GUESSES = 2000`. On append, if the array would exceed the cap,
  keep the most recent `MAX_STORED_GUESSES` (drop oldest). This bounds parse
  cost and storage size so the write path never grows without limit. The cap is
  generous (years of daily walks); export is the archival path for a heavier
  user. Do not silently cap the DISPLAY differently from the store: the list is
  paginated (below), and pagination is the display bound.

### New module: `src/record/store.ts` (+ `store.test.ts`)
Thin, synchronous, defensive localStorage access. All reads tolerate absent or
corrupt storage by returning an empty record; a blocked or throwing storage
never crashes the app (mirror the existing `hasSeenWalkthrough` try/catch
pattern in `GuessFlow.tsx`).

- `loadGuesses(): StoredGuess[]` — read + `JSON.parse`; on any error or
  non-array, return `[]`. Optionally filter out rows failing a minimal shape
  check so one bad row cannot poison the screen.
- `appendGuess(g: StoredGuess): StoredGuess[]` — load, push, apply the cap,
  write, return the new array. Never throws to the caller.
- `replaceGuesses(gs: StoredGuess[]): StoredGuess[]` — write the given array
  (used by import), applying the cap; return what was written.
- `clearGuesses(): void` — remove the key (used only if you offer a clear
  control; optional, see UI).

### New module: `src/record/signature.ts` (+ `signature.test.ts`)
Pure. Turns the record into a small set of plain, honest sentences. No I/O.

- `export const SIGNATURE_MIN_GUESSES = 5;` — the stated threshold. Below it,
  `deriveSignature` returns `[]` and the screen shows the low-data state.
- `deriveSignature(guesses: StoredGuess[]): string[]` — returns 0..3 statement
  strings. Rules (all derived only from the user's own rows, never a promise):
  - If `guesses.length < SIGNATURE_MIN_GUESSES` → return `[]`.
  - **Distance calibration** (always, once past threshold; distance is the hero
    metric so this statement comes first). Let `m = median(distanceRatio over
    all guesses)`.
    - `m > 1.25` → `Your distance guesses run long, about ${m.toFixed(1)}× the real distance.`
    - `m < 0.8`  → `Your distance guesses run short, about ${m.toFixed(1)}× the real distance.`
    - else       → `Your distance guesses land close to the real distance.`
  - **Bearing typical error** (only if at least `SIGNATURE_MIN_GUESSES` guesses
    are `mode === "bearing"` with a non-null `bearingErrorDeg`). Let
    `e = median(bearingErrorDeg over those)`. Statement:
    `Your bearings are usually about ${Math.round(e)}° off.`
  - **Bearing lean** (only alongside the bearing statement above, and only when
    the lean is real, not noise). Let `s = median(signedBearingErrorDeg)` over
    the bearing guesses, and `agree` = the fraction whose sign matches `s`.
    If `Math.abs(s) >= 15` AND `agree >= 0.6`:
    `You lean ${s > 0 ? "right" : "left"} of true.`
  - Order in the returned array: distance calibration, then bearing typical
    error, then bearing lean.
- A small internal `median(nums: number[]): number` helper (sorted middle, mean
  of the two middles for even length). Keep it local to this module.

The signature never says "improving", "better", "worse than before", or
compares recent to early guesses. Trajectory belongs to the chart, which plots
the user's own points and lets them read the trend themselves.

### New module: `src/record/recordFile.ts` (+ `recordFile.test.ts`)
Pure serialize / parse for export and import. The DOM download and file-read
wiring stays in the component; this module holds the format and validation so it
is unit-testable.

```ts
export type RecordFile = {
  schemaVersion: number;   // SCHEMA_VERSION
  exportedAt: string;      // ISO 8601, set by the caller at export time
  guesses: StoredGuess[];
};
```

- `serializeRecord(guesses: StoredGuess[], exportedAt: string): string` —
  `JSON.stringify` of a `RecordFile` (pretty-printed with 2-space indent is
  fine).
- `parseRecord(text: string): { ok: true; guesses: StoredGuess[] } | { ok:
  false; reason: "unreadable" | "wrong_format" }` — `JSON.parse` inside a
  try/catch (`unreadable` on throw). Validate: object with
  `schemaVersion === SCHEMA_VERSION` and `Array.isArray(guesses)`, and each row
  passes a minimal shape check (required numeric/string fields present, correct
  types). Fail with `wrong_format` otherwise. This is the input-validation
  boundary for imported data.

**Round-trip guarantee (AC):** for any `StoredGuess[]`, `parseRecord(
serializeRecord(gs, iso)).guesses` deep-equals `gs`. JSON preserves the numeric
and string fields verbatim, so equality holds. The test asserts this directly.

### geoMath addition: `signedBearingErrorDeg`
`src/game/geoMath.ts` gains one pure function (additive; the existing unsigned
`bearingErrorDeg` still drives the reveal's display bucket).

- `signedBearingErrorDeg(guessDeg, trueDeg): number` in `[-180, 180]`, positive
  when the guess sits clockwise of true (to the right). Implementation:
  `((guessDeg - trueDeg + 540) % 360) - 180`. Its magnitude equals
  `bearingErrorDeg(guessDeg, trueDeg)`.

### GuessFlow integration (`src/screens/GuessFlow.tsx`)
Append exactly one record per measurable reveal, at the moment the reveal fix
succeeds, so it happens once and never on re-render.

- In `runRevealFix`, after a successful fix, compute the true values the reveal
  needs (`initialBearingDeg`, `haversineDistanceM`) and `isMeasurable(trueDist,
  fix.accuracyM)`. When measurable, assemble a `StoredGuess` and call
  `appendGuess(g)` before (or as) you set the `reveal` phase. When not
  measurable (barely moved), do NOT append. This keeps the write on the
  single fix event, not in the render path.
  - `guessedBearingDeg` / `bearingErrorDeg` / `signedBearingErrorDeg` are the
    locked-bearing values in `bearing` mode, and `null` in `distance_only`.
  - `headingAccuracyDeg` is the floor from the stored capability
    (`floorFor(capability)`), or `null` when unknown.
  - `timestamp` is `Date.now()`.
- The `Reveal` component's display math is unchanged (it may keep recomputing
  for display; that is cheap and memoized). Do NOT move display logic; only add
  the persistence write in `runRevealFix`.
- Add a subordinate **See your record** link (a `react-router` `Link` to
  `/record`) in the reveal, visually below the `Guess again` / `New start`
  actions, so a user who just guessed can reach the growing record. It is
  subordinate to those actions (QUALITY BAR §7). It must render in both the
  measurable and barely-moved reveal branches.

### New screen: `src/screens/Record.tsx` (+ `Record.module.css`)
Mounted at `/record`. Reads the record once on mount (`loadGuesses`) into state.
Mobile-first, single column within `--content-max`, everything usable at 390px
with no horizontal scroll and tap targets ≥ 44px.

**Layout / states**

- **Empty (zero guesses):** a designed surface, not a blank region. States what
  the record is for and points to the first guess in positive phrasing, with a
  primary action to start. (Copy inventory below.) No charts, no history, no
  export section clutter (an import control may still show so a returning user
  on a new device can restore a file; keep it subordinate).
- **Low-data (1 to `SIGNATURE_MIN_GUESSES - 1` guesses):** render the charts
  with the points that exist, render the history, and in place of the signature
  block show one line that states the threshold in positive phrasing (it names
  the number, e.g. how many more guesses until the signature appears). No
  signature statements yet.
- **Full (≥ threshold):** charts, signature statements, paginated history,
  export/import.

**Charts (inline SVG, no dependency).** Follow the `dataviz` skill's guidance
for color, contrast, and labels; draw only from the existing CSS tokens (accent
for the data, muted for axes/baseline, danger reserved for genuine error UI).
Both charts are non-interactive `role="img"` figures with an `aria-label` that
summarizes the data in words (so the chart is not information a sighted user
alone can read).

- **Distance-ratio calibration chart = HERO.** First in the DOM and visually
  dominant (larger height, own heading). Mark it with a stable
  `data-role="hero-chart"` for the ordering test. Plot each guess's
  `distanceRatio` against its position in time, most-recent-`N` window
  (`CHART_WINDOW = 100`), with a horizontal baseline at ratio `1` (labeled so
  the user reads "1× is exact"). Points/line above the baseline are
  overestimates, below are underestimates. Clamp the y-range sensibly so one
  wild ratio does not flatten the rest (e.g. cap the drawn ratio at a max like
  3× while keeping the real value in the aria summary). Readable at 390px:
  labels ≥ 12px, sufficient contrast.
- **Bearing-error chart = SECONDARY.** Below the hero, smaller. Plots
  `bearingErrorDeg` (0–180, lower is better) for the `bearing`-mode guesses in
  the window. If there are zero bearing-mode guesses, show a short positive note
  in its place instead of an empty axis (copy below). Mark the section for the
  ordering test (e.g. `data-role="bearing-chart"`).

**Signature statements.** Render `deriveSignature(guesses)` as a short list, only
when non-empty (past threshold). Each statement is one plain sentence. No
statement claims improvement.

**History list (paginated — bounds the hot path).** Newest first. Render one
page at a time, `PAGE_SIZE = 10`. A **Show more** button appends the next page
(client-side slice; never render the whole array at once). Each row is compact:
the relative or absolute date, the target kind, the distance line
(`formatDistance(guessedDistanceM)` vs `formatDistance(trueDistanceM)`), and, in
bearing mode, the bucket or degrees off. Reuse `formatDistance`. Do not add a
per-row map or expansion.

**Export / import (subordinate section).**
- **Export**: a button that builds `serializeRecord(guesses, new
  Date().toISOString())`, wraps it in a `Blob(["…"], { type: "application/json"
  })`, and triggers a download via a created object URL on a transient `<a
  download="inner-compass-record.json">` (revoke the URL after). Disabled when
  the record is empty. Gives pressed feedback < 100ms.
- **Import**: a labeled `<input type="file" accept="application/json,.json">`.
  On change, read the file text (`file.text()`), call `parseRecord`. On `ok`,
  if the current record is non-empty, show an inline confirm ("Importing
  replaces your record. Continue?" with a confirm and a cancel) before calling
  `replaceGuesses` and refreshing state; if the record is empty, replace
  directly. On failure, show a designed inline error in the product's voice
  (copy below), never a raw parse error or a crash. Do NOT use `window.confirm`
  or `alert` (untestable, off-brand); use inline designed controls.
  - Import REPLACES; it never merges (cross-device merge is a non-goal).

**Not a dead end.** The record screen offers a clear way back to a guess: a
subordinate **Start a walk** link to `/guess` (and the header nav below always
reaches `/`). The empty state's primary action is that link.

### Routing + nav
- `src/App.tsx`: add `<Route path="/record" element={<Record />} />` inside the
  `Shell` route, before the `*` redirect.
- `src/shell/Shell.tsx` (+ `Shell.module.css`): make the brand a `Link` to `/`
  and add a subordinate **Record** `Link` to `/record` in the header. The
  Record link is visually subordinate to the brand (small, muted), reachable by
  keyboard, tap target ≥ 44px. This is the always-available path to the record.
  Do not add any other nav.

### Security / privacy (client-only app)
- No server routes, no auth surface, no accounts: the relevant hygiene is
  **input validation at the import boundary** (`parseRecord` above) and **no PII
  in logs**. Never log coordinates, bearings, or the imported file contents. Do
  not add Sentry breadcrumbs carrying location or record data.
- The exported file contains the user's own coordinates (home/walk-start and
  reveal positions). That is inherent to a portable record and stays entirely
  local: it is written only to a file the user explicitly downloads, never
  transmitted. Do not add any network call to export or import.

---

## Ordered task list

**T1 — `signedBearingErrorDeg` in `src/game/geoMath.ts` + tests.**
AC:
- `signedBearingErrorDeg(guessDeg, trueDeg)` returns a value in `[-180,180]`,
  positive clockwise of true; its magnitude equals `bearingErrorDeg`.
- Wraparound cases pass (see Test plan).

**T2 — Persistence store `src/record/store.ts` + tests.**
AC:
- `StoredGuess`, `SCHEMA_VERSION`, `MAX_STORED_GUESSES` exported.
- `appendGuess` persists a row that `loadGuesses` returns on a fresh read
  (persists across a simulated reload).
- The cap holds: appending past `MAX_STORED_GUESSES` keeps the most recent
  `MAX_STORED_GUESSES` and drops the oldest.
- `loadGuesses` returns `[]` on absent or corrupt storage without throwing;
  `replaceGuesses` writes and returns the (capped) array.

**T3 — Signature engine `src/record/signature.ts` + tests.**
AC:
- `SIGNATURE_MIN_GUESSES` exported; `deriveSignature` returns `[]` below it.
- Distance calibration statement matches the seeded median (long / short /
  close) at the 1.25 and 0.8 edges.
- Bearing typical-error and lean statements appear only with enough bearing-mode
  guesses and only when the lean clears the magnitude/agreement gate.
- No returned statement contains an improvement claim.

**T4 — Record file `src/record/recordFile.ts` + tests.**
AC:
- `serializeRecord` / `parseRecord` round-trip is deep-equal for a seeded
  record.
- `parseRecord` returns `wrong_format` for a valid-JSON object with a bad shape
  and `unreadable` for non-JSON text; it never throws.

**T5 — GuessFlow persistence hook-in (`src/screens/GuessFlow.tsx`).**
AC:
- A measurable reveal appends exactly one `StoredGuess` with correct fields for
  both `bearing` and `distance_only` modes; a barely-moved reveal appends
  nothing.
- The write happens on the fix event, not on re-render (no duplicate rows across
  re-renders of a single reveal).
- The **See your record** link renders on the reveal (both branches) and routes
  to `/record`.
- The existing GuessFlow tests still pass; the reveal is not delayed by the
  write.

**T6 — Record screen + charts + routing + shell nav.**
AC:
- `/record` renders empty, low-data, and full states per the design.
- Distance-ratio chart is first in the DOM and marked hero; bearing-error chart
  is second; both have descriptive `aria-label`s and are readable at 390px.
- History is paginated at `PAGE_SIZE`; **Show more** reveals the next page; the
  whole array is never rendered at once.
- Export downloads a JSON file; import validates, replaces on success (with an
  inline confirm when replacing a non-empty record), and shows a designed error
  on a bad file.
- Shell header links to `/` and `/record`; keyboard reachable, ≥ 44px targets.

**T7 — Component tests, copy sweep, README, full build.**
AC:
- The component and unit tests below pass.
- Copy sweep passes on every string this EPIC adds or edits.
- `README.md` gains a short, plain description of the record, the trend view,
  and export/import (for strangers, no pipeline jargon).
- `npm run build` and `npm test` both pass.

---

## Test plan (each acceptance criterion → the test that proves it)

Run the whole suite with `npm test` (Vitest, jsdom). For store/record tests,
clear `localStorage` in `afterEach`. For the Record screen, seed via the store
(or mock `loadGuesses`) and render inside `MemoryRouter`, following the existing
`GuessFlow.test.tsx` / `Landing.test.tsx` patterns.

**AC: guesses persist across reloads; history bounded.**
`store.test.ts` — `appendGuess(row)` then a fresh `loadGuesses()` (reading the
same localStorage) returns the row: this is the reload proof. Append
`MAX_STORED_GUESSES + 5` rows and assert length equals the cap and the newest
rows are kept, the oldest dropped. `loadGuesses()` returns `[]` when the key is
absent and when it holds non-JSON or a non-array (no throw).
`Record.test.tsx` — seed 25 guesses; assert only `PAGE_SIZE` history rows render
initially, and **Show more** grows the list by a page without rendering all 25
at once.

**AC: trend view — distance ratio hero, bearing second, readable at 390px.**
`Record.test.tsx` — seed a full record; assert the element with
`data-role="hero-chart"` (distance ratio) precedes `data-role="bearing-chart"`
in DOM order, both are present, and each carries a non-empty `aria-label`
summarizing its data. Assert the hero chart's heading/label references distance
calibration and the secondary references bearing. (390px pixel readability is a
manual/CSS check; note it in the run summary. The DOM-order and labeling assert
the hero/secondary relationship.)

**AC: empty and low-data states.**
`Record.test.tsx` — zero guesses: assert the empty copy renders (what the record
is for) and a link/primary to `/guess`; assert no signature statement and no
history rows. Below threshold (e.g. 3 guesses): assert the low-data line states
the threshold number and that no signature statement renders, while the charts
and history still render the existing points.

**AC: error-signature past threshold, from user data, no improvement claim.**
`signature.test.ts` —
- Fewer than `SIGNATURE_MIN_GUESSES` → `[]`.
- All ratios ≈ 1.5 across ≥ threshold guesses → a "run long, about 1.5×"
  statement; all ratios ≈ 0.6 → "run short, about 0.6×"; ratios within
  `[0.8,1.25]` → the "land close" statement. Boundary rows at exactly 1.25 and
  0.8.
- Bearing statements: appear only with ≥ threshold bearing-mode guesses; a
  consistent right lean (signed errors mostly positive, median ≥ 15°) yields the
  "lean right" statement; mixed-sign noise yields no lean statement.
- Assert no statement string matches improvement phrasing (a test that scans the
  output for banned words like "improv", "better", "worse", "progress").
`Record.test.tsx` — a seeded ≥-threshold record shows the statements; a
below-threshold record does not.

**AC: export round-trip; import validates and replaces.**
`recordFile.test.ts` — `parseRecord(serializeRecord(gs, iso)).guesses` deep-
equals `gs` for a seeded multi-row record (bearing and distance-only rows).
`parseRecord` returns `wrong_format` for `{schemaVersion:1}` with no guesses and
for a row missing required fields; returns `unreadable` for `"not json{"`.
`Record.test.tsx` — importing a valid file (dispatch a `change` on the file
input with a stub `File`, or mock the read path) replaces the record and the new
rows render; importing a bad file shows the designed error and leaves the
existing record intact; export triggers a download (mock
`URL.createObjectURL`/`revokeObjectURL` and assert an anchor with the download
attribute / a blob URL is created).

**AC: `signedBearingErrorDeg` correct.**
`geoMath.test.ts` — `signedBearingErrorDeg(10,350) === 20` (right),
`(350,10) === -20` (left), `(90,270) === 180` or `-180` (assert
`Math.abs === 180`), `(0,0) === 0`; magnitude equals `bearingErrorDeg` for
several pairs.

**AC: persistence hook-in and no reveal delay.**
`GuessFlow.test.tsx` (extend existing) — after a measurable bearing reveal,
`loadGuesses()` returns one row with the expected mode/fields; after a
distance-only reveal, one row with `guessedBearingDeg`/`bearingErrorDeg` null;
after a barely-moved reveal, zero rows. Assert the reveal content renders as
before (the write does not gate the reveal). Assert the **See your record** link
is present and points to `/record`.

**AC: copy sweep passes.**
Mechanical + manual sweep of every string this EPIC adds or edits (Record
screen, charts labels/aria, signature statements, store/record error copy,
GuessFlow's new link, Shell nav, README): no `—` or `–`; none of the banned LLM
vocabulary; no negative empty-state phrasing (`"You don't have"`, `"No … yet"`,
`"Nothing … here"`, `"Unable to"`, `"Something went wrong"`); no improvement
promise anywhere in the record surfaces. Record the sweep result in the run
summary.

---

## Copy inventory (ship verbatim — already swept)

Shell nav: brand link `The Inner Compass`; secondary link `Record`.

Reveal (added to `GuessFlow`): subordinate link `See your record`.

Record — empty state:
- heading `Your record starts with one walk.`
- body `Every guess you commit lands here, scored against the truth.`
- primary link `Start a walk` (to `/guess`).

Record — low-data line (past zero, below threshold; `{n}` = guesses remaining to
reach `SIGNATURE_MIN_GUESSES`):
`Your error signature appears after {n} more guesses.`
(When exactly one remains, the implementer may render `1 more guess`; keep it
singular-correct. Copy stays positive.)

Record — section headings:
- hero chart heading `Distance calibration`
- hero baseline label `1× is exact`
- bearing chart heading `Bearing error`
- bearing chart empty note (no bearing-mode guesses yet) `Lock a bearing on your
  next walk to chart it here.`
- signature heading `Your error signature`
- history heading `Your guesses`
- history pagination button `Show more`
- export/import heading `Your record, on your device`

Record — history row parts:
- distance line `You guessed {guess}. It was {truth}.` (reusing `formatDistance`)
- bearing detail (bearing rows) `{n}° off.` (use the same phrasing as the reveal)

Record — export / import:
- export button `Export`
- import label `Import a record file`
- import replace confirm body `Importing replaces your record. Continue?`
- confirm button `Replace`
- cancel button `Cancel`
- import error `That file is not a record this app can read. Pick a file you
  exported here.`

Signature statements (generated from the user's own data):
- distance long `Your distance guesses run long, about {m}× the real distance.`
- distance short `Your distance guesses run short, about {m}× the real distance.`
- distance close `Your distance guesses land close to the real distance.`
- bearing typical `Your bearings are usually about {n}° off.`
- bearing lean `You lean {right|left} of true.`

All strings above contain no em-dashes or en-dashes, no banned LLM vocabulary,
no negative empty-state phrasing, and no improvement promise. The signature
sentences describe stable patterns in the user's own data; they never claim the
user is improving. Sweep every string again if you edit any of them.
