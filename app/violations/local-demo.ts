// Localhost-only helpers for screenshots and manual testing.
// They do nothing on the public site, so a query string cannot spoof GPS there.

function isLocalHost(): boolean {
  if (typeof window === "undefined") return false;
  const host = window.location.hostname;
  return host === "localhost" || host === "127.0.0.1" || host === "::1";
}

export function localSearchParam(name: string): string | null {
  if (!isLocalHost()) return null;
  return new URLSearchParams(window.location.search).get(name);
}

export function readDemoGeo(): { lat: number; lon: number } | null {
  const raw = localSearchParam("demoGeo");
  if (!raw) return null;
  const [latText, lonText] = raw.split(",");
  const lat = Number(latText);
  const lon = Number(lonText);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  return { lat, lon };
}
