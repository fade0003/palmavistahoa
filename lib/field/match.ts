import { violationKey } from "./keys.ts";
import type { FieldEntry } from "./types";

export interface SentryItem {
  date: string;
  code: string;
  description: string;
  status: string;
}

export function isOpenStatus(status: string): boolean {
  return status.trim().toUpperCase().startsWith("O");
}

export function latestDisposition(
  entries: FieldEntry[],
  homeId: string,
  key: string,
): FieldEntry | null {
  let latest: FieldEntry | null = null;
  for (const entry of entries) {
    if (entry.homeId !== homeId || entry.kind !== "disposition" || entry.violationKey !== key) continue;
    if (!latest || entry.createdAt > latest.createdAt) latest = entry;
  }
  return latest;
}

export async function homeFieldCleared(
  home: { id: string; violations: SentryItem[]; architectural: SentryItem[] },
  entries: FieldEntry[],
): Promise<boolean> {
  const open = [...home.violations, ...home.architectural].filter((item) => isOpenStatus(item.status));
  if (open.length === 0) return false;
  for (const item of open) {
    const key = await violationKey(item);
    if (latestDisposition(entries, home.id, key)?.disposition !== "resolved") return false;
  }
  return true;
}

export async function currentViolationKeys(items: SentryItem[]): Promise<Set<string>> {
  const keys = new Set<string>();
  for (const item of items) keys.add(await violationKey(item));
  return keys;
}
