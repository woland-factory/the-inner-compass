# EPIC SPEC — First run: guided walk-through and sample reveal

A brand-new visitor must see this product's one true trick within a minute, on
the phone already in their pocket, with no account and no walk required. This
EPIC delivers that in two parts. First, a **sample guess** on the landing screen:
one tap runs the real scoring engine on built-in coordinates and shows a real,
non-zero measurement (how far off a direction was, which way the start really
was, how the distance guess compared). Second, the **guided path** that already
walks a first-time user through their own first real guess is tightened so it
disappears at exactly the right moment and is proven by test.

The guided walk-through already ships in `GuessFlow.tsx` (a four-step checklist
that ticks itself off, skippable, gated on `ic_seen_walkthrough`). This EPIC does
NOT rebuild it. It makes one correctness fix to when it retires, and it adds the
tests that prove every clause of the acceptance criteria. The sample reveal is
the net-new build.

---

## Quality differentiator (this EPIC lives or dies here)

**Immediacy: from opening the page to a true, surprising measurement of your own
sense of direction in under a minute, no install, no account, on the phone
already in your pocket.**

What that demands of THIS EPIC: the sample reveal IS the immediacy promise made
literal. The landing's first meaningful render is instant static content, and the
sample is one tap away with a client-side, synchronous compute that shows a real
scored measurement in well under a second. No location permission, no sensor, no
network, no typing. The measurement it shows must be the REAL reveal (the same
scoring engine and the same words the live loop uses) run on built-in
coordinates, never hardcoded result text and never a zeroed or trivial outcome. A
sample that reveals "0° off" or "spot on" teaches nothing and fails the bar. And
the honesty that the rest of the app is built on carries over: the sample counts
for nothing (it is never stored in the user's record and never marks the
walk-through as seen), so the record the differentiator compounds into stays
truthful.

---

## Scope

### In scope
- **A sample guess on the landing screen.** A subordinate `Try a sample guess`
  control that, on tap, reveals inline a real scored measurement computed by the
  existing engine (`initialBearingDeg`, `haversineDistanceM`, `bearingErrorDeg`,
  `describeBearing`, `describeDistance`, `compassPoint8`, `formatDistance`) from
  a set of built-in constants. It shows a non-zero bearing error and a non-zero,
  measurable distance result, using the same phrasing the live reveal uses.
- **A shared reveal-measurement view.** Extract the presentational measurement
  body of the live reveal (bucket headline, direction word, degrees-off line,
  distance line, verdict) into one component used by BOTH the live loop and the
  sample, so the sample is the real reveal and the copy has a single source.
- **Built-in sample data module** (`src/game/sampleGuess.ts`): the fixed
  coordinates and guess, plus a pure function that computes the measurement. Unit
  tested for non-zero, measurable, honest output.
- **Guided-path retire fix.** The walk-through is marked seen (retired forever)
  on the first *measurable* reveal, the same event that records a real guess. A
  barely-moved reveal (fails `isMeasurable`) no longer retires it, because the
  user has not completed a real guess yet.
- **Tests that prove every acceptance criterion** for the guided path and the
  sample.
- **A short, plain README line** naming the sample and the guided first run.

### Out of scope (binding non-goals — do NOT build)
- **No tutorial essays.** No paragraphs of instruction anywhere in the first-run
  surfaces. One short imperative sentence per guided step; one short intro line
  on the sample.
- **No multi-screen onboarding.** No onboarding route, no carousel, no modal
  sequence, no "step 1 of 5" wizard. The sample is inline on the landing; the
  guided path is the existing in-flow checklist.
- **No tips that outlive the first success.** Nothing new that keeps showing
  after the first completed real guess or to a returning user.
- **No new guess capture.** The sample does not use location, the compass, or any
  input. It does not persist. It does not touch the record or the
  `ic_seen_walkthrough` flag.
- **No changes to the live loop's phases, scoring, or record.** This EPIC reads
  the existing engine and existing walk-through; it does not change how a real
  guess is made, scored, or stored (beyond the single retire-timing fix above).
- **No backend, no seed script, no server-side demo.** SEED_DEMO for this
  static, account-less SPA is satisfied by the built-in sample (see Staging
  reachability). Do not add a server.

---

## Technical design

