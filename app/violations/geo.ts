/** Tap-to-address radius. Neighboring homes in this file are about 20–50 m apart. */
export const SNAP_METERS = 45;

export function nearestHome<T extends { lat: number; lon: number }>(
  homes: readonly T[],
  point: { lat: number; lon: number },
  maxMeters: number,
): { home: T; meters: number } | null {
  let best: { home: T; meters: number } | null = null;
  for (const home of homes) {
    if (!Number.isFinite(home.lat) || !Number.isFinite(home.lon)) continue;
    const meters = haversineMeters(point, home);
    if (!Number.isFinite(meters) || meters > maxMeters) continue;
    if (!best || meters < best.meters) best = { home, meters };
  }
  return best;
}

export function haversineMeters(
  a: { lat: number; lon: number },
  b: { lat: number; lon: number },
): number {
  const toRad = (degrees: number) => (degrees * Math.PI) / 180;
  const earth = 6371000;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * earth * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function formatDistance(meters: number): string {
  if (!Number.isFinite(meters)) return "";
  const feet = meters * 3.28084;
  if (feet < 1000) return `${Math.round(feet)} ft`;
  const miles = feet / 5280;
  return `${miles < 10 ? miles.toFixed(1) : Math.round(miles)} mi`;
}

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

export function formatMoney(amount: number): string {
  if (!Number.isFinite(amount)) return "—";
  return money.format(amount);
}

export function formatDate(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return iso;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return date.toLocaleDateString("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
