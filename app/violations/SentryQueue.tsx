"use client";

import { useState } from "react";
import { observationLedgerCsv } from "../../lib/field/report-status";
import type { FieldEntry, ReportStatus } from "../../lib/field/types";
import { shareTextFile } from "./field/share";
import { formatDate } from "./geo";

function kindLabel(entry: FieldEntry): string {
  if (entry.kind === "issue") return entry.category ? `New issue · ${entry.category}` : "New issue";
  if (entry.kind === "note") return "Note";
  return entry.disposition === "resolved" ? "Field: resolved" : "Field: still open";
}

function whenLabel(iso: string): string {
  const day = iso.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(day) ? formatDate(day) : iso;
}

function QueueRow({
  entry,
  picked,
  onToggle,
  disabled,
}: {
  entry: FieldEntry;
  picked: boolean;
  onToggle: (id: string) => void;
  disabled?: boolean;
}) {
  return (
    <label className="queue-row">
      <input
        type="checkbox"
        checked={picked}
        disabled={disabled}
        onChange={() => onToggle(entry.id)}
      />
      <span>
        <strong>{entry.address}</strong>
        <em>
          {kindLabel(entry)} · {whenLabel(entry.createdAt)}
          {entry.reportStatus === "sent" && entry.sentAt ? ` · Sent ${whenLabel(entry.sentAt)}` : ""}
        </em>
        {entry.note && <em className="queue-note">{entry.note}</em>}
      </span>
    </label>
  );
}

export function SentryQueue({
  entries,
  busy,
  onClose,
  onSetStatus,
}: {
  entries: FieldEntry[];
  busy: boolean;
  onClose: () => void;
  onSetStatus: (ids: string[], status: ReportStatus) => Promise<boolean>;
}) {
  const [picked, setPicked] = useState<string[]>([]);
  const [exportError, setExportError] = useState<string | null>(null);
  const server = entries.filter((entry) => !entry.id.startsWith("local:"));
  const unsent = server.filter((entry) => entry.reportStatus !== "sent");
  const sent = server.filter((entry) => entry.reportStatus === "sent");
  const local = entries.filter((entry) => entry.id.startsWith("local:"));
  const pickedIds = picked.filter((id) => server.some((entry) => entry.id === id));

  function toggle(id: string) {
    setPicked((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  async function mark(ids: string[], status: ReportStatus) {
    const ok = await onSetStatus(ids, status);
    if (ok) setPicked([]);
  }

  async function exportLedger() {
    setExportError(null);
    const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
    try {
      await shareTextFile(`palma-vista-sentry-status-${stamp}.csv`, observationLedgerCsv(server), "text/csv");
    } catch (err) {
      if ((err as { name?: string }).name === "AbortError") return;
      setExportError(err instanceof Error ? err.message : "Could not export.");
    }
  }

  return (
    <section className="chrome-sheet sentry-queue" aria-label="Sent to Sentry">
      <div className="sheet-title">
        <h2>Sent to Sentry</h2>
        <button type="button" className="close-button" aria-label="Close sent list" onClick={onClose}>
          ×
        </button>
      </div>
      <p className="sources">
        Observations stay not sent until you mark them. Emailing a letter does not mark them by itself.
      </p>
      <div className="export-row">
        <button type="button" className="tool-button" disabled={busy || pickedIds.length === 0} onClick={() => void mark(pickedIds, "sent")}>
          Mark sent
        </button>
        <button type="button" className="tool-button" disabled={busy || pickedIds.length === 0} onClick={() => void mark(pickedIds, "pending")}>
          Mark not sent
        </button>
        <button type="button" className="tool-button" disabled={busy || unsent.length === 0} onClick={() => void mark(unsent.map((entry) => entry.id), "sent")}>
          Mark all not sent
        </button>
        <button type="button" className="tool-button" disabled={server.length === 0} onClick={() => void exportLedger()}>
          Export CSV
        </button>
      </div>
      {exportError && <p className="form-error">{exportError}</p>}

      <h3>Not sent ({unsent.length + local.length})</h3>
      {unsent.length === 0 && local.length === 0 && <p className="empty-copy">Nothing waiting.</p>}
      {unsent.map((entry) => (
        <QueueRow key={entry.id} entry={entry} picked={pickedIds.includes(entry.id)} onToggle={toggle} />
      ))}
      {local.map((entry) => (
        <p key={entry.id} className="queue-local">
          <strong>{entry.address}</strong> · {kindLabel(entry)} · On this phone, not saved yet
        </p>
      ))}

      <h3>Sent ({sent.length})</h3>
      {sent.length === 0 && <p className="empty-copy">Nothing marked sent.</p>}
      {sent.map((entry) => (
        <QueueRow key={entry.id} entry={entry} picked={pickedIds.includes(entry.id)} onToggle={toggle} />
      ))}
    </section>
  );
}
