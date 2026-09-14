# Sensor verification checklist

A magnetometer cannot be tested in a headless browser, so the automated suite
mocks the browser sensor APIs. These checks close that gap. Run them by hand on
real devices and tick each box. Do this whenever the heading or geolocation
code in `src/sensors/` changes.

For each case, confirm the reported capability state, the guess mode it maps to
(`compass_ok` offers bearing; `compass_unreliable` and `absent` fall back to
distance only), and the geolocation behavior.

Detection now runs from inside the guess flow: it fires from the "Mark this
spot" / "Set as home" tap, after the location fix, so the point-and-lock aim UI
can drive off a live compass stream. Verify each device class from the flow.

## iOS Safari (iPhone with a magnetometer)

- [ ] Load the landing page. No permission prompt appears on load.
- [ ] Tap "Start a walk", then "Mark this spot". The location prompt appears,
      followed by the iOS motion and orientation prompt, both from that tap.
- [ ] Grant both. The guess screen offers the aim dial, not distance only.
- [ ] Expected state: `compass_ok`. Expected mode: bearing.
- [ ] Point-and-lock: turn the phone slowly. The live readout in degrees tracks
      your aim plausibly (no wild jumps). Tap "Lock direction": the reading
      freezes and "Change" appears. Tap "Change": it tracks live again.
- [ ] Deny orientation instead: the flow falls back to distance only and still
      reaches a reveal. No dead end.

## Android Chrome (phone with a magnetometer)

- [ ] Tap "Mark this spot". No separate orientation prompt is needed on Android.
- [ ] On a device with an absolute compass, `deviceorientationabsolute` drives
      the dial. Turn the phone: the readout tracks your aim.
- [ ] Expected state: `compass_ok`. Expected mode: bearing.
- [ ] Lock a heading, then reveal. The floor caption reads "Your compass reads
      to about ±15°" (the conservative Android floor).
- [ ] On a relative-only device, the guess screen shows distance only.
- [ ] Expected state: `compass_unreliable`. Expected mode: distance only.

## No-compass device or desktop browser

- [ ] Open the app on a laptop or a device without a magnetometer.
- [ ] Tap "Mark this spot". After the short detection window, the guess screen
      shows distance only with "This device measures by distance."
- [ ] Expected state: `absent`. Expected mode: distance only.
- [ ] Detection resolves within about 2.5 seconds. It never spins forever.
- [ ] Geolocation: with location blocked or unavailable, both the anchor fix and
      the reveal fix show a reason-specific error with a working Retry (and no
      Retry for the unsupported case), within the 10 second timeout.

## Sign-off

- [ ] All three device classes checked and matching the expected states above.
- Tester:
- Date:
- Devices used:
