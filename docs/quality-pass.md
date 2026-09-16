# Quality pass: measurements and checks

This is the record of a polish pass over The Inner Compass against the quality
bar and the immediacy goal: from opening the page to a true measurement of your
own sense of direction in under a minute, with no install and no account.

Every number below states how it was taken and on which build. The app is a
static React single-page app with three routes: `/` (landing and one-tap
sample), `/guess` (the whole loop as a phase machine), and `/record` (charts,
error signature, history, export and import).

Method note that applies throughout: this toolchain builds with Vite and tests
with Vitest in jsdom. jsdom does not lay out pixels or run a magnetometer, so
layout, contrast, and timing are verified by reading the production build and
the code paths, with the method stated next to each result. Behavior changes
are pinned by automated component tests.

## 1. Build size

Method: `npm run build` (runs `tsc --noEmit` then `vite build`), which prints
raw and gzip sizes for every emitted asset. Measured on the production build
after this pass.

| Asset | Raw | Gzip |
| --- | --- | --- |
| `index.html` | 2.56 kB | 1.10 kB |
| `assets/index-*.css` | 12.12 kB | 2.64 kB |
| `assets/index-*.js` | 273.23 kB | 89.69 kB |

Before and after this pass (same method, baseline is the commit before the
first change of this pass):

| Asset | Before raw | After raw | Before gzip | After gzip |
| --- | --- | --- | --- | --- |
| `index.html` | 2.53 kB | 2.56 kB | 1.09 kB | 1.10 kB |
| CSS | 12.15 kB | 12.12 kB | 2.67 kB | 2.64 kB |
| JS | 272.74 kB | 273.23 kB | 89.55 kB | 89.69 kB |

The JS grew by 0.14 kB gzip (the focus effect, the refs, and the heading-level
prop). The CSS shrank after the dead styles came out. No production dependency
was added: `package.json` dependencies are unchanged.

## 2. First meaningful render

Method: read the built `dist/index.html`. The document ships a static first
paint inside `#root` (a real header, the title, and the tagline) styled by an
inline `<style>` block. The module bundle is a `type="module"` script, which
the browser defers, so the boot content paints from HTML and inline CSS before
the bundle executes or the external stylesheet loads.

Result: the first meaningful paint is the HTML parse of a 2.56 kB document
(1.10 kB over the wire gzip). On an ordinary mobile connection this is well
under one second, and it is real product content, not a blank page or a
spinner. React then replaces `#root` with the live landing, which renders the
same title and tagline, so there is no flash of different content.

## 3. Interaction feedback (within 100 ms)

Method: code inspection of every interactive control group. Pressed feedback is
pure CSS `:active`, so it lands on the same frame as the press. State-changing
handlers flip visible state synchronously before any await.

| Control group | Feedback | Where |
| --- | --- | --- |
| Landing `Start a walk`, `Try a sample guess` | CSS `:active` translate and color; sample opens on a synchronous `setState` | `Landing.module.css`, `Landing.tsx` |
| Guess `Lock direction`, `Change`, `Skip`, unit `m`/`km` | CSS `:active`; the unit toggle flips `aria-pressed` on the same click | `GuessFlow.module.css`, `GuessFlow.tsx` |
| `Reveal` | The handler sets the `fixing` phase (spinner) on its first line, before awaiting the location fix | `GuessFlow.tsx` `runRevealFix` |
| Setup `Mark this spot`, `Set as home`, `Retry` | The handler sets the loading state before awaiting the fix | `GuessFlow.tsx` `runAnchorFix` |
| Record `Export`, `Import`, `Show more`, `Replace`, `Cancel` | CSS `:active`; import error and confirm flip on synchronous state | `Record.module.css`, `Record.tsx` |

No handler on a hot path blocks on work before showing feedback. The two waits
in the whole product are the geolocation fixes, and each is preceded by a
designed loading state that renders first.

## 4. Bounded work on hot paths

Method: read the constants that cap each path. No route makes a network call;
the loop and the record are local only.

| Path | Bound | Value | Where |
| --- | --- | --- | --- |
| Stored guesses | `MAX_STORED_GUESSES` | 2000 rows, oldest dropped on write | `src/record/store.ts` |
| History list | `PAGE_SIZE` | 10 rows per page, grown on `Show more` | `src/screens/Record.tsx` |
| Chart series | `CHART_WINDOW` | last 100 guesses plotted | `src/screens/Record.tsx` |
| Location fix | `GEO_TIMEOUT_MS` | 10 s ceiling, then a designed error | `src/sensors/geolocation.ts` |

There are no unindexed queries because there is no server. Every read is a
single `localStorage` get with a shape check per row.

## 5. Mobile-first at 390 px

Method: static inspection of each screen against a 390 px viewport. The shell
gives the content column 20 px gutters, so the column is 350 px wide; a chart
card then holds an SVG about 318 px wide. Each screen uses a single flex column
with no element wider than the column. Every tappable control carries
`min-height` (and unit buttons `min-width`) of `var(--tap)`, which is 44 px.
Text uses `rem` sizes that need no zoom. The reveal action row uses
`flex-wrap`, so its two 140 px buttons wrap instead of overflowing.

| Screen and state | Horizontal scroll | Targets 44 px+ | Readable | Notes |
| --- | --- | --- | --- | --- |
| Landing, sample closed | none | yes | yes | Title, tagline, one primary, one outlined button |
| Landing, sample open | none | yes | yes | Result card is a flex column; sample heading is h2, bucket h3 |
| Guess: setup | none | yes | yes | Two stacked buttons |
| Guess: setup loading | none | n/a | yes | Spinner card, `min-height` holds layout |
| Guess: setup error | none | yes | yes | Alert card plus Retry |
| Guess: bearing, walkthrough | none | yes | yes | Checklist card, 160 px dial centered in a 350 px column |
| Guess: distance only | none | yes | yes | Distance field plus unit toggle |
| Guess: fixing | none | n/a | yes | Spinner card, `min-height` holds layout |
| Reveal: measurable | none | yes | yes | Headline, distance block, action row wraps |
| Reveal: barely moved | none | yes | yes | Message plus action row |
| Reveal: error | none | yes | yes | Alert card plus Retry |
| Record: empty | none | yes | yes | Empty copy, start link, minimal import |
| Record: populated | none | yes | yes | Two charts at 318 px, signature, paged history, export row |
| Record: import confirm | none | yes | yes | Confirm card, buttons wrap |
| Record: import error | none | yes | yes | Alert paragraph under the import label |
| Crash fallback | none | yes | yes | Centered card, Reload button |

Two viewport-height fixes shipped in this pass: every full-height surface
(`html`, `body`, `#root`, the shell, the boot styles, and the crash fallback)
now sets `min-height: 100dvh` after a `100vh` fallback, so the iOS Safari
toolbar no longer makes the page taller than the visible viewport. The chart
data points now render as round dots at any width (see the designed-states and
test notes), so the record reads cleanly on a phone and on a wide desktop
column.

## 6. Designed states inventory

Method: enumerate every empty, loading, and error surface and check each
against three rules. Empty says what the screen is for and the first action.
Loading holds the layout. Error says what happened and what to do, in the
product voice. Copy is quoted verbatim from the source.

| State | Where | What it says | Pass |
| --- | --- | --- | --- |
| Record empty | `Record.tsx` | "Your record starts with one walk." plus a `Start a walk` link | yes |
| Bearing chart empty | `Record.tsx` | "Lock a bearing on your next walk to chart it here." | yes |
| Signature below threshold | `Record.tsx` | "Your error signature appears after N more guesses." | yes |
| Setup loading | `GuessFlow.tsx` | Spinner plus "Finding where you are.", card `min-height` holds layout | yes |
| Fixing loading | `GuessFlow.tsx` | Spinner plus "Getting your location.", card `min-height` holds layout | yes |
| Fix error: permission | `GuessFlow.tsx` | "Location is blocked. Turn it on in your browser, then tap Retry." | yes |
| Fix error: timeout | `GuessFlow.tsx` | "That took too long. Step into the open and tap Retry." | yes |
| Fix error: unavailable | `GuessFlow.tsx` | "Location is not ready yet. Tap Retry." | yes |
| Fix error: unsupported | `GuessFlow.tsx` | "This browser cannot share location. Open the app in Safari or Chrome." (no Retry, correctly) | yes |
| Barely moved reveal | `GuessFlow.tsx` | "You barely moved. Walk a bit farther, then guess again." | yes |
| Import parse error | `Record.tsx` | "That file is not a record this app can read. Pick a file you exported here." | yes |
| Import replace confirm | `Record.tsx` | "Importing replaces your record. Continue?" plus Replace and Cancel | yes |
| Crash fallback | `ErrorFallback.tsx` | "This screen ran into a problem." plus "Reload the page to continue." and a Reload button | yes |

Every state passes. The crash fallback shows no stack trace and no error code:
it renders fixed product copy and a Reload button, and works whether or not
error tracking is configured. No blank region appears in any state; each
loading card sets `min-height` so the layout does not jump. No fix was needed in
this pass; the states were already designed, and this table records the check.
The designed copy for these states is pinned by component tests in
`GuessFlow.test.tsx` and `Record.test.tsx`.

## 7. Contrast

Method: compute the WCAG 2.1 relative-contrast ratio for every token pair used
on text, from the hex values in `src/styles/global.css`. AA for normal text is
4.5:1; for large text it is 3:1.

| Foreground | Background | Ratio | AA normal |
| --- | --- | --- | --- |
| `--text` | `--bg` | 15.32:1 | pass |
| `--text` | `--surface` | 13.83:1 | pass |
| `--text` | `--surface-raised` | 12.38:1 | pass |
| `--text-muted` | `--bg` | 8.75:1 | pass |
| `--text-muted` | `--surface` | 7.90:1 | pass |
| `--text-muted` | `--surface-raised` | 7.07:1 | pass |
| `--accent-contrast` | `--accent` | 8.88:1 | pass |
| `--danger` | `--bg` | 7.90:1 | pass |
| `--danger` | `--surface` | 7.14:1 | pass |
| `--accent` | `--surface` | 8.74:1 | pass |

Every text pair clears AA for normal text, so no color change was needed.

## 8. Keyboard walk

Method: read the focus and tab behavior in the components, plus the component
tests that assert focus placement.

- Every interactive element is a real `button`, `a`, `input`, or `label`, so
  the keyboard reaches all of them in source order. There are no click handlers
  on non-interactive elements.
- Focus is always visible: `:focus-visible` in `global.css` draws a 3 px
  outline with a 2 px offset on every focusable element.
- Phase changes used to drop focus to `<body>`. This pass moves focus to the
  incoming content on each phase change: into the guess phase when setup
  completes, and into the reveal or the error card when the fix resolves. A
  keyboard user keeps context and a screen reader reads the new content. This is
  covered by tests in `GuessFlow.test.tsx` that assert `document.activeElement`
  lands inside the guess phase, the reveal, and the error card.
- The streaming compass readout no longer carries `aria-live`, so a screen
  reader is not flooded with a stream of degrees while the user aims. The
  discrete lock is announced instead through a polite live region on the
  "Locked N degrees" confirmation.
- Heading structure now forms a correct outline. The landing has one h1 (the
  title); the sample panel is h2 and the sample bucket is h3. On the guess
  reveal the bucket is the h1 in bearing mode, and the direction line is the h1
  in distance-only mode, so no reveal is missing a heading.

## 9. Copy sweep

Method: mechanical grep over every user-visible surface, then a read of each
hit. Files covered: `src/**`, `index.html`, `README.md`, and
`docs/sensor-verification.md`. `LICENSE` is exempt. Code comments, test names,
and non-UI strings are exempt.

Patterns run:

- The em-dash and en-dash characters.
- A spaced hyphen used as a sentence break.
- Banned vocabulary: `seamless`, `effortless`, `unlock`, `elevate`, `empower`,
  `leverage`, `robust`, `dive in`, `fast-paced`, "we've got you covered", and
  kin.
- Negative empty-state phrasing: "You don't have", "No ... yet", "Nothing ...
  here", "Unable to", "Something went wrong", and kin.

Hits:

- Em-dash and en-dash: none.
- Spaced hyphen: only arithmetic and CSS `calc` in code (for example `a` minus
  `b`, `calc(50% - 12px)`). All exempt as non-UI code, none in a user-visible
  string.
- Banned vocabulary: none.
- Negative empty-state phrasing: none.

Result: zero user-visible hits. Re-running the sweep after this pass yields the
same result. This report and the EPIC spec's quoted copy were written to pass
the same patterns.

## 10. Time to first reveal

Method: derive from the production build and the code paths. The sample scoring
(`computeSampleReveal`) and all bearing and distance scoring are synchronous
pure functions with no network and no await, so once the page is loaded they
render on the next frame. The only waits on the real path are the two
geolocation fixes, each bounded by `GEO_TIMEOUT_MS` (10 s).

Sample path (no walk):

- Cold load of `/`, then one tap on `Try a sample guess`.
- Taps: 1. App time after load: one synchronous render, on the order of a
  frame.
- Total, including load on an ordinary mobile connection: a few seconds, well
  under ten. This is under the one-minute target with room to spare.

Real path (the loop), excluding walking time, which the app does not control:

- Cold load, then `Mark this spot` (1 tap) starts the anchor fix. On the guess
  screen: `Lock direction` (1 tap) or `Skip direction`, type the distance (one
  numeric entry), then `Reveal` (1 tap) starts the reveal fix.
- Taps and inputs: 3 taps plus one distance entry.
- App-attributable time: the load plus two location fixes plus synchronous
  transitions. Each fix is typically one to three seconds and is capped at 10 s
  by `GEO_TIMEOUT_MS`. Worst case is therefore about 20 s of app-controlled
  wait plus the sub-second load; typical is well under 10 s. Both sit under the
  one-minute target. Walking between the two fixes is the user's time, not the
  app's.

Comparison against the target: the sample path and the app-attributable real
path each land under one minute. The immediacy goal holds on this build.

## Summary

Every planner criterion for this pass is met and recorded above: perceived
speed (sections 1 to 4), mobile-first at 390 px (section 5), designed empty,
loading, and error states (section 6), accessibility basics including contrast
and the keyboard walk (sections 7 and 8), a full copy sweep with zero
user-visible hits (section 9), and time to first reveal measured against the
one-minute target (section 10). The behavior changes ship with component tests;
`npm test` and `npm run build` both pass.