### Stack facts (already in place — do not change)
- React 18 + TypeScript + Vite; routing via `react-router-dom`; tests via
  Vitest + Testing Library in jsdom. `npm run build` runs
  `tsc --noEmit && vite build`; `npm test` runs `vitest run`.
- Design tokens in `src/styles/global.css` (`--bg`, `--surface`,
  `--surface-raised`, `--border`, `--text`, `--text-muted`, `--accent`,
  `--accent-strong`, `--accent-contrast`, `--danger`, `--focus`, `--radius`,
  `--content-max`, `--tap` = 44px). Use these; add no new color system.
- `src/game/geoMath.ts` — `initialBearingDeg`, `haversineDistanceM`,
  `bearingErrorDeg`, `signedBearingErrorDeg`, `distanceRatio`, `compassPoint8`.
  Reuse; do not duplicate.
- `src/game/scoring.ts` — `bearingBucket`, `describeBearing`, `describeDistance`,
  `isMeasurable`, `formatDistance`, `MIN_MEASURABLE_M`. Reuse; do not duplicate.
- `src/screens/Landing.tsx` (+ `Landing.module.css`) — the first screen at `/`.
  Currently: an `h1` `The Inner Compass`, a tagline, and one primary link
  `Start a walk` to `/guess`. `Landing.module.css` already carries unused
  `.status`, `.statusText`, `.resultCard`, `.mode` classes from a removed
  compass check; the sample panel may reuse `.resultCard` rather than adding new
  card styles.
- `src/screens/GuessFlow.tsx` — the live loop. Already holds a `Walkthrough`
  component (four steps, `Skip` button, `ic_seen_walkthrough` gate via
  `hasSeenWalkthrough` / `markWalkthroughSeen`, `showWalkthrough` shown only in
  `setup`/`guess` phases), a `Reveal` component whose measurement body this EPIC
  extracts, and `runRevealFix` which currently marks the walk-through seen after
  any successful fix. The measurable check `isMeasurable(trueDist, fix.accuracyM)`
  already gates persistence in `persistReveal`.

### Data model / migrations
None. There is no server and no database. The sample is stateless (nothing is
read or written for it). The only first-run state is the existing
`localStorage` key `ic_seen_walkthrough` (values `"1"` / absent), whose shape is
unchanged. No migration applies.

### New module: `src/game/sampleGuess.ts` (+ `sampleGuess.test.ts`)
Pure, no I/O. Holds the built-in scenario and computes the measurement so the
landing renders real numbers, and so the "non-zero, measurable, honest" guarantee
is unit-testable away from the DOM.

```ts
// A fixed, believable scenario: someone standing at `current` guessed the way
// back to `start`. Coordinates chosen so the truth is clearly non-zero and
// measurable, the bearing error is real but not humiliating, and the distance
// guess is honestly off. These are demo constants, not user data.
export const SAMPLE_GUESS = {
  current: { lat: 40.0, lng: -74.0 },      // where the sample walker is now
  start: { lat: 40.003, lng: -73.996 },    // the spot they are guessing back to
  guessedBearingDeg: 20,                    // they guessed roughly north-northeast
  guessedDistanceM: 650,                    // they guessed long
  fixAccuracyM: 8,                          // a good fix, so the reveal is measurable
  floorDeg: 10,                             // a decent compass margin
} as const;

export type SampleReveal = {
  directionWord: string;      // compassPoint8(trueBearing)
  bearing: BearingResult;     // describeBearing(errorDeg, floorDeg)
  guessedDistanceM: number;
  trueDistanceM: number;
  distance: DistanceResult;   // describeDistance(guessedDistanceM, trueDistanceM)
  measurable: boolean;        // must be true for the built-in constants
};

export function computeSampleReveal(): SampleReveal;
```

- `computeSampleReveal` derives `trueBearing = initialBearingDeg(current, start)`
  and `trueDist = haversineDistanceM(current, start)`, then
  `bearingErrorDeg(guessedBearingDeg, trueBearing)`,
  `describeBearing(error, floorDeg)`, `compassPoint8(trueBearing)`, and
  `describeDistance(guessedDistanceM, trueDist)`. It reuses the shared functions;
  it must NOT reimplement any scoring or geometry.
