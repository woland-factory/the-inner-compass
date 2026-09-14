# EPIC SPEC — The gated guess and the reveal

The core loop of The Inner Compass. Before any answer is shown, the user
commits a guess (a locked bearing, or an explicit distance-only choice, plus a
typed distance). One geolocation fix then reveals the truth: how far off their
direction was, which way the target really is, and how their distance guess
compared. No persistence, no charts, no LLM. This EPIC turns the sensor layer
that already ships into a game a stranger can play once and trust.

---

## Quality differentiator (this EPIC lives or dies here)

**Immediacy: from opening the page to a true, surprising measurement of your own
sense of direction in under a minute, no install, no account, on the phone
already in your pocket.**

What that demands of THIS EPIC: the loop is the whole product a stranger sees
first, so every step from landing to reveal must be one tap away from the last,
with no account, no setup screen, and no dead ends. The heaviest thing between
the user and their measurement is a single location fix. Its loading and error
states must keep the user moving, never strand them. The reveal must land as a
concrete, honest number the user did not already know. Politeness that flatters
(fake precision below the compass floor, "you're improving" with no data) breaks
the one thing the product sells: a mirror that never lies.

---

## Scope

### In scope
- **Target selection.** Set a **home** anchor, or mark a **walk-start** anchor
  ("here, now"). Each is one captured location fix held in memory for the
  session. Home, once set, is reused within the session; walk-start is captured
  fresh each walk.
- **Point-and-lock bearing capture.** When the device has a trustworthy compass
  (`compass_ok`), the user aims the phone at the anchor and locks the reading.
- **Explicit distance-only path.** When heading is `absent` or
  `compass_unreliable`, the flow goes straight to distance only. When the
  compass is fine, the user may still choose distance only. Either way a full
  guess and reveal completes with no dead end.
- **Typed distance estimate**, validated at the input boundary, with a
  meters/kilometers unit toggle.
- **The commit gate.** Nothing derived from the target (true direction, true
  distance, bearing bucket, distance ratio, or a map) is rendered until the
  user commits both a bearing (or the explicit distance-only choice) and a
  distance.
- **One geolocation fix at reveal**, great-circle initial-bearing and haversine
  distance math, then the reveal: a bucketed bearing error with the accuracy
  floor visible, the true compass direction in words, and the distance ratio.
- **Exactly one strategy nudge** from a fixed set per guess, rotating.
- **Guided first run** (QUALITY BAR §4) that walks a new user through one
  successful loop, skippable, shown only until the first success.
- All required designed states (empty/initial, loading, error) for the two
  location fixes (anchor capture and reveal).

### Out of scope (binding non-goals — do NOT build)
- **No persistence of game data and no charts.** No saved guesses, scores, or
  history; no trend view. Session state is in-memory React state only. The
  single exception is one localStorage flag that records the guided-first-run
  was completed (see Technical design). It stores no game data and exists only
  to satisfy the QUALITY BAR §4 "never again after first success" rule.
- **No target types beyond home and walk-start.** No saved places, no address
  entry, no picking a point on a map.
- **No LLM narration.** Nudges and reveal copy are fixed strings, not generated.
- No map rendering. The reveal is words and numbers.
- No backend, accounts, or server routes (the app stays a static SPA).

---

## Technical design

### Stack facts (already in place — do not change)
- React 18 + TypeScript + Vite; routing via `react-router-dom`; tests via
  Vitest + Testing Library in jsdom.
- Design tokens in `src/styles/global.css` (`--accent`, `--surface`, `--tap:
  44px`, `--radius`, focus ring, `prefers-reduced-motion` reset). Dark theme.
- Sensor layer in `src/sensors/`:
  - `heading.ts`: `detectHeadingCapability()`, `guessModeFor()`,
    `needsHeadingPermission()`, `requestHeadingPermission()`, the
    `HeadingCapability` / `GuessMode` types, `COMPASS_OK_MAX_ACCURACY_DEG` (25),
    `ANDROID_ABSOLUTE_ACCURACY_FLOOR_DEG` (15). Reuse these; do not duplicate
    detection.
  - `geolocation.ts`: `getPositionOnce()` → `GeoResult`
    (`ok` with `lat/lng/accuracyM/timestamp`, or `ok:false` with reason
    `permission_denied | timeout | unavailable | unsupported`). Use as-is for
    both the anchor fix and the reveal fix.
- `App.tsx` reserves `/guess` and `/reveal`. This EPIC uses `/guess` for the
  whole loop (one self-contained screen with internal phases). `/reveal` stays
  unused; do not split the loop across routes (splitting would lose the
  in-memory guess between navigations and weaken the commit-gate guarantee).

### Data model / migrations
There is no database and no server. No migrations apply. State is:
- **In-memory (React state) for the session:** the current anchor
  (`{ kind: "home" | "walk_start"; lat; lng; accuracyM }`), the detected
  `HeadingCapability`, the locked guess (`{ mode: "bearing" | "distance_only";
  bearingDeg?: number; distanceM: number }`), the reveal fix, and the rotating
  nudge index.
- **One localStorage key** `ic_seen_walkthrough` = `"1"`, written when the user
  finishes or skips the guided first run. It is the only persisted value and
  holds no game data.

### New modules

**`src/game/geoMath.ts`** (pure, no I/O). Coordinates are `{ lat: number; lng:
number }` in degrees.
- `initialBearingDeg(from, to): number` — great-circle initial bearing,
  normalized to `[0, 360)`.
- `haversineDistanceM(from, to): number` — great-circle distance in meters
  (Earth radius 6_371_000 m).
- `bearingErrorDeg(guessDeg, trueDeg): number` — smallest absolute angular
  difference in `[0, 180]` (handles wraparound: 350 vs 10 → 20).
- `distanceRatio(guessM, trueM): number` — `guessM / trueM`.
- `compassPoint8(deg): string` — nearest of eight points as a lowercase word
  (`"north"`, `"northeast"`, … `"northwest"`), each covering a 45° sector
  centered on the point (north spans 337.5–360 and 0–22.5).

**`src/game/scoring.ts`** (pure). Turns raw math into honest, floor-aware display
data. No user-facing strings that the components do not also own; return
structured data plus the fixed labels.
- `BEARING_BUCKETS` (fixed, by error `e` in degrees, aligned to the 45° sectors):
  - `e ≤ 22.5` → `"Dead on"`
  - `22.5 < e ≤ 45` → `"Close"`
  - `45 < e ≤ 90` → `"Off by a bit"`
  - `90 < e ≤ 135` → `"Well off"`
  - `135 < e ≤ 180` → `"Turned around"`
- `describeBearing(errorDeg, floorDeg): { bucket: string; withinFloor: boolean;
  errorDeg: number; floorDeg: number }` — `withinFloor` is true when
  `errorDeg <= floorDeg`; components use it to show "inside your compass's
  ±{floor}° margin" instead of a false-precision sub-floor number. The bucket is
  always computed from the raw error.
- `describeDistance(guessM, trueM): { ratio: number; verdict: "spot_on" |
  "short" | "long" }` — `spot_on` when `0.8 ≤ ratio ≤ 1.25`, `short` below,
  `long` above.
- `MIN_MEASURABLE_M` (e.g. 25) and `isMeasurable(trueM, accuracyM): boolean` —
  true only when `trueM >= max(MIN_MEASURABLE_M, 2 * accuracyM)`. Guards the
  standing-still / within-GPS-noise case where bearing and ratio are
  meaningless (also prevents divide-by-zero).
- `formatDistance(meters): string` — meters under 1000 (`"320 m"`), kilometers
  at/above (`"1.4 km"`, one decimal). Used for both the guess and the truth.

**`src/sensors/liveHeading.ts`** (live compass stream for point-and-lock;
one-shot `detectHeadingCapability` cannot drive an aim UI).
- `headingFromEvent(source, event): number | null` — **pure**, unit-tested.
  For `ios_compass`, returns `webkitCompassHeading` when it is a number.
  For `android_absolute`, returns `(360 - alpha) mod 360` when `alpha` is a
  number. Returns `null` otherwise.
- `subscribeHeading(source, cb): () => void` — subscribes to the appropriate
  orientation event, maps each reading through `headingFromEvent`, calls `cb`
  with the degrees, and returns an unsubscribe function. Live behavior is
  device-only, so add its checks to `docs/sensor-verification.md`; the pure
  `headingFromEvent` carries the automated coverage.

**`src/game/nudges.ts`** (pure).
- `NUDGES: string[]` — the fixed set (six entries; copy in the Copy inventory).
- `nudgeAt(index): string` — `NUDGES[index % NUDGES.length]`. The screen holds
  a per-session counter, incremented once per committed guess, so exactly one
  nudge shows per guess and it rotates.

### The screen: `src/screens/GuessFlow.tsx` (+ `GuessFlow.module.css`)

A single screen mounted at `/guess`, driven by a phase state machine. The
existing `Landing` (`/`) keeps its identity and its tagline; its primary button
becomes a link that navigates to `/guess` (drop the compass-check demo from
Landing — detection now lives inside the flow, where it must run from a user
gesture to choose bearing vs distance-only; update `Landing.tsx`,
`Landing.test.tsx`, and its copy accordingly).

Phases:
1. `setup` — no anchor yet. Two controls: **Mark this spot** (walk_start,
   primary) and **Set as home** (home, secondary). Pressing either shows the
   anchor loading state, then runs one `getPositionOnce()`.
   - On success: store the anchor, run compass permission (only if
     `needsHeadingPermission()`) then `detectHeadingCapability()` from the same
     gesture chain, store the capability, advance to `guess`.
   - On failure: show the reason-specific error state with a Retry that re-runs
     the fix. `unsupported` shows a no-retry message.
2. `guess` — the commit gate. Renders the guess controls only. No target-derived
   value is in the DOM here.
   - `bearing` mode (`compass_ok`): a compass dial that tracks the live heading
     via `subscribeHeading`, showing the phone's current aim in degrees (this is
     the user's own input, not a hint about the answer). A **Lock direction**
     button captures the current heading; after locking it shows a locked state
     with a **Change** affordance. A subordinate **Skip direction** control sets
     distance-only.
   - `distance_only` mode (auto when `absent`/`compass_unreliable`, or after
     Skip): no bearing UI; a one-line explanation of why.
   - Distance input: a labeled numeric field plus a meters/kilometers toggle.
     Validate on the boundary: parse to a number, require `> 0`, cap at
     `20_000 km` (~max great-circle distance). Reject NaN/negative/over-cap
     without advancing.
   - **Reveal** (primary, commit) is disabled until (`bearing` locked OR
     `distance_only` chosen) AND a valid distance is entered. Pressing it
     synchronously advances to `fixing` (feedback < 100ms), then runs one
     `getPositionOnce()`.
3. `fixing` — designed loading state for the reveal fix (spinner/skeleton in
   place, layout held steady, honest copy). No white screen.
4. `reveal` — computed from the reveal fix (current position) to the anchor:
   `trueBearing = initialBearingDeg(current, anchor)`,
   `trueDist = haversineDistanceM(current, anchor)`.
   - If `!isMeasurable(trueDist, fix.accuracyM)`: show the "barely moved" state
     with **Guess again** (not a dead end).
   - `bearing` mode: bucket headline from `describeBearing(bearingErrorDeg(guess,
     trueBearing), floorDeg)`; the true direction in words
     (`compassPoint8(trueBearing)`); the floor caption; then the distance block.
   - `distance_only` mode: no bearing bucket; show the true direction in words as
     information; then the distance block.
   - Distance block from `describeDistance`: the user's guess, the truth, and the
     verdict phrase, using `formatDistance`.
   - Exactly one nudge via `nudgeAt(nudgeIndex)`.
   - Actions: **Guess again** (returns to `guess` keeping a set home anchor, or
     to `setup` for walk_start), plus **New start** to re-anchor.
   - `floorDeg` for the caption/`describeBearing` comes from the stored
     `HeadingCapability.accuracyDeg`; when it is null, use
     `ANDROID_ABSOLUTE_ACCURACY_FLOOR_DEG`.
5. `error` — reveal-fix failure. Reason-specific copy (permission_denied,
   timeout, unavailable, unsupported) that says what to do next, with a Retry
   that re-runs the fix (no retry for `unsupported`).

**Guided first run (QUALITY BAR §4).** When `ic_seen_walkthrough` is absent,
overlay a skippable 4-step guided path anchored to the real controls (steps in
the Copy inventory; step 3 swaps to a distance line in distance-only mode). Each
step is one short imperative sentence with a highlighted next control and a
**Skip**. It advances as the user acts, disappears on the first reveal, and
writes `ic_seen_walkthrough = "1"` on completion or skip. It never renders again
once the flag is set.

**Feedback < 100ms.** Every button carries the token `:active` pressed style.
Reveal, Lock, Mark/Set, and Retry all change React state synchronously before
any await, exactly like the existing `Landing` pattern.

