// Heading-up map math. Degrees are clockwise from north, matching a compass
// and the Geolocation heading. Screen y grows downward.

const COURSE_SPEED_MPS = 0.8;

export function normalizeHeading(degrees: number): number {
  if (!Number.isFinite(degrees)) return 0;
  return ((degrees % 360) + 360) % 360;
}

/** Shortest signed turn from `from` to `to`, in degrees (-180, 180]. */
export function angularDelta(from: number, to: number): number {
  return ((normalizeHeading(to) - normalizeHeading(from) + 540) % 360) - 180;
}

export function smoothHeading(previous: number | null, next: number, factor = 0.35): number {
  const normalized = normalizeHeading(next);
  if (previous == null || !Number.isFinite(previous)) return normalized;
  const delta = angularDelta(previous, normalized);
  const gain = Math.min(1, Math.max(0, factor));
  return normalizeHeading(previous + delta * gain);
}

/**
 * Clockwise rotation of a screen point around (originX, originY).
 * A positive angle matches CSS `rotate()`.
 */
export function rotateScreenPoint(
  x: number,
  y: number,
  clockwiseDegrees: number,
  originX: number,
  originY: number,
): { x: number; y: number } {
  const radians = (clockwiseDegrees * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const dx = x - originX;
  const dy = y - originY;
  return {
    x: originX + dx * cos - dy * sin,
    y: originY + dx * sin + dy * cos,
  };
}

export function chooseHeading(input: {
  demo: number | null;
  course: number | null;
  speed: number | null;
  compass: number | null;
}): number | null {
  if (input.demo != null && Number.isFinite(input.demo)) return normalizeHeading(input.demo);
  if (
    input.course != null &&
    Number.isFinite(input.course) &&
    input.course >= 0 &&
    input.speed != null &&
    input.speed >= COURSE_SPEED_MPS
  ) {
    return normalizeHeading(input.course);
  }
  if (input.compass != null && Number.isFinite(input.compass)) return normalizeHeading(input.compass);
  return null;
}

export function headingFromOrientation(event: {
  alpha: number | null;
  absolute: boolean;
  webkitCompassHeading?: number | null;
}): number | null {
  const webkit = event.webkitCompassHeading;
  if (typeof webkit === "number" && Number.isFinite(webkit)) return normalizeHeading(webkit);
  if (event.absolute && typeof event.alpha === "number" && Number.isFinite(event.alpha)) {
    return normalizeHeading(360 - event.alpha);
  }
  return null;
}

type OrientationPermission = "granted" | "denied" | "prompt";

export function requestCompassAccess(): Promise<boolean> {
  if (typeof window === "undefined" || typeof window.DeviceOrientationEvent === "undefined") {
    return Promise.resolve(false);
  }
  const ctor = window.DeviceOrientationEvent as typeof DeviceOrientationEvent & {
    requestPermission?: () => Promise<OrientationPermission>;
  };
  if (typeof ctor.requestPermission !== "function") return Promise.resolve(true);
  return ctor
    .requestPermission()
    .then((result) => result === "granted")
    .catch(() => false);
}
