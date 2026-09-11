# Sensor verification checklist

A magnetometer cannot be tested in a headless browser, so the automated suite
mocks the browser sensor APIs. These checks close that gap. Run them by hand on
real devices and tick each box. Do this whenever the heading or geolocation
code in `src/sensors/` changes.

For each case, confirm the reported capability state, the guess mode it maps to
(`compass_ok` offers bearing; `compass_unreliable` and `absent` fall back to
distance only), and the geolocation behavior.

## iOS Safari (iPhone with a magnetometer)

- [ ] Load the landing page. No permission prompt appears on load.
- [ ] Tap "Check my compass". The iOS motion and orientation permission
      prompt appears, triggered by the tap.
- [ ] Grant permission. The result reads "Compass ready. Readings land within
      about N degrees." with a real number for N.
- [ ] Expected state: `compass_ok`. Expected mode: bearing offered.
- [ ] Turn the phone slowly. The underlying heading tracks north plausibly
      (no wild jumps, roughly correct direction).
- [ ] Deny permission instead, then tap again: detection times out and reports
      distance only. The app stays usable.
- [ ] Geolocation: a later location fix prompts once, then returns a position,
      or maps a denial to a clear distance-only path.

## Android Chrome (phone with a magnetometer)

- [ ] Tap "Check my compass". No separate orientation permission prompt is
      needed on Android.
- [ ] On a device with an absolute compass, `deviceorientationabsolute` fires.
      Result reads "Compass ready." with the conservative accuracy floor.
- [ ] Expected state: `compass_ok`. Expected mode: bearing offered.
- [ ] On a device that only reports relative orientation, the result reads
      "Compass readings look unsteady here. You will measure by distance."
- [ ] Expected state: `compass_unreliable`. Expected mode: distance only.
- [ ] Geolocation: the browser location prompt appears on first fix, and a
      granted fix returns a position with an accuracy value.

## No-compass device or desktop browser

- [ ] Open the landing page on a laptop or a device without a magnetometer.
- [ ] Tap "Check my compass". After the short detection window, the result
      reads "This device has no compass. You will measure by distance."
- [ ] Expected state: `absent`. Expected mode: distance only.
- [ ] Detection resolves within about 2.5 seconds. It never spins forever.
- [ ] Geolocation: with location blocked or unavailable, the wrapper returns a
      typed reason (permission denied, timeout, unavailable, or unsupported)
      within the 10 second timeout and never hangs.

## Sign-off

- [ ] All three device classes checked and matching the expected states above.
- Tester:
- Date:
- Devices used:
