# PRODUCT PLAN — The Inner Compass

## Core value (one sentence)

Commit a spatial belief (which way a personal anchor is, and how far)
before any map can load, then see it scored against one GPS fix and
appended to a longitudinal record that reveals your personal error
signature.

## North star

A user who has walked with The Inner Compass for months opens it the way
they'd glance at a resting heart rate: a number they trust because the
app has never once flattered them. They know their own directional
tells the way they know their handwriting. Home still surprises them
some mornings, and that surprise is welcome, because the record beside
it proves the surprise is smaller than it used to be at the one thing
the app actually measures. The feeling is quiet self-knowledge that
compounds: an honest mirror for a sense most people only discover they
have when they notice it fading. The standard is that every number on
the screen is true, stated with its own uncertainty, and worth keeping.

## Quality differentiator (the one dimension we win on)

**Immediacy.** From opening the page to a true, surprising measurement
of your own sense of direction in under a minute, with no install and no
account. The closest real alternative (TrueNorth Compass Trainer) is an
iOS install that trains a different skill; every advice article offers
practice you can't measure. We win by putting a real, honest reveal in a
stranger's hands faster than anything else can, on the device already in
their pocket. This is also our retention insurance: many users will take
one walk, so the first reveal must land on its own.

## Signature moment

The gated reveal. You point your phone, lock a bearing, type a distance,
and only then does one location fix answer back on a single screen:
"You were 58° off. You believed home was north. It's east-northeast.
Your distance guess was 1.9× the real distance." It is surprising and a
little humbling in a way generic advice never is. Its compounding
sibling arrives weeks later, when the record can state your error
signature in your own data: "Your distance guesses run about 1.4× high
after you change trains."

## What the evidence forces into the plan (binding)

From VALIDATION.md, three conditions are load-bearing and thread through
every EPIC:

1. **Distance is the hero metric, bearing is second.** The controlled
   study found feedback alone improved distance and sketch-map accuracy
   but not bearing. The distance estimate is also noise-free (a typed
   number, no sensor error). Charts lead with distance calibration.
2. **Ship strategy nudges, not just scores.** One allocentric prompt per
   guess ("Keep track of which way north is as you walk today") is the
   ingredient the study found necessary for bearing to improve. It is
   nearly free to build and it is the difference between the product
   working and flat-lining.
3. **Never promise improvement.** Copy promises measurement, the error
   signature, and an evidence-based practice structure. A flat bearing
   line must still read as the app telling the truth, not failing.

And one technical condition:

4. **Sensor honesty with a designed distance-only fallback.** Web
   heading is roughly 10° accurate on iOS and drifts on Android; it is
   missing on some devices. Bearing scores are bucketed, the accuracy
   floor is shown on every reveal, and when heading is absent or
   unreliable the app degrades to distance-only mode (the
   evidence-backed channel anyway), never a broken or dishonest loop.

## MVP user stories

- As a first-time visitor, I understand what the app does and see one
  real, surprising reveal from a sample within a minute, before I commit
  to anything.
- As a new user mid-walk, I set my home once, then commit a bearing and a
  distance to it with no map or numbers shown until I lock both in.
- As a user who just committed, I get one location fix and a single
  reveal screen: bucketed bearing error with its accuracy floor, the true
  direction, and my distance ratio.
- As a user on a phone with no reliable compass, I still get a full
  distance-only guess and reveal, with no dead end.
- As a returning user, I pick a fresh target (home, or "here, now" as the
  walk-start point) so the guess stays hard.
- As a repeat user, I open my record and see my distance calibration
  trend first, my bearing trend second, and once I have enough guesses,
  plain statements of my error signature.
- As any user, I export my record to a file and import it back, because
  the record is mine and lives on my device.
- As a user each guess, I get one short strategy nudge tied to the flow.

## Data model sketch (client-side, localStorage)

- **Anchor**: `{ id, label, lat, lng, createdAt }`. "Home" is the first
  anchor. Walk-start anchors are captured as "here, now".
- **Guess**: `{ id, timestamp, targetKind: home|walk_start,
  targetLabel, targetLat, targetLng, originLat, originLng,
  guessedBearingDeg (nullable in distance-only), trueBearingDeg,
  bearingErrorDeg (signed) , guessedDistanceM, trueDistanceM,
  distanceRatio, headingSource: ios_compass|android_absolute|none,
  headingAccuracyDeg (nullable), nudgeId }`.
- **Settings**: `{ units: metric|imperial, seenWalkthrough: bool }`.
- **Derived (computed, never stored)**: rolling means, bucketed bearing
  distribution, distance-ratio trend, error-signature statements.

## Screen inventory (no server; single-page app routes)

- `/` — first-run landing: what it is in one line, primary action, and a
  "Try a sample guess" demo that produces a real reveal.
- `/guess` — the gated flow: choose target → point and lock bearing (or
  skip to distance-only) → type distance → commit. No answer surface
  visible until commit.
- `/reveal` — the signature moment (one location fix, then the scored
  reveal + strategy nudge). Designed loading and error states for
  geolocation.
- `/record` — trend charts (distance ratio first, bearing second),
  capped/paginated guess list, error-signature statements past a data
  threshold, empty and low-data states.
- `/settings` — units, home anchor management, export/import, sensor
  status and how to enable it.

No backend endpoints. The only network calls are the analytics script
and error-tracking beacon; all product data stays on device.

## EPIC list (build order)

### EPIC 1 — Shell, sensor capability layer, staging scaffold
**Scope.** Mobile-first app shell and routing. A sensor capability module
that detects heading availability and quality per platform (iOS
`DeviceOrientationEvent.requestPermission()` behind a user gesture,
`webkitCompassHeading` + `webkitCompassAccuracy`; Android
`deviceorientationabsolute`; absent → distance-only) and a Geolocation
wrapper with timeout and permission handling. Staging deploy scaffold
(Dockerfile serving the built static app + `docker-compose.staging.yml`).
Analytics (`UMAMI_WEBSITE_ID`/`UMAMI_URL`) and error tracking
(`SENTRY_DSN`) wired, safe when env is absent. README for strangers.
Because a magnetometer cannot be tested headlessly, commit a real-device
sensor verification checklist as an artifact.
**Acceptance criteria.**
- `docker compose -f docker-compose.staging.yml up` builds and serves the
  app; first meaningful render shows real content (not a blank page)
  within about 1 second at a 390px viewport, no horizontal scroll.
- Heading capability detection returns a typed state
  (`compass_ok` with an accuracy value | `compass_unreliable` | `absent`)
  and that state decides whether bearing capture or distance-only is
  offered; covered by unit tests over mocked sensor availability for iOS,
  Android, and no-sensor cases.
- iOS permission request fires only from a user gesture; no code path
  throws when the orientation or geolocation APIs are missing.
- `SENTRY_DSN`, `UMAMI_WEBSITE_ID`, and `UMAMI_URL` are read from env and
  the app runs correctly when they are unset; no secret is committed.
- `README.md` lets a stranger understand the app in two or three plain
  sentences, run it with the exact verified compose commands, and find
  where code and tests live. No pipeline jargon.
- A `docs/sensor-verification.md` checklist artifact lists the real-device
  heading tests a human must run (iOS Safari, Android Chrome, no-compass
  fallback) and the expected fallback behavior for each.
**Non-goals.** No guess flow, no charts, no persistence yet.

### EPIC 2 — The gated guess and the reveal (signature moment)
**Scope.** Target selection (set home on first use; "here, now" for
walk-start). Point-and-lock bearing capture, or a clear path to
distance-only when heading is `absent`/`unreliable`. Typed distance
estimate. The commit gate: nothing about the answer is shown until the
user locks in. One geolocation fix, bearing math (great-circle initial
bearing) and distance math, then the reveal: bucketed bearing error with
the stated accuracy floor, the true compass direction in words, and the
distance ratio. One rotating strategy nudge per guess.
**Acceptance criteria.**
- No direction, distance, map, or numeric hint is rendered before both
  the bearing (or an explicit distance-only choice) and the distance are
  committed; verified by test.
- Bearing error and distance ratio are computed correctly against known
  coordinate pairs (unit tests with fixed lat/lng inputs and expected
  outputs); bearing is shown in buckets with the accuracy floor visible.
- Distance-only mode completes a full guess and reveal with no dead end
  when heading is unavailable.
- Every control gives feedback within 100ms (pressed/optimistic states);
  the geolocation fix has a designed loading state and a designed error
  state for timeout and permission-denied that says what to do next.