### Security / privacy (client-only app)
- No server routes, no auth surface, no accounts. The relevant hygiene here is
  input validation at the distance boundary (above) and **no PII in logs**: never
  log coordinates, headings, or the reveal fix. Sentry stays on the existing
  ErrorBoundary; do not add breadcrumbs carrying location.
- The mode marker uses `data-mode` like the existing Landing card. Give the
  reveal container a stable `data-testid="reveal"` that mounts only in the
  `reveal`/error phases, so the gate is testable by absence.

---

## Ordered task list

**T1 — Pure geo math (`src/game/geoMath.ts`) + tests.**
AC:
- `initialBearingDeg`, `haversineDistanceM`, `bearingErrorDeg`, `distanceRatio`,
  `compassPoint8` implemented and exported.
- Verified against fixed coordinate pairs (see Test plan) within tolerance.

**T2 — Scoring/format (`src/game/scoring.ts`) + tests.**
AC:
- `describeBearing` returns the correct bucket for boundary errors and sets
  `withinFloor` correctly relative to the floor.
- `describeDistance` returns `spot_on | short | long` at the 0.8 / 1.25 edges.
- `isMeasurable` is false at/below `max(MIN_MEASURABLE_M, 2*accuracyM)` and true
  above; `formatDistance` switches m→km at 1000 m.

**T3 — Live heading (`src/sensors/liveHeading.ts`) + tests; docs update.**
AC:
- `headingFromEvent` maps iOS `webkitCompassHeading` and Android absolute
  `alpha` correctly and returns `null` for unusable events (unit tested).
- `subscribeHeading` subscribes, forwards mapped readings, and unsubscribes.
- `docs/sensor-verification.md` gains on-device point-and-lock checks.

**T4 — Nudges (`src/game/nudges.ts`) + tests.**
AC:
- `NUDGES` holds the fixed set; `nudgeAt` wraps by modulo. Exactly one string
  returned per index.

**T5 — GuessFlow screen + CSS + routing + Landing update.**
AC:
- `/guess` renders the phase machine; `/` Landing links into it and no longer
  runs its own compass check.
- Commit gate holds: nothing target-derived renders before commit.
- Bearing and distance-only paths both reach a reveal.
- All designed states present (setup/loading/error for both fixes, fixing,
  reveal, barely-moved), mobile-first at 390px, tap targets ≥ 44px, labeled
  inputs, visible focus, keyboard reachable.
- Guided first run present, skippable, gated by `ic_seen_walkthrough`.
- Exactly one nudge on each reveal; rotates across guesses.

**T6 — Component tests, copy sweep, README, full build.**
AC:
- Component tests below pass.
- Copy sweep passes on every string this EPIC adds or edits.
- `README.md` updated so a stranger understands and can run the loop.
- `npm run build` (tsc + vite) and `npm test` both pass.

---

## Test plan (each acceptance criterion → the test that proves it)

Run the whole suite with `npm test` (Vitest, jsdom). Mock `getPositionOnce`,
`detectHeadingCapability`, `requestHeadingPermission`, and `subscribeHeading` in
component tests, following the existing `Landing.test.tsx` mocking pattern.

**AC: nothing rendered before commit.**
`GuessFlow.test.tsx` — drive to the `guess` phase (mock a successful anchor fix
and a `compass_ok` capability). Assert `queryByTestId("reveal")` is null and
that no true-direction word, distance truth, bucket label, or ratio text is
present. Lock a bearing, enter a distance, press **Reveal** (mock the reveal
fix), then assert the reveal container and its values appear only now.

**AC: bearing error and distance ratio correct; buckets with floor visible.**
`geoMath.test.ts` with fixed inputs:
- `(0,0)→(0,1)` bearing `90`, distance `≈111_195 m` (±50 m).
- `(0,0)→(1,0)` bearing `0`; `(0,0)→(-1,0)` bearing `180`; `(0,0)→(0,-1)`
  bearing `270`.
- A mid-latitude pair (e.g. London→Paris) bearing `≈156°` and distance `≈343 km`
  within tolerance.
- `bearingErrorDeg(350,10)===20`, `(10,350)===20`, `(90,270)===180`, `(0,0)===0`.
- `distanceRatio(200,100)===2`; `compassPoint8` at 0/45/90/…/337.6 → expected
  words.
`scoring.test.ts` — bucket boundaries (22.5, 45, 90, 135), `withinFloor` at and
past the floor. `GuessFlow.test.tsx` asserts the reveal shows the bucket label
and a visible floor caption containing the floor number.