- With the constants above the outcome is, approximately: truth to the
  **northeast**, bearing error about **26°** (bucket `Close`, comfortably above
  the 10° floor so a concrete degrees-off number shows), true distance about
  **477 m** against a **650 m** guess (ratio about 1.36, verdict `long`), and
  `measurable === true`. The tests assert these as properties and with tolerance,
  not to the last digit (the engine is the source of the exact values).

### New shared component: extract `RevealMeasurement`
Extract the measurement body from `GuessFlow`'s `Reveal` into a small
presentational component so the live reveal and the sample render identical
words. Recommended location `src/screens/RevealMeasurement.tsx` (+ a module CSS,
or reuse `GuessFlow.module.css` classes if kept in that folder). It renders the
already-shipped markup with no behavior change:

- Props: `bearing: BearingResult | null`, `directionWord: string`,
  `guessedDistanceM: number | null`, `trueDistanceM: number`, and
  `showCompassCaption?: boolean` (default `true`).
- Renders exactly what `Reveal` renders today for the measurable branch: the
  bucket headline (when `bearing`), `It was to the {word}.`, the within-floor
  detail OR `{n}° off.`, the compass caption `Your compass reads to about ±{n}°.`
  (only when `showCompassCaption`), and the distance block
  (`You guessed {guess}. It was {truth}.` plus the verdict line).
- It renders ONLY the measurement. The nudge, `Guess again` / `New start`
  actions, and the `See your record` link stay in `GuessFlow` and are NOT part of
  this component.
- `GuessFlow`'s `Reveal` now composes `RevealMeasurement` (with
  `showCompassCaption` = true) plus its nudge/actions. The rendered DOM for the
  live reveal is unchanged, so every existing `GuessFlow.test.tsx` assertion
  (bucket text, direction text, `Your compass reads to about ±12°.`, distance
  line) stays green. If any existing string moves, it must move verbatim.

### Landing sample (`src/screens/Landing.tsx` + `Landing.module.css`)
Add the sample below the existing primary action, visibly subordinate to it
(QUALITY BAR §7: one obvious primary action; the sample is secondary).

- Keep the current `h1` `The Inner Compass`, the tagline, and the primary link
  `Start a walk` to `/guess` exactly as they are (existing Landing tests must
  stay green).
- Add a subordinate `Try a sample guess` control. A `<button type="button">`
  styled as a secondary/subtle action, not a second primary. It gives pressed
  feedback within 100ms (CSS `:active`), and it is keyboard reachable with a
  visible focus ring and a tap target ≥ 44px.
