import type { FieldEntry } from "./types.ts";

export interface ReportPhoto {
  dataUri: string;
}

export interface ReportEntry extends FieldEntry {
  historical: boolean;
  embedded: ReportPhoto[];
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    const map: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return map[char] ?? char;
  });
}

function csvCell(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

function kindLabel(entry: ReportEntry): string {
  if (entry.kind === "disposition") {
    return entry.disposition === "resolved" ? "Field: resolved" : "Field: still open";
  }
  if (entry.kind === "issue") return `New issue: ${entry.category ?? "Other"}`;
  return "Note";
}

export type ReportScope = "home" | "drive" | "week" | "all";

export interface ReportOptions {
  scope?: ReportScope;
  sentAt?: string;
  address?: string;
}

const EASTERN = "America/New_York";

function formatLetterDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("en-US", {
    timeZone: EASTERN,
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function formatWhen(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const time = new Intl.DateTimeFormat("en-US", {
    timeZone: EASTERN,
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(date);
  return `${formatLetterDate(iso)} at ${time}`;
}

function formatDay(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim());
  if (!match) return value.trim();
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12));
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function sentence(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

function photoSentence(count: number): string {
  if (count <= 0) return "";
  if (count === 1) return "One photo is included with this letter.";
  if (count === 2) return "Two photos are included with this letter.";
  return `${count} photos are included with this letter.`;
}

function opening(scope: ReportScope, sentLabel: string, address?: string): string {
  if (scope === "home") {
    const place = address?.trim() || "the selected home";
    return `This letter reports what the Palma Vista HOA board observed at ${place} on ${sentLabel}.`;
  }
  if (scope === "drive") {
    return `This letter reports what the Palma Vista HOA board observed during a community drive on ${sentLabel}.`;
  }
  if (scope === "week") {
    return `This letter reports Palma Vista HOA board field observations from the seven days ending ${sentLabel}.`;
  }
  return `This letter reports the Palma Vista HOA board field observations on file as of ${sentLabel}.`;
}

function entryParagraph(entry: ReportEntry): string {
  const when = formatWhen(entry.createdAt);
  const note = sentence(entry.note);
  const photos = photoSentence(entry.embedded.length);
  const recorded = `Recorded by ${entry.authorEmail}.`;
  if (entry.kind === "issue") {
    return [
      `On ${when}, a board member noted a new issue: ${entry.category ?? "Other"}.`,
      note,
      photos,
      recorded,
    ]
      .filter(Boolean)
      .join(" ");
  }
  if (entry.kind === "note") {
    return [`On ${when}, a board member recorded a property note.`, note, photos, recorded].filter(Boolean).join(" ");
  }
  const finding = entry.disposition === "resolved" ? "appeared resolved in the field" : "was still open in the field";
  const details = [
    entry.sentryDate ? `dated ${formatDay(entry.sentryDate)}` : "",
    entry.sentryCode ? `code ${entry.sentryCode}` : "",
    entry.sentryStatus ? `status ${entry.sentryStatus}` : "",
  ].filter(Boolean);
  const reference = details.length ? ` (${details.join(", ")})` : "";
  const description = entry.sentryDescription?.trim()
    ? ` The violation reads: ${sentence(entry.sentryDescription)}`
    : "";
  const historical = entry.historical ? " This item is no longer on the current violation list." : "";
  return [
    `On ${when}, a board member checked an open item${reference} and it ${finding}.${description}`,
    note,
    photos,
    recorded + historical,
  ]
    .filter(Boolean)
    .join(" ");
}

function letterText(entries: ReportEntry[], options: ReportOptions | undefined, groups: Map<string, ReportEntry[]>): string {
  const sentAt = options?.sentAt ?? new Date().toISOString();
  const sentLabel = formatLetterDate(sentAt);
  const scope = options?.scope ?? "all";
  const address = options?.address ?? entries[0]?.address;
  const lines = [sentLabel, "", "Sentry Management,", "", opening(scope, sentLabel, address)];
  if (groups.size === 0) {
    lines.push("The board has no field observations to report for this period.");
    lines.push("");
  } else {
    lines.push(
      "These notes are separate from the weekly violation file. Please follow up where an item is still open or newly reported.",
    );
    lines.push("");
  }
  for (const [key, list] of groups) {
    const [groupAddress] = key.split("\n");
    lines.push(groupAddress);
    lines.push("");
    for (const entry of list) {
      lines.push(entryParagraph(entry));
      lines.push("");
    }
  }
  lines.push("Thank you,");
  lines.push("");
  lines.push("Palma Vista Homeowners Association");
  lines.push("Board of Directors");
  return lines.join("\n").trim();
}

export function letterMailto(subject: string, letter: string, budget = 1800): string {
  const base = `mailto:?subject=${encodeURIComponent(subject)}&body=`;
  const full = `${base}${encodeURIComponent(letter)}`;
  if (full.length <= budget) return full;
  const note = "\n\nThe rest of this letter, and the photos, were saved on this phone.";
  let low = 0;
  let high = letter.length;
  while (low < high) {
    const mid = Math.floor((low + high + 1) / 2);
    const candidate = `${letter.slice(0, mid).trimEnd()}…${note}`;
    if (`${base}${encodeURIComponent(candidate)}`.length <= budget) low = mid;
    else high = mid - 1;
  }
  const fitted = low > 0 ? `${letter.slice(0, low).trimEnd()}…${note}` : `Sentry Management,${note}`;
  return `${base}${encodeURIComponent(fitted)}`;
}

export function buildFieldReport(
  title: string,
  entries: ReportEntry[],
  options?: ReportOptions,
): {
  html: string;
  csv: string;
  text: string;
} {
  const groups = new Map<string, ReportEntry[]>();
  for (const entry of entries) {
    const key = `${entry.address}\n${entry.homeId}`;
    const list = groups.get(key) ?? [];
    list.push(entry);
    groups.set(key, list);
  }

  const sections: string[] = [];
  for (const [key, list] of groups) {
    const [address] = key.split("\n");
    const cards = list
      .map((entry) => {
        const when = escapeHtml(entry.createdAt);
        const photos = entry.embedded
          .filter((photo) => photo.dataUri.startsWith("data:image/"))
          .map(
            (photo) =>
              `<img alt="" src="${photo.dataUri}" style="width:160px;height:120px;object-fit:cover;border-radius:8px;margin:4px 8px 4px 0" />`,
          )
          .join("");
        const sentry = entry.sentryDescription
          ? `<p><b>Sentry</b> ${escapeHtml(entry.sentryDate ?? "")} · ${escapeHtml(entry.sentryCode ?? "")} · ${escapeHtml(entry.sentryStatus ?? "")}<br>${escapeHtml(entry.sentryDescription)}</p>`
          : "";
        const historical = entry.historical ? " <i>(no longer on the current Sentry list)</i>" : "";
        return `<article style="border:1px solid #e2e8f0;border-radius:12px;padding:12px;margin:0 0 12px">
          <p><b>${escapeHtml(kindLabel(entry))}</b>${historical}</p>
          <p>${escapeHtml(entry.note || "No note")}</p>
          ${sentry}
          <p>${when} · ${escapeHtml(entry.authorEmail)}${entry.lat != null && entry.lon != null ? ` · ${entry.lat.toFixed(5)}, ${entry.lon.toFixed(5)}` : ""}</p>
          <div>${photos}</div>
        </article>`;
      })
      .join("");
    sections.push(`<section><h2>${escapeHtml(address)}</h2>${cards}</section>`);
  }

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(title)}</title>
<style>
  body { font-family: system-ui, sans-serif; color: #0f172a; margin: 24px; }
  h1 { font-size: 22px; }
  h2 { font-size: 18px; margin: 24px 0 8px; }
  p { margin: 4px 0; line-height: 1.4; }
  @media print { article { break-inside: avoid; } }
</style>
</head>
<body>
<h1>${escapeHtml(title)}</h1>
<p>This file accompanies the Palma Vista HOA letter to Sentry Management. Photos are embedded below. These observations are separate from the weekly violation file.</p>
${sections.join("\n") || "<p>No field entries in this range.</p>"}
</body>
</html>`;

  const header = [
    "address",
    "home_id",
    "kind",
    "disposition",
    "category",
    "note",
    "author",
    "created_at",
    "lat",
    "lon",
    "sentry_date",
    "sentry_code",
    "sentry_status",
    "sentry_description",
    "historical",
    "photo_count",
  ];
  const rows = entries.map((entry) =>
    [
      entry.address,
      entry.homeId,
      entry.kind,
      entry.disposition ?? "",
      entry.category ?? "",
      entry.note,
      entry.authorEmail,
      entry.createdAt,
      entry.lat == null ? "" : String(entry.lat),
      entry.lon == null ? "" : String(entry.lon),
      entry.sentryDate ?? "",
      entry.sentryCode ?? "",
      entry.sentryStatus ?? "",
      entry.sentryDescription ?? "",
      entry.historical ? "yes" : "no",
      String(entry.embedded.length),
    ]
      .map(csvCell)
      .join(","),
  );
  const csv = [header.join(","), ...rows].join("\n") + "\n";
  return { html, csv, text: letterText(entries, options, groups) };
}