**AC: distance-only completes with no dead end.**
`GuessFlow.test.tsx` — mock capability `absent` (and separately
`compass_unreliable`). Assert no bearing/lock control renders, enter a distance,
press Reveal (mock fix), assert a full reveal with the distance verdict and the
true direction word, and no bearing bucket. Also test the explicit **Skip
direction** path from a `compass_ok` device reaching the same reveal.

**AC: feedback < 100ms; designed loading and error states for the fix.**
`GuessFlow.test.tsx` — pressing Reveal synchronously shows the `fixing` state
before the fix promise resolves (resolve it manually, as `Landing.test.tsx` does
with a deferred promise). Mock the reveal fix returning `permission_denied` and
`timeout`; assert each renders its designed, next-step copy and a working Retry
(and that `unsupported` shows no Retry). Same for the anchor fix in `setup`.

**AC: exactly one strategy nudge per guess, rotating.**
`nudges.test.ts` — `nudgeAt` wraps by modulo. `GuessFlow.test.tsx` — assert
exactly one nudge element on a reveal, and that a second guess shows the next
nudge in the set.

**AC: guided first run.**
`GuessFlow.test.tsx` — with `ic_seen_walkthrough` unset, the walkthrough renders
and is skippable; after a reveal the flag is set and it does not render on a
subsequent mount. (Clear localStorage in `afterEach`.)

**AC: copy sweep passes.**
Manual + mechanical sweep across every string added or edited (GuessFlow,
Landing, nudges, scoring/format labels, README): no `—` or `–`; none of the
banned LLM vocabulary; no negative empty-state phrasing (`"You don't have"`,
`"No … yet"`, `"Nothing … here"`, `"Unable to"`, `"Something went wrong"`); no
improvement promise (the app never claims the user is getting better — there is
no history this EPIC). Record the sweep result in the run summary.

---

## Copy inventory (ship verbatim — already swept)

Landing (`/`): h1 `The Inner Compass`; tagline `Find out how well you know which
way things really are.`; primary button `Start a walk` (navigates to `/guess`).

Setup: heading `Where are you measuring from?`; helper `Pick a spot now, walk
away, then find your way back.`; primary `Mark this spot`; secondary `Set as
home`.

Anchor + reveal fix, loading: `Finding where you are.`
Errors (what-to-do-next):
- permission_denied: `Location is blocked. Turn it on in your browser, then tap
  Retry.`
- timeout: `That took too long. Step into the open and tap Retry.`
- unavailable: `Location is not ready yet. Tap Retry.`
- unsupported: `This browser cannot share location. Open the app in Safari or
  Chrome.`
Retry button: `Retry`.

Guess, bearing: prompt `Point your phone at it and lock it in.`; live readout
`{deg}°`; `Lock direction`; locked `Locked`; `Change`; subordinate `Skip
direction`.
Guess, distance-only line: `This device measures by distance. Guess how far away
it is.`
Distance input label: `How far away is it?`; unit toggle `m` / `km`; commit
`Reveal`.

Fixing (reveal): `Getting your location.`

Reveal, bearing headline: one of `Dead on` / `Close` / `Off by a bit` / `Well
off` / `Turned around`. Direction line: `It was to the {word}.` Detail when
above floor: `{n}° off.` When within floor: `Inside your compass's ±{floor}°
margin.` Floor caption: `Your compass reads to about ±{floor}°.`
Reveal, distance line: `You guessed {guess}. It was {truth}.` Verdict: `Spot on.`
/ `You guessed short.` / `You guessed long.`
Barely-moved: `You barely moved. Walk a bit farther, then guess again.`
Nudge line: `For next time: {nudge}`
Actions: `Guess again`; `New start`.

Nudges (fixed set):
1. `Track your turns as you walk. Count the lefts and rights.`
2. `Notice where the sun sits when you set out.`
3. `Pick a far landmark and keep it behind you.`
4. `Say the direction out loud before you look.`
5. `Picture the route as one line, not a list of streets.`
6. `Feel which way the ground slopes. Hills hold their bearing.`

Guided first run (4 steps):
1. `Mark where you are standing now.`
2. `Walk somewhere, then open this again.`
3. `Point your phone back at your start and lock it.` (distance-only:
   `Guess how far you walked.`)
4. `Type the distance, then tap Reveal.`
Skip control: `Skip`.

All strings above contain no em-dashes or en-dashes, no banned LLM vocabulary,
no negative empty-state phrasing, and no improvement promise.