- Exactly one strategy nudge from a fixed set is shown per guess.
- Copy sweep passes: no improvement promise, no em-dashes, no banned LLM
  vocabulary, no negative empty-state phrasing in any string shipped.
**Non-goals.** No persistence or charts (EPIC 3). No target rotation
beyond home + walk-start. No LLM narration.

### EPIC 3 — The record: persistence, trends, error signature, export
**Scope.** Append each committed guess to a localStorage time series.
Trend view leading with distance-ratio calibration and bearing error
second. Capped/paginated guess history. Derived error-signature
statements once enough guesses exist. File export and import so the
record is portable and owned by the user.
**Acceptance criteria.**
- Guesses persist across reloads; the history list is paginated or capped
  so it never grows unbounded on the hot path.
- The trend view renders the distance-ratio chart as the hero and the
  bearing-error chart as secondary; both readable at 390px.
- Empty state (zero guesses) states what the record is for and points to
  the first guess in positive phrasing; a low-data state explains that
  error-signature statements appear after a stated number of guesses.
- Error-signature statements appear only past the data threshold, are
  derived from the user's own data, and never claim guaranteed
  improvement; verified by test on a seeded record.
- Export produces a downloadable file; import restores an identical
  record; a round-trip test confirms equality.
**Non-goals.** No cloud sync, no accounts, no cross-device merge.

### EPIC 4 — First run: guided walk-through and sample reveal (SEED_DEMO)
**Scope.** A brand-new visitor gets a "Try a sample guess" demo that runs
the real reveal on built-in coordinates and produces real, non-zero
output, so the differentiator is demonstrable within a minute on staging
with no hand-crafted input. A guided path (2 to 4 one-sentence steps)
anchored to the real controls walks the user through their first real
guess; it is skippable at any step, appears only until the first success,
and never again.
**Acceptance criteria.**
- The landing screen states what the app does and offers one obvious
  primary action; the sample demo yields a real reveal with non-zero
  bearing and distance results.
- The guided path is at most 4 steps, each one short imperative sentence
  pinned to a real control; it is skippable and disappears permanently
  after the first completed real guess and for returning users
  (`seenWalkthrough`), verified by test.
- On a fresh staging deploy with no user input, the sample reveal (the
  quality differentiator) is reachable within a minute.
**Non-goals.** No tutorial essays, no multi-screen onboarding, no tips
that outlive the first success.

### EPIC 5 — Polish pass (no new features)
**Scope.** A UX, performance, accessibility, and copy pass over the whole
delivered product against the QUALITY BAR and the immediacy
differentiator. Tighten what exists; add nothing.
**Acceptance criteria.**
- Perceived speed verified: first meaningful render within about 1s;
  every interaction acknowledges within 100ms; no unbounded list or
  unindexed hot-path work.
- Mobile-first verified at 390px across every screen: no horizontal
  scroll, touch targets about 44px, text readable without zoom.
- Every empty, loading, and error state is a designed surface with the
  product's voice; no blank screens, no raw errors.
- Accessibility basics pass: contrast, visible focus, labeled inputs,
  semantic headings and landmarks, full keyboard reach.
- Full copy sweep across all user-visible strings: no em-dashes or dash
  asides, no banned LLM vocabulary, no negative empty-state phrasing,
  positive and plain throughout.
- Time-to-first-reveal from a cold load is measured and reported against
  the under-a-minute differentiator target.
**Polish EPIC. No new features.**

## Non-goals / out of scope (the fence)

- **No accounts, no server, no cloud sync.** The client-side shape is what
  makes it near-zero-cost and agent-buildable. The record lives on device
  plus a file the user exports.
- **No leaderboards or any social comparison.** Cheating is trivial and
  the game is single-player self-measurement, so comparative scores are
  meaningless.
- **No background or continuous tracking.** No always-on geolocation, no
  path recording. This also rules out the "Walk Home Dark" expedition
  variant.
- **No "Map in Your Head" warped-map render** in v1.
- **No runtime LLM** in the core loop. Ground truth is geometry. An
  optional BYOK narration flourish could come later without touching the
  loop; it is out of scope now.
- **No promise of real-world navigation improvement.** The chart proves
  improvement at the task only; transfer is plausible but unproven, and
  copy must never claim it.
- **No target types beyond home and walk-start** in the MVP. Richer
  rotation (station, landmark passed N minutes ago, bearing after N turns)
  is a later request, not this build.
