import { currentViolationKeys } from "../../../lib/field/match";
import { buildFieldReport, type ReportEntry } from "../../../lib/field/report";
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

export async function shareFieldReport(options: {
  homes: Home[];
  entries: FieldEntry[];
  homeId?: string;
  from?: string;
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
  const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
  const title = options.homeId
    ? `Palma Vista field notes — ${homesById.get(options.homeId)?.address ?? "home"}`
    : "Palma Vista field notes";
  const report = buildFieldReport(title, reportEntries);
  const htmlName = `palma-vista-field-${stamp}.html`;
  const csvName = `palma-vista-field-${stamp}.csv`;
  const htmlFile = new File([report.html], htmlName, { type: "text/html" });
  const csvFile = new File([report.csv], csvName, { type: "text/csv" });
  const summary = report.text.slice(0, 1500);
  const nav = navigator as Navigator & { canShare?: (data: ShareData) => boolean };
  if (typeof nav.share === "function" && nav.canShare?.({ files: [htmlFile, csvFile] })) {
    await nav.share({ files: [htmlFile, csvFile], title, text: summary });
    return "Opened the share sheet.";
  }
  if (typeof nav.share === "function" && nav.canShare?.({ files: [htmlFile] })) {
    await nav.share({ files: [htmlFile], title, text: summary });
    download(csvName, report.csv, "text/csv");
    return "Opened the share sheet and downloaded the CSV.";
  }
  download(htmlName, report.html, "text/html");
  download(csvName, report.csv, "text/csv");
  const mail = `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(`${summary}\n\nThe HTML report was downloaded and includes the photos.`)}`;
  window.location.href = mail;
  return "Downloaded the report and opened Mail.";
}