- On click, set local state `showSample = true` and render the sample panel
  inline below (a purely synchronous, client-side reveal). The panel:
  - an `h2` `A sample guess`,
  - one intro line `Here is a real guess scored against the truth.`,
  - the `RevealMeasurement` for `computeSampleReveal()`, passed
    `showCompassCaption={false}` (the landing has no device compass, so the
    device-specific caption is omitted; the concrete `{n}° off.` line still
    shows because the sample's error exceeds its floor),
  - a subordinate closing line `Now measure your own.` that points the user back
    up to the primary `Start a walk`. Do not add a second `Start a walk` control.
- The panel reuses `.resultCard` (or an equivalent existing card token). Mobile
  first: single column within `--content-max`, usable at 390px with no
  horizontal scroll, labels ≥ 12px, sufficient contrast.
- The sample never persists and never touches `ic_seen_walkthrough`. It is a
  read-only render of built-in data.

### Guided-path retire fix (`src/screens/GuessFlow.tsx`)
Today `runRevealFix` calls `markWalkthroughSeen()` after any successful fix,
including a barely-moved (non-measurable) reveal. Align the retire event with the
"first completed real guess":

- Compute measurability once for the reveal (the same
  `isMeasurable(trueDist, fix.accuracyM)` the persistence path uses) and gate BOTH
  the record append AND the walk-through retire on it. The cleanest shape: have
  `persistReveal` (or a small helper) return whether the reveal was measurable,
  and in `runRevealFix` mark the walk-through seen only when it was.
- A measurable reveal: append the row (unchanged) AND, if unseen, mark seen and
  set `seenWalkthrough`. A barely-moved reveal: append nothing (unchanged) AND
  leave the walk-through available, so the next real attempt still guides the
  user.
- The explicit `Skip` path (`skipWalkthrough`) is unchanged: skipping retires the
  walk-through immediately and permanently.
- Do not add steps, do not change the four step sentences, and do not change the
  `showWalkthrough` visibility rule. The path already satisfies "at most four
  one-sentence steps, each pinned to a real control, skippable, shown only until
  first success". This fix only corrects the retire timing.

### Routing / nav
No route changes. The sample is inline on `/`. Do not add a `/sample` route or
any nav entry.

### Staging reachability (SEED_DEMO)
No STAGING DEPLOY CONTRACT block was supplied to this spec. For this static,
account-less SPA there is no server-side data to seed, so the SEED_DEMO intent
("the deployed app shows its differentiator within a minute without hand-crafted
input") is met entirely by the built-in sample: the landing at `/` is the first
route, renders instantly as static content, and the sample is one tap away with a
synchronous compute. If a STAGING DEPLOY CONTRACT with a `SEED_DEMO` variable is
present at deploy time, the built-in sample already satisfies it. Do not add a
backend to honor it.

### Security / privacy (client-only app)
No server routes, no auth surface, no accounts, no new input boundary (the sample
takes no user input). The sample uses built-in demo constants, not the user's
location, so no coordinates of the user are involved. Do not log the sample or
the walk-through state. No PII in logs. No network call is added.

---

## Ordered task list

**T1 — Extract `RevealMeasurement` from `GuessFlow`'s `Reveal`.**
AC:
- A presentational component renders the live reveal's measurement body (bucket
  headline, `It was to the {word}.`, within-floor detail or `{n}° off.`, the
  compass caption behind `showCompassCaption`, and the distance block with
  verdict), and `GuessFlow`'s `Reveal` composes it.
- The live reveal's rendered DOM and text are unchanged: every existing
  `GuessFlow.test.tsx` assertion still passes.

**T2 — Built-in sample module `src/game/sampleGuess.ts` (+ tests).**
AC:
- `SAMPLE_GUESS` constants and `computeSampleReveal()` exported.
- `computeSampleReveal()` returns `measurable === true`, a bearing error strictly
  greater than 0 and greater than `SAMPLE_GUESS.floorDeg` (so a concrete
  degrees-off number shows), a true distance strictly greater than 0, and a
  distance verdict that is not `spot_on` (a real over- or under-estimate).
- It reuses `geoMath` / `scoring`; it contains no reimplemented geometry or
  scoring.

**T3 — Landing sample (`src/screens/Landing.tsx` + `Landing.module.css`).**
AC:
- The landing keeps its `h1`, tagline, and single primary `Start a walk` link.
- A subordinate `Try a sample guess` button is present, keyboard reachable, tap
  target ≥ 44px, with pressed feedback.
- Clicking it reveals the sample panel: heading `A sample guess`, intro line, the
  `RevealMeasurement` for the built-in sample (compass caption hidden), and the
  closing line. The panel shows a non-zero degrees-off number and a real distance
  line with a verdict.
- The sample renders synchronously (no async, no location, no sensor) and writes
  nothing to storage.

**T4 — Guided-path retire fix (`src/screens/GuessFlow.tsx`).**
AC:
- A measurable reveal retires the walk-through (sets `ic_seen_walkthrough`); a
  barely-moved reveal does not.
- `Skip` still retires it immediately.
- The four step sentences, the step count, and the `showWalkthrough` visibility
  rule are unchanged.

**T5 — Tests, copy sweep, README, full build.**
AC:
- The unit and component tests in the Test plan pass.
- Copy sweep passes on every string this EPIC adds or edits.
- `README.md` gains a short, plain mention of the sample guess and the guided
  first run (for strangers, no pipeline jargon).
- `npm run build` and `npm test` both pass.

---

## Test plan (each acceptance criterion → the test that proves it)

Run the whole suite with `npm test` (Vitest, jsdom). Render Landing and GuessFlow
inside `MemoryRouter`, following the existing `Landing.test.tsx` /
`GuessFlow.test.tsx` patterns. Clear `localStorage` around GuessFlow tests
(existing `beforeEach`/`afterEach` already do).

**AC: the landing states what the app does and offers one obvious primary action;
the sample yields a real reveal with non-zero bearing and distance.**
`sampleGuess.test.ts` — `computeSampleReveal()` returns `measurable === true`,
`bearing.errorDeg > SAMPLE_GUESS.floorDeg` (and `> 0`), `trueDistanceM > 0`, and
`distance.verdict !== "spot_on"`. Assert the approximate expected values with
tolerance (direction `northeast`; error near 26°; true distance near 477 m;
verdict `long`) so a regression in the constants is caught without pinning exact
digits.
`Landing.test.tsx` — the existing assertions (the `h1`, the tagline, the single
`Start a walk` primary link to `/guess`) still pass. New: clicking
`Try a sample guess` renders the sample panel; assert a concrete degrees-off
string (`/\d+° off\./`) and a distance line (`/You guessed .* It was .*/`) are in
the panel, and that the panel is absent before the click. Assert no coordinates,
sensor, or storage were touched (the record store stays empty:
`loadGuesses()` is `[]`).

**AC: the guided path is at most four one-sentence steps pinned to real controls,
skippable, and disappears permanently after the first completed real guess and
for returning users.**
`GuessFlow.test.tsx` (extend the existing `guided first run` block) —
- Step count and shape: the walk-through renders at most four steps, each a
  single short imperative sentence (assert the four known step texts render and
  no fifth list item exists). The controls they name are present in the flow
  (`Mark this spot` / distance input / `Lock direction` / `Reveal`, matching the
  `data-step` attributes).
- Skippable: clicking `Skip` hides the walk-through and sets
  `ic_seen_walkthrough` to `"1"` (existing test).
- Returning user: with `ic_seen_walkthrough` preset, the walk-through never
  renders (existing test).
- Retires on the first completed real guess: after a *measurable* reveal the flag
  is set and the walk-through does not return on remount (existing test, still
  valid).
- New — does NOT retire on a barely-moved reveal: drive a barely-moved reveal
  (reveal fix at the anchor, as in the barely-moved-guard test) with the
  walk-through unseen; assert `ic_seen_walkthrough` is still absent afterward and
  the walk-through is still available (e.g. remount in `setup`/`guess` shows the
  first step). This proves the retire event is the real guess, not any reveal.

**AC: the live reveal is unchanged by the extraction.**
`GuessFlow.test.tsx` — the full existing suite (commit gate, bearing path,
distance-only path, fixing/error states, barely-moved guard, nudges, persistence,
`See your record` link, commit validation) passes without edits to its
assertions.

**AC: on a fresh staging deploy with no input, the sample is reachable within a
minute.**
Proven structurally rather than by a timer: the sample is on `/` (the first
route), renders from built-in constants with no async, location, sensor, or
network, and `Landing.test.tsx` reaches the scored measurement with a single
click and no mocks of geolocation or headings. Note the manual staging check (open
the deployed URL, tap `Try a sample guess`, see a scored measurement) in the run
summary; the DOM test is the automated proxy.

**AC: copy sweep passes.**
Mechanical + read-aloud sweep of every string this EPIC adds or edits (the
`Try a sample guess` button, the `A sample guess` heading, the sample intro and
closing lines, any moved reveal strings, the README additions): no `—` or `–`;
none of the banned LLM vocabulary; no negative empty-state phrasing (`You don't
have`, `No … yet`, `Nothing … here`, `Unable to`, `Something went wrong`); no
tutorial-essay padding. Record the sweep result in the run summary.

---

## Copy inventory (ship verbatim — already swept)

Landing sample:
- sample toggle button `Try a sample guess`
- sample panel heading `A sample guess`
- sample intro line `Here is a real guess scored against the truth.`
- sample closing line `Now measure your own.`

Reused verbatim from the live reveal (via `RevealMeasurement`, already swept):
- direction line `It was to the {word}.`
- degrees-off line `{n}° off.`
- distance line `You guessed {guess}. It was {truth}.`
- verdict lines `Spot on.` / `You guessed short.` / `You guessed long.`
- bucket headlines `Dead on` / `Close` / `Off by a bit` / `Well off` /
  `Turned around`

Guided path (already shipped, unchanged, listed for the sweep record):
- steps `Mark where you are standing now.`,
  `Walk somewhere, then open this again.`,
  `Point your phone back at your start and lock it.` /
  `Guess how far you walked.` (distance-only),
  `Type the distance, then tap Reveal.`
- skip button `Skip`

All strings above contain no em-dashes or en-dashes, no banned LLM vocabulary, no
negative empty-state phrasing, and no improvement promise. The sample describes a
fixed scenario scored by the real engine; it never flatters and never claims the
viewer is improving. Sweep every string again if you edit any of them.
