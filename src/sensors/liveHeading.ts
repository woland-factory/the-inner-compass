// Live compass stream for point-and-lock. The one-shot detectHeadingCapability
// cannot drive an aim UI, so this subscribes continuously and maps each reading
// to a heading in degrees. The mapping (headingFromEvent) is pure and tested;
// the subscription is device-only and covered by docs/sensor-verification.md.

import type { HeadingSource } from "./heading";

type OrientationEventLike = DeviceOrientationEvent & {
  webkitCompassHeading?: number;
};

// Maps a raw orientation event to a heading in degrees, or null when the event
// carries no usable reading for this source. Pure.
export function headingFromEvent(
  source: HeadingSource,
  event: OrientationEventLike,
): number | null {
  if (source === "ios_compass") {
    return typeof event.webkitCompassHeading === "number"
      ? event.webkitCompassHeading
      : null;
  }
  if (source === "android_absolute") {
    return typeof event.alpha === "number" ? (360 - event.alpha) % 360 : null;
  }
  return null;
}

// The event channel each source listens on. iOS delivers the compass heading on
// the plain deviceorientation event; Android absolute heading on its own channel.
function eventTypeFor(source: HeadingSource): string {
  return source === "android_absolute"
    ? "deviceorientationabsolute"
    : "deviceorientation";
}

// Subscribes to the live compass, forwarding each mapped heading to cb. Returns
// an unsubscribe function. A source of "none" (or no window) subscribes to
// nothing and unsubscribes cleanly.
export function subscribeHeading(
  source: HeadingSource,
  cb: (deg: number) => void,
): () => void {
  if (source === "none" || typeof window === "undefined") {
    return () => {};
  }

  const type = eventTypeFor(source);
  const handler = (raw: Event) => {
    const deg = headingFromEvent(source, raw as OrientationEventLike);
    if (deg !== null) cb(deg);
  };

  window.addEventListener(type, handler);
  return () => window.removeEventListener(type, handler);
}
