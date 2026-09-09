# VALIDATION — The Inner Compass

## Verdict: VIABLE (with binding conditions)

The idea survives validation, but not in the exact shape the pitch leads
with. The pitch's soul is "watch your inner compass sharpen over weeks."
The best available evidence says that specific promise is the weakest
part of the product, while two adjacent promises are strong. The product
is viable as a **measurement and calibration instrument with training
nudges**, not as a bare feedback loop that guarantees improvement. The
conditions below are part of the verdict: a build that ignores them
walks straight into the premortem's kill scenario.

## Core value proposition

You cannot improve, or even honestly discuss, a sense you have never
measured. This app makes you commit a spatial belief (bearing to a
personal anchor, plus a typed distance estimate) before any map appears,
scores it against one GPS fix, and accumulates the only artifact of its
kind: a longitudinal record of your directional beliefs versus ground
truth, with your personal error signature (systematic drift, distance
inflation, context effects). The reveal moment is genuinely surprising
self-knowledge that no chatbot, advice article, or existing free app can
produce, because it requires a magnetometer, a GPS fix, a pre-commit
gate, and your own places.

## What the evidence actually supports (this reframes the product)

I verified the premortem's strongest objection. The controlled study it
leans on is real: Kimura et al., *Improving cognitive mapping by
training for people with a poor sense of direction* (Cognitive Research:
Principles and Implications, 2020 —
https://link.springer.com/article/10.1186/s41235-020-00238-1). Its
findings, precisely:

1. **Feedback alone did NOT improve direction (bearing) estimates** in
   people with a poor sense of direction over six weekly sessions.
2. **Feedback alone DID improve straight-line distance estimates and
   sketch-map accuracy**, with clear gains by the sixth session.
3. **Direction estimates DID improve** when feedback was paired with
   allocentric spatial-updating strategy training (actively tracking
   your position relative to landmarks/north while walking).
4. A separate finding: people with a good sense of direction improved
   pointing accuracy across just four repeated trials, so
   practice-driven bearing improvement is not ruled out for everyone.

Consequences, which are **binding on the plan**:

- **The distance estimate is not a secondary signal. It is the
  evidence-backed improvement channel** and it is also the noise-free
  one (typed number, no sensor error). The trend chart the product can
  honestly promise is distance calibration first, bearing second.
- **The app must ship strategy nudges, not just scores.** One line
  before or after a guess ("keep track of which way north is as you
  walk today"; "note two landmarks and where they sit relative to each
  other") is the ingredient the study found necessary for bearing
  improvement. This is a copy-level feature, nearly free to build, and
  it is the difference between the product working and the premortem's
  flat-line scenario.
- **Product copy must never promise improvement.** It promises
  measurement, the error signature, and an evidence-based practice
  structure. If a user's bearing line is flat, the product is still
  telling the truth and still delivering its artifact. "Your compass,
  measured" is honest; "your compass, guaranteed sharper" is not.

## Minimal feature set

1. **The gated guess.** Open app mid-walk, pick or get assigned a
   target (home at first; rotation later), point phone, lock bearing,
   type distance estimate. No map, no numbers, nothing revealed until
   both are committed.
2. **The reveal.** One geolocation fix, bearing math, a single screen:
   bearing error in degrees (bucketed, with the sensor accuracy floor
   stated), distance ratio, and which direction the truth actually was.
   This screen is the signature moment and must land inside the first
   sixty seconds of first use.
3. **The record.** Every guess appended to a local time series
   (localStorage + file export/import). Trend view for distance ratio
   and bearing error, plus derived error-signature statements once
   enough data exists.
4. **Strategy nudges.** The rotating one-line allocentric prompts
   described above, tied to the guess flow.
5. **Sensor honesty and fallback.** Detect heading availability and
   quality per platform; when the compass is absent or unreliable,
   degrade to distance-only mode (which is the evidence-backed channel
   anyway) instead of pretending precision.

Explicitly out of the minimal set: accounts, servers, leaderboards or
any social comparison (cheating is trivial, so comparative scores are
meaningless and must never be built), background tracking, the "Walk
Home Dark" expedition variant, LLM features of any kind.

## Main risks

1. **Sensor noise floor (the biggest technical risk).** iOS Safari's
   `webkitCompassHeading` is typically around 10° accurate and
   permission-gated behind a user gesture; Android browsers rely on
   `deviceorientationabsolute`, which drifts, suffers magnetic
   interference, and is missing on some devices. For a beginner 60° off
   this is irrelevant; for an improving user near 15° the ruler wobbles
   as much as the measurement. Mitigations are mandatory: bucketed
   bearing scores, a stated accuracy floor on every reveal, iOS
   `webkitCompassAccuracy` surfaced when available, and distance as the
   headline longitudinal metric. **EPIC 1 must include a real-device
   sensor spike as its first acceptance concern**, because the factory
   pipeline cannot test magnetometer behavior headlessly; every sensor
   path needs a designed fallback, not an assumed happy path.
2. **The flat-line scenario.** If a user's bearing error never trends
   down, a product framed as "training" reads as proof of its own
   failure. Fully mitigated only by the reframing above: measurement
   and error signature as the promise, strategy nudges as the
   evidence-based path, distance as the chartable win.
3. **Target saturation.** "Point at home" from the daily commute stops
   being a test within days. Target rotation (walk start point, a
   landmark passed ten minutes ago, station, bearing-after-N-turns) is
   the core design problem of the record's long-term value and must be
   in the plan, though the simplest version (home + walk-start point)
   is enough for MVP.
4. **Retention.** This is a habit product with weeks-to-value and no
   network. The realistic default outcome for most users is
   abandonment before week three. The first reveal must deliver the
   full "58° off, and you believed home was north" jolt on its own,
   because for many users it will be the only session. That single
   session still delivers honest value (a measured baseline), which is
   why this risk is survivable rather than disqualifying.
5. **The gate is willpower, not enforcement.** A web page cannot stop
   someone from opening Google Maps first. Acceptable: this is
   single-player self-measurement with zero incentive to cheat, which
   is also exactly why leaderboards are a permanent non-goal.
6. **Thin moat.** The free iOS app TrueNorth Compass Trainer could
   extend from "point at north" to "point at home" cheaply. The
   defensible part is the longitudinal record and the no-install web
   reach, not the mechanic. Acceptable for a factory with no revenue
   goal, but it means the record (export, error signature, trend) is
   the part the build must get right.

## What would make me reject it

- If the plan ships the pitch's framing verbatim (improvement promised,
  bearing chart as the hero, no strategy nudges), reject: the evidence
  says that product disproves itself to its users.
- If the build cannot produce a designed distance-only fallback and
  instead hard-depends on compass heading on all platforms, reject: a
  large fraction of real devices would get a broken or dishonest core
  loop that no pipeline agent can catch headlessly.
- If scope drifts toward accounts, servers, social features, or the
  expedition variant, reject the drift: the entire agent-buildability
  and near-zero-cost case rests on the client-side shape.
- If the first-run experience cannot demonstrate the reveal without a
  real walk (a simulated example guess with real output), the staging
  deploy cannot show the differentiator and the quality bar's first-run
  clause fails.

## Substitution check (why this beats free alternatives)

A chatbot has no magnetometer, no GPS fix, no pre-commit gate that
fires mid-walk, and no longitudinal store. Advice articles (NPR/OPB)
offer unmeasurable practice. TrueNorth trains a fixed abstract
reference (north), not your cognitive map of your own places, and has
no distance channel, no map-gate, and iOS-install friction. Turning GPS
off has no score and no trend, which is exactly the failure the cited
users report. The four-part combination (own anchors, distance +
bearing, commit-before-reveal, weeks-long error record) exists nowhere
free.

## Sources

- Kimura et al. 2020, Cognitive Research: Principles and Implications:
  https://link.springer.com/article/10.1186/s41235-020-00238-1 (also
  https://www.ncbi.nlm.nih.gov/pmc/articles/PMC7431476/)
- Dahmani & Bohbot 2020, Scientific Reports (GPS use and spatial
  memory decline): https://www.nature.com/articles/s41598-020-62877-0
- User-reported loss: https://news.ycombinator.com/item?id=39430064,
  https://news.ycombinator.com/item?id=17094536
- Closest incumbent: TrueNorth Compass Trainer,
  https://apps.apple.com/in/app/truenorth-compass-trainer/id6789341075
