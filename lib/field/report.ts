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

export function buildFieldReport(title: string, entries: ReportEntry[]): {
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
  const textLines: string[] = [title, ""];
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
    textLines.push(address);
    for (const entry of list) {
      textLines.push(
        `- ${kindLabel(entry)} ${entry.createdAt} by ${entry.authorEmail}${entry.note ? `: ${entry.note}` : ""}`,
      );
    }
    textLines.push("");
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
<p>Field observations are separate from Sentry. Photos are embedded in this file.</p>
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
  return { html, csv, text: textLines.join("\n").trim() };
}
