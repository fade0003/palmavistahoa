import { currentViolationKeys } from "../../../lib/field/match";
import { buildFieldReport, letterMailto, type ReportEntry, type ReportScope } from "../../../lib/field/report";
import type { FieldEntry } from "../../../lib/field/types";
import type { Home } from "../types";

const SESSION_KEY = "pv-drive-session";

export function driveSessionStart(): string {
  const existing = sessionStorage.getItem(SESSION_KEY);
  if (existing) {
    const age = Date.now() - Date.parse(existing);
    if (Number.isFinite(age) && age >= 0 && age < 12 * 60 * 60 * 1000) return existing;
  }
  const now = new Date().toISOString();
  sessionStorage.setItem(SESSION_KEY, now);
  return now;
}

async function blobToDataUri(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  let binary = "";
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
  const type = blob.type || "image/jpeg";
  return `data:${type};base64,${btoa(binary)}`;
}

async function embeddedPhoto(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) return null;
    return blobToDataUri(await response.blob());
  } catch {
    return null;
  }
}

function download(filename: string, contents: string, type: string) {
  const url = URL.createObjectURL(new Blob([contents], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function reportSubject(scope: ReportScope, sentAt: string, address?: string): string {
  const day = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(sentAt));
  if (scope === "home") return `Palma Vista HOA field observations — ${address ?? "home"}`;
  if (scope === "drive") return `Palma Vista HOA field observations from today's drive — ${day}`;
  if (scope === "week") return `Palma Vista HOA field observations, last 7 days — ${day}`;
  return `Palma Vista HOA field observations — ${day}`;
}

export async function shareFieldReport(options: {
  homes: Home[];
  entries: FieldEntry[];
  homeId?: string;
  from?: string;
  scope?: ReportScope;
}): Promise<string> {
  const homesById = new Map(options.homes.map((home) => [home.id, home]));
  const filtered = options.entries.filter((entry) => {
    if (options.homeId && entry.homeId !== options.homeId) return false;
    if (options.from && entry.createdAt < options.from) return false;
    return true;
  });
  const keysByHome = new Map<string, Set<string>>();
  for (const home of options.homes) {
    keysByHome.set(home.id, await currentViolationKeys([...home.violations, ...home.architectural]));
  }
  const reportEntries: ReportEntry[] = [];
  for (const entry of filtered) {
    const embedded = [];
    for (const photo of entry.photos) {
      const dataUri = await embeddedPhoto(photo.url);
      if (dataUri) embedded.push({ dataUri });
    }
    const keys = keysByHome.get(entry.homeId);
    reportEntries.push({
      ...entry,
      address: homesById.get(entry.homeId)?.address || entry.address,
      historical: Boolean(entry.kind === "disposition" && entry.violationKey && keys && !keys.has(entry.violationKey)),
      embedded,
    });
  }
  const sentAt = new Date().toISOString();
  const stamp = sentAt.slice(0, 16).replace(/[:T]/g, "-");
  const address = options.homeId ? homesById.get(options.homeId)?.address : undefined;
  const scope: ReportScope = options.scope ?? (options.homeId ? "home" : "all");
  const title = reportSubject(scope, sentAt, address);
  const report = buildFieldReport(title, reportEntries, { scope, sentAt, address });
  const htmlName = `palma-vista-field-${stamp}.html`;
  const csvName = `palma-vista-field-${stamp}.csv`;
  const textName = `palma-vista-field-${stamp}.txt`;
  const htmlFile = new File([report.html], htmlName, { type: "text/html" });
  const csvFile = new File([report.csv], csvName, { type: "text/csv" });
  const textFile = new File([report.text], textName, { type: "text/plain" });
  const nav = navigator as Navigator & { canShare?: (data: ShareData) => boolean };
  const packs = [
    [textFile, htmlFile, csvFile],
    [textFile, htmlFile],
    [textFile],
    [htmlFile],
  ];
  if (typeof nav.share === "function") {
    for (const files of packs) {
      if (!nav.canShare?.({ files })) continue;
      await nav.share({ files, title, text: report.text });
      const shared = new Set(files);
      if (!shared.has(textFile)) download(textName, report.text, "text/plain");
      if (!shared.has(htmlFile)) download(htmlName, report.html, "text/html");
      if (!shared.has(csvFile)) download(csvName, report.csv, "text/csv");
      return "Opened Mail with the letter to Sentry Management.";
    }
  }
  download(textName, report.text, "text/plain");
  download(htmlName, report.html, "text/html");
  download(csvName, report.csv, "text/csv");
  window.location.href = letterMailto(title, report.text);
  return "Saved the letter and opened Mail.";
}
