import type { FieldEntry } from "./types.ts";

export function isSentToSentry(entry: Pick<FieldEntry, "id" | "reportStatus">): boolean {
  return entry.reportStatus === "sent" && !entry.id.startsWith("local:");
}

function csvCell(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export function observationLedgerCsv(entries: FieldEntry[]): string {
  const sorted = [...entries].sort((a, b) => {
    const group = Number(isSentToSentry(a)) - Number(isSentToSentry(b));
    if (group !== 0) return group;
    return b.createdAt.localeCompare(a.createdAt);
  });
  const header = [
    "report_status",
    "sent_at",
    "address",
    "home_id",
    "kind",
    "disposition",
    "category",
    "note",
    "author",
    "created_at",
  ];
  const rows = sorted.map((entry) =>
    [
      isSentToSentry(entry) ? "sent" : "pending",
      entry.sentAt ?? "",
      entry.address,
      entry.homeId,
      entry.kind,
      entry.disposition ?? "",
      entry.category ?? "",
      entry.note,
      entry.authorEmail,
      entry.createdAt,
    ]
      .map(csvCell)
      .join(","),
  );
  return [header.join(","), ...rows].join("\n") + "\n";
}
