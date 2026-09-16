# EPIC SPEC: Polish pass (quality bar and immediacy audit)

This EPIC is a UX, performance, accessibility, and copy pass over the whole
delivered product against the QUALITY BAR and the immediacy differentiator.
It tightens what exists and adds nothing. No new features, no visual
gold-plating beyond the bar.

The product this pass covers is a static React SPA with three routes:

- `/` (`src/screens/Landing.tsx`): title, tagline, `Start a walk`, and the
  one-tap sample reveal.
- `/guess` (`src/screens/GuessFlow.tsx`): the whole loop as a phase machine
  (setup, guess, fixing, reveal, error) plus the first-run walkthrough.
- `/record` (`src/screens/Record.tsx`): two SVG charts, the error signature,
  paginated history, export and import.

Plus the shared shell (`src/shell/Shell.tsx`), the crash fallback
(`src/observability/ErrorFallback.tsx`), the static boot paint in
`index.html`, and the nginx production config.

---

## Quality differentiator (this EPIC lives or dies here)

**Immediacy: from opening the page to a true, surprising measurement of your
own sense of direction in under a minute, with no install and no account, on
the phone already in your pocket.**

What that demands of THIS EPIC: the pass must PROVE the immediacy claim with
numbers, not vibes. Cold load to first meaningful render, cold load to a
scored sample measurement, and the tap count plus app-side time of the real
loop all get measured on the production build and written down. Any fix that
slows a hot path, adds bytes to the critical bundle, or puts a screen between
the visitor and the first measurement is a regression against the
differentiator, even if it improves some other dimension. Polish here means
faster and clearer, never heavier.

---

## Scope

### In scope

1. Verifying and, where needed, fixing perceived speed on the production
   build: first meaningful render, interaction feedback, bounded work on
   every hot path.
2. Verifying every screen and every state at a 390px viewport and fixing any
   overflow, cramped touch target, or unreadable text.
3. An inventory of every empty, loading, and error state, verifying each is a
   designed surface in the product's voice, and fixing any gap.
4. Accessibility fixes: heading structure, live-region behavior, focus
   handling across phase changes, contrast verification, labels, landmarks,
   keyboard reach.
5. A mechanical copy sweep over every user-visible string in the repo, with
   fixes for any hit.
6. Measuring and reporting time-to-first-reveal from a cold load against the
   under-a-minute target.
7. Removing dead styles left behind by earlier EPICs (small, named below).
8. A written report artifact, `docs/quality-pass.md`, recording every
   measurement and check this spec requires. The planner's criteria say
   "verified" and "measured and reported"; the report is where that lands.

### Out of scope (binding non-goals)

- No new features. No new screens, routes, settings, stored fields, or
  mechanics. The sample reveal, walkthrough, charts, and export exist; this
  pass tunes them and adds nothing beside them.
- No visual gold-plating beyond the quality bar: no animations beyond the
  existing spinner and pressed states, no redesign of the palette or layout
  system, no design tokens beyond what `src/styles/global.css` already has.
- No dependency additions except dev-only tooling if genuinely needed for a
  measurement, and none is expected: every measurement below is doable with
  the existing toolchain (`npm run build`, `vite preview` or the Docker
  image, browser devtools, and Vitest).
- No refactors of the game, record, or sensor logic. Pure modules under
  `src/game/`, `src/record/`, `src/sensors/` are touched only if a criterion
  below names them, and none does.

---

## Current-state audit (findings the tasks below fix)

These were found by reading the delivered code. The implementer starts from
this list rather than re-auditing blind, and extends it if the checks in the
tasks surface more.

**A. Heading structure breaks on the landing sample.**
`RevealMeasurement` (`src/screens/RevealMeasurement.tsx`) renders the bucket
headline as `<h1>`. On `/guess` that is correct: the bucket is the screen's
headline. But `Landing.tsx` renders it inside `SamplePanel` under an `<h2>`
("A sample guess"), so the landing page gets a second `<h1>` nested below an
`<h2>`. Screen-reader document outlines are wrong on the app's front door.

