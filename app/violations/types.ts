export type HomeStatus = "red" | "orange" | "gray";

export interface ViolationItem {
  date: string;
  code: string;
  description: string;
  ageDays: number;
  status: string;
}

export interface Arrears {
  total: number;
  pastDue: number;
  collection: string | null;
}

export interface Home {
  id: string;
  address: string;
  lat: number;
  lon: number;
  status: HomeStatus;
  violations: ViolationItem[];
  architectural: ViolationItem[];
  arrears: Arrears | null;
}

export interface ViolationsSummary {
  openItems: number;
  homesWithOpen: number;
  aging: {
    "0-30": number;
    "31-60": number;
    "61-90": number;
    "91-180": number;
    "180+": number;
  };
  arrearsTotal: number;
  pastDue: number;
  inCollection: number;
}

export interface ViolationsData {
  updated: string;
  sources?: { violations?: string; arrears?: string };
  summary: ViolationsSummary;
  homes: Home[];
}

export type HomeFilter = "all" | "red" | "orange" | "owes";

export function isViolationsData(value: unknown): value is ViolationsData {
  if (!value || typeof value !== "object") return false;
  const record = value as Partial<ViolationsData>;
  return Array.isArray(record.homes) && !!record.summary && typeof record.summary === "object";
}

export function statusLabel(status: HomeStatus): string {
  if (status === "red") return "Open 90+ days";
  if (status === "orange") return "Open under 90 days";
  return "No open violations";
}

export function owesMoney(home: Home): boolean {
  return Boolean(home.arrears && (home.arrears.total > 0 || home.arrears.pastDue > 0));
}

export function matchesFilter(home: Home, filter: HomeFilter): boolean {
  if (filter === "all") return true;
  if (filter === "red") return home.status === "red";
  if (filter === "orange") return home.status === "orange";
  return owesMoney(home);
}
