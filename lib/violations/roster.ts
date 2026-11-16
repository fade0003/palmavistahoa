// Optional private address roster. Same KV namespace as violations.json,
// key properties.json. Homes already in the Sentry file are left unchanged.
// Extra homes become neutral map pins with no violation or arrears fields.

export const PROPERTIES_KEY = "properties.json";

const HOME_ID = /^[a-f0-9]{8,64}$/i;

interface RosterHome {
  id: string;
  address: string;
  lat: number;
  lon: number;
}

function normalizeAddress(value: string): string {
  return value.trim().toUpperCase().replace(/\s+/g, " ");
}

function readRoster(value: unknown): RosterHome[] {
  if (!value || typeof value !== "object") return [];
  const homes = (value as { homes?: unknown }).homes;
  if (!Array.isArray(homes)) return [];
  const seen = new Set<string>();
  const result: RosterHome[] = [];
  for (const home of homes) {
    if (!home || typeof home !== "object") continue;
    const record = home as { id?: unknown; address?: unknown; lat?: unknown; lon?: unknown };
    if (typeof record.id !== "string" || !HOME_ID.test(record.id.trim())) continue;
    if (typeof record.address !== "string") continue;
    const address = record.address.trim().replace(/\s+/g, " ");
    if (!address || address.length > 200) continue;
    const lat = typeof record.lat === "number" ? record.lat : Number(record.lat);
    const lon = typeof record.lon === "number" ? record.lon : Number(record.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) continue;
    if (lat === 0 && lon === 0) continue;
    const id = record.id.trim().toLowerCase();
    const addressKey = normalizeAddress(address);
    if (seen.has(`id:${id}`) || seen.has(`addr:${addressKey}`)) continue;
    seen.add(`id:${id}`);
    seen.add(`addr:${addressKey}`);
    result.push({ id, address, lat, lon });
  }
  return result;
}

export function mergePropertyRoster(violationsRaw: string, rosterRaw: string | null | undefined): string {
  if (!rosterRaw || !rosterRaw.trim()) return violationsRaw;
  let violations: { homes?: unknown };
  try {
    violations = JSON.parse(violationsRaw) as { homes?: unknown };
  } catch {
    return violationsRaw;
  }
  if (!violations || typeof violations !== "object" || !Array.isArray(violations.homes)) return violationsRaw;
  let roster: unknown;
  try {
    roster = JSON.parse(rosterRaw);
  } catch {
    return violationsRaw;
  }
  const extras = readRoster(roster);
  if (extras.length === 0) return violationsRaw;
  const ids = new Set<string>();
  const addresses = new Set<string>();
  for (const home of violations.homes) {
    if (!home || typeof home !== "object") continue;
    const record = home as { id?: unknown; address?: unknown };
    if (typeof record.id === "string") ids.add(record.id.trim().toLowerCase());
    if (typeof record.address === "string") addresses.add(normalizeAddress(record.address));
  }
  const additions = extras.filter(
    (home) => !ids.has(home.id) && !addresses.has(normalizeAddress(home.address)),
  );
  if (additions.length === 0) return violationsRaw;
  const homes = [
    ...violations.homes,
    ...additions.map((home) => ({
      id: home.id,
      address: home.address,
      lat: home.lat,
      lon: home.lon,
      status: "gray" as const,
      violations: [],
      architectural: [],
      arrears: null,
    })),
  ];
  return JSON.stringify({ ...violations, homes });
}