**B. The reveal has no heading in distance-only mode.**
`RevealMeasurement` renders the `<h1>` only when `bearing` is non-null. A
desktop or no-compass user who completes the loop lands on a reveal screen
with no heading at all: the page's semantic structure disappears exactly on
the payoff screen.

**C. The live compass readout is a firehose live region.**
`GuessFlow.tsx` marks the streaming degree readout `aria-live="polite"`
(the `styles.readout` paragraph in `GuessPhase`). It updates continuously
with the magnetometer, so a screen reader announces an unending stream of
numbers while the user aims. Live regions are for discrete announcements,
not sensor streams.

**D. Phase changes drop keyboard and screen-reader context.**
The phase machine unmounts the element that had focus (for example `Reveal`
replaces the whole subtree after `fixing`). Focus falls to `<body>`, nothing
announces that the reveal arrived, and a keyboard or screen-reader user is
stranded mid-loop. The `fixing` card has `aria-live="polite"`, but the reveal
content that replaces it is not announced.

**E. Chart dots distort off the reference width.**
Both SVG charts in `Record.tsx` use `preserveAspectRatio="none"` with a
320-wide viewBox and a fixed CSS height. Lines survive via
`vector-effect: non-scaling-stroke`, but the `<circle>` data points stretch
into ellipses at any real width (about 1.4x wider at the desktop content
column). The record is the trust surface; its marks should be clean.

**F. `100vh` on mobile Safari.**
`Shell.module.css` and `global.css` use `min-height: 100vh`. On iOS Safari
the dynamic toolbar makes `100vh` taller than the visible viewport. The app
is the phone-first product; it should prefer `100dvh` where supported.

**G. Dead styles from an earlier landing design.**
`Landing.module.css` still carries `.status`, `.statusText`, and `.mode`,
which nothing in `Landing.tsx` references. Dead weight in a file this pass
audits anyway.

**H. Copy is already clean, but unproven.**
A search over `src/` found no em-dashes, banned vocabulary, or negative
empty-state phrasing in user-visible strings (matches were all code and
tests). The sweep has never been run mechanically over the WHOLE repo
surface (README, `index.html` meta description, `docs/`), and nothing
records that it happened. The sweep below makes it a checked, reported fact.

**I. Speed posture looks right, but is unmeasured.**
The boot paint in `index.html` shows real content before the bundle;
`nginx.conf` gzips and caches hashed assets; the record store caps rows
(`MAX_STORED_GUESSES`), history paginates at 10, charts window at 100. What
is missing is the measurement: nobody has recorded the built bundle size,
confirmed the boot paint on the production image, or timed the first
meaningful render and the sample reveal. The differentiator claim is
currently unverified.

---

## Technical design

### Files to touch

| File | Why |
| --- | --- |
| `src/screens/RevealMeasurement.tsx` | Heading level made caller-controlled (findings A, B) |
| `src/screens/Landing.tsx` | Pass the sample's heading level (A) |
| `src/screens/GuessFlow.tsx` | Reveal heading in distance-only mode (B), readout live-region fix (C), focus and announcement on phase change (D) |
| `src/screens/GuessFlow.module.css` | Only if the focus fix needs a style hook |
| `src/screens/Record.tsx` | Chart dot fix (E) |
| `src/screens/Record.module.css` | Chart dot fix (E), if done in CSS |
| `src/shell/Shell.module.css`, `src/styles/global.css`, `index.html` | `100dvh` with `100vh` fallback (F) |
| `src/screens/Landing.module.css` | Remove dead styles (G) |
| `docs/quality-pass.md` | New report artifact (all measurements) |
| Test files beside each changed component | Prove the fixes (test plan below) |

Anything user-visible the audits in tasks 2 to 5 turn up beyond findings A
to G is fixed in the same files it lives in, under the same non-goals.

### Design decisions (so the implementer never guesses)

**RevealMeasurement heading (A, B).** Add an optional `headingLevel` prop
(default `"h1"`, accepted values `"h1" | "h2" | "h3"`) and render the bucket
headline with that element. `Landing.tsx` passes `"h3"` so the sample sits
under its `<h2>`. Visual size stays exactly as today: the existing
`styles.headline` class carries the look, whatever the element. For B, when
`bearing` is null, `RevealMeasurement` renders the direction line as the
headline element with the same `headingLevel` (text stays "It was to the
{word}."), so every reveal has a heading in both modes. No other caller or
word changes.

**Readout live region (C).** Remove `aria-live` from the streaming readout.
Announce the discrete moment instead: the locked state ("Locked N°") lives
in an element with `aria-live="polite"`. The visual behavior is unchanged.

**Phase focus (D).** When the phase enters `reveal` or `error`, move focus
programmatically to the reveal container (give it `tabIndex={-1}`) or to its
heading. Do the same when `guess` replaces `setup`. Use an effect keyed on
`phase`. No focus juggling inside a phase. This both restores keyboard
context and makes screen readers read the new content, which also resolves
the missing announcement half of D.

**Chart dots (E).** Keep `preserveAspectRatio="none"` for the line geometry
and stop drawing dots as SVG-scaled circles: either give circles
`vector-effect: non-scaling-stroke` with stroke-based rendering, or compute
an x-radius compensation, or (simplest, preferred) drop
`preserveAspectRatio="none"` and size the viewBox to the rendered aspect
per chart so nothing distorts. Pick the smallest change that makes dots
round at 390px and at the max content width; the report records which.

**Viewport height (F).** `min-height: 100vh;` immediately followed by
`min-height: 100dvh;` in the same rule, in `global.css` (`html, body`,
`#root`), `Shell.module.css` (`.shell`), and the inline boot styles in
`index.html`. Old browsers ignore the second line.

**The report (`docs/quality-pass.md`).** One markdown file, written for a
stranger, with these sections: build size table (each emitted asset, raw and
gzip), first-render verification, interaction-feedback verification, bounded
work verification, 390px screen-by-screen table, designed-states inventory,
contrast table, keyboard walk, copy sweep record (patterns run, files
covered, hits and fixes), and the time-to-first-reveal measurements. It
states the method next to every number (what was run, on what build). It is
plain prose and tables, no factory jargon, and it follows the same copy
rules as the product.

### Data model and API

No changes. No migrations. The stored guess shape, the record file format,
the walkthrough flag, and all routes stay exactly as shipped.

---

## Ordered tasks

### Task 1: Accessibility fixes (findings A, B, C, D)

Do the four concrete fixes per the design decisions above.

**Acceptance criteria:**
1. On `/`, with the sample open, the document has exactly one `<h1>` (the
   landing title) and heading levels never skip backward under it: the
   sample panel is `<h2>` and the bucket headline inside it is `<h3>`.
2. On `/guess` in bearing mode, the reveal's bucket headline is the screen's
   `<h1>`. In distance-only mode the reveal still has an `<h1>` (the
   direction line). No reveal renders without a heading.
3. The streaming readout has no `aria-live` attribute. The locked bearing
   confirmation is announced via a polite live region.
4. After `Reveal` is tapped, when the reveal (or the error card) renders,
   focus is on the new content's container or heading, verifiable with
   `document.activeElement` in a component test. Same when setup advances
   to guess.
5. Every existing test still passes; the visual appearance of headline,
   readout, and locked row is unchanged (same classes, same text).

### Task 2: Layout fixes at 390px and viewport height (findings E, F)

Fix the chart dot distortion and the `100vh` usage, then verify every screen
at 390px.

**Acceptance criteria:**
1. Chart data points render round (not stretched) at 390px and at the max
   content width, on both the distance and bearing charts.
2. `html`/`body`, `#root`, the shell, and the boot styles use `100dvh` with
   a `100vh` fallback line before it.
3. A screen-by-screen check at a 390px viewport is recorded in the report,
   covering: landing (sample closed and open), guess flow in every phase
   (setup, setup loading, setup error, guess in bearing mode with
   walkthrough, guess in distance-only mode, fixing, reveal measurable,
   reveal barely-moved, reveal error), record (empty, populated, import
   confirm, import error), and the crash fallback. For each: no horizontal
   scroll, all interactive targets at least 44px in the pressable
   dimension, no text requiring zoom. Any failure found is fixed in this
   task and re-checked.

### Task 3: Designed-states inventory (verification, fixes only if a gap shows)

Enumerate every empty, loading, and error state in the product and verify
each against the bar: empty states say what the screen is for and what to do
first, loading states hold layout, error states say what happened and what
to do next in the product's voice.

The known inventory to verify (extend it if the audit finds more): record
empty state, bearing-chart empty state, signature below-threshold state,
setup loading, fixing loading, the four `FIX_ERROR_COPY` geolocation errors
(as both setup and reveal errors), barely-moved reveal, import parse error,
import replace confirm, and the crash fallback.

**Acceptance criteria:**
1. The report contains the full inventory as a table: state, where it
   lives, what it says, and pass/fail against the three rules above.
2. Every state passes; any that failed was fixed in this task and the fix
   is covered by a component test asserting the designed copy renders.
3. No blank regions and no raw error text anywhere: the crash fallback
   shows no stack trace or error code (already true; verified and
   recorded).

### Task 4: Copy sweep, mechanical and recorded (finding H)

Run the mechanical sweep over every user-visible string in the repo:
`src/**` (components, copy constants in `src/game/nudges.ts`,
`src/game/scoring.ts`, `src/record/signature.ts`, `FIX_ERROR_COPY`),
`index.html` (title, meta description, boot copy), `README.md`, `LICENSE` is
exempt, and `docs/sensor-verification.md`.

Patterns: the characters "—" and "–"; " - " as a sentence break; the banned
vocabulary list from the quality bar ("seamlessly", "effortlessly",
"unlock", "elevate", "empower", "leverage", "robust", "dive in", and kin);
negative empty-state phrasing ("You don't have", "No … yet", "Nothing …
here", "Unable to", "Something went wrong").

Code comments, test names, and non-UI strings are exempt, but every string a
user can read in the product or on the public repo page is in.

**Acceptance criteria:**
1. The report records the exact patterns run, the file set covered, every
   hit, and its resolution. User-visible hits are all fixed; exempt hits
   are listed as exempt with their location.
2. After fixes, re-running the sweep over user-visible strings yields zero
   hits.
3. The report itself and this spec's quoted copy pass the same sweep.

### Task 5: Perceived speed, measured on the production build (finding I)

Build for production and measure. Serve the built app (Docker image or
`vite preview`; the report says which) and record:

1. Every emitted asset with raw and gzip size.
2. That the static boot paint (`index.html` content) renders real styled
   content before the module bundle executes, verified by loading with
   JS disabled or by inspecting the document before hydration.
3. That every interactive control gives feedback within 100ms: pressed
   states are pure CSS (`:active`), all click handlers on hot paths are
   synchronous or flip visible state immediately (the reveal tap flips to
   the `fixing` spinner before awaiting the fix). Verified by code
   inspection and recorded per control group.
4. Bounded work on every hot path: `MAX_STORED_GUESSES` cap in
   `src/record/store.ts`, `PAGE_SIZE` pagination and `CHART_WINDOW` in
   `Record.tsx`, and no network calls anywhere in the loop. Recorded with
   the constants' values.
5. First meaningful render timed on a cold load of the production build
   (devtools performance panel or equivalent; method stated). Target:
   about 1 second on an ordinary connection. The report states the
   measured number and the connection assumption.

**Acceptance criteria:**
1. All five measurements appear in the report with method noted.
2. First meaningful render meets the target, or the overage is fixed
   within this EPIC's non-goals and re-measured.
3. No production dependency was added and the built bundle did not grow
   beyond noise from this EPIC's own fixes (before and after sizes in the
   report).

### Task 6: Time-to-first-reveal, measured and reported

Measure the differentiator's claim on the production build, two paths:

1. **Sample path (no walk):** cold load of `/` to a scored sample
   measurement on screen. Record elapsed time and tap count (expected: one
   tap, well under ten seconds including load).
2. **Real path (the loop):** cold load to a committed real reveal,
   excluding walking time, which the app does not control. Record the tap
   and input count and the app-attributable time (loads, fixes, transitions;
   geolocation fix time recorded as measured, with the strict timeout from
   `src/sensors/geolocation.ts` noted as the worst case).

**Acceptance criteria:**
1. Both measurements are in the report with method, device or environment,
   and numbers.
2. The sample path plus the app-attributable real path each land under one
   minute; the report states the comparison against the target explicitly.
3. If either misses, the miss is fixed within this EPIC's non-goals and
   re-measured, or the run reports failure. Never report around a miss.

### Task 7: Dead style removal and final sweep (finding G)

Remove `.status`, `.statusText`, and `.mode` from `Landing.module.css`
(after confirming nothing references them). Then run the full test suite and
the copy sweep one final time over everything this EPIC touched, and finish
the report.

**Acceptance criteria:**
1. No CSS module rule in the repo is unreferenced by its component (spot
   check the three named; grep class usage for the rest of the touched
   files).
2. `npm test` and `npm run build` both pass clean.
3. `docs/quality-pass.md` is complete per the design section, passes its
   own copy sweep, and is listed in the run's artifacts.

---

## Test plan

Automated tests prove every behavior change; the report carries what
automation cannot reach (layout at real widths, timings, contrast numbers).

**New or extended component tests (Vitest + Testing Library):**

- `Landing.test.tsx`: with the sample open, exactly one `h1` in the
  document; the bucket headline is an `h3`; heading order is 1, 2, 3
  (Task 1, criteria 1).
- `GuessFlow.test.tsx`:
  - Bearing-mode reveal renders the bucket as `h1`; distance-only reveal
    renders an `h1` containing the direction line (Task 1, criteria 2).
  - The streaming readout element has no `aria-live`; after locking, the
    locked confirmation lives in an `aria-live="polite"` region (Task 1,
    criteria 3).
  - After a successful reveal fix, `document.activeElement` is inside the
    reveal; after a failed fix, inside the error card; after setup
    completes, inside the guess phase (Task 1, criteria 4).
  - Every `FIX_ERROR_COPY` string and the barely-moved copy still render
    verbatim (guards Task 3 and Task 4 against regression; several of
    these assertions already exist and must stay green).
- `Record.test.tsx`: chart SVGs match the chosen non-distorting rendering
  (assert the attribute or class that implements the Task 2 fix); empty
  state, import error, and confirm copy render verbatim.
- Any copy string changed by the sweep gets its rendering test updated in
  the same commit, so the sweep result is pinned.

**Existing suite:** the full `npm test` run stays green; no existing
assertion is deleted to make a fix pass. `npm run build` (which runs
`tsc --noEmit`) passes.

**Report-carried verification (method stated in the report for each):**
390px screen table (Task 2), designed-states inventory (Task 3), sweep
record (Task 4), asset sizes, boot paint, first-render timing (Task 5),
and both time-to-first-reveal measurements (Task 6). Contrast ratios for
every token pair used on text (`--text` and `--text-muted` on `--bg`,
`--surface`, `--surface-raised`; `--accent-contrast` on `--accent`;
`--danger` on `--bg` and `--surface`; `--accent` on `--surface`) computed
and tabled; every pair meets WCAG AA for its text size or is fixed.

---

## Done means

Every planner criterion maps to a task and lands in code or in
`docs/quality-pass.md`:

| Planner criterion | Where it is proven |
| --- | --- |
| Perceived speed verified (about 1s first render, 100ms feedback, bounded work) | Task 5, report sections 1 to 5 |
| Mobile-first verified at 390px on every screen | Task 2, report screen table |
| Every empty, loading, error state designed and in-voice | Task 3, inventory table plus tests |
| Accessibility basics pass | Tasks 1 and 2, contrast table, keyboard walk in report |
| Full copy sweep, zero hits | Task 4, sweep record |
| Time-to-first-reveal measured against under-a-minute | Task 6, report |

The run's artifacts are the code changes, the updated tests, and
`docs/quality-pass.md`. Nothing new faces the user except better versions of
what already shipped.
