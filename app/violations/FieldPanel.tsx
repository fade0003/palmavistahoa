"use client";

import { useEffect, useId, useState } from "react";
import { FIELD_CATEGORIES } from "../../lib/field/categories";
import { violationKey } from "../../lib/field/keys";
import { isOpenStatus, latestDisposition } from "../../lib/field/match";
import type { FieldDisposition, FieldEntry } from "../../lib/field/types";
import { capturePosition, compressPhoto } from "./field/compress";
import type { FieldDraft } from "./field/useFieldLog";
import { formatDate } from "./geo";
import type { Home, ViolationItem } from "./types";

function itemIdentity(item: ViolationItem): string {
  return `${item.date}|${item.code}|${item.description}`;
}

function fieldSentence(entry: FieldEntry): string {
  const day = formatDate(entry.createdAt.slice(0, 10));
  if (entry.kind === "disposition") {
    const word = entry.disposition === "resolved" ? "resolved" : "still open";
    return `Field: ${word} ${day} by ${entry.authorEmail}`;
  }
  if (entry.kind === "issue") return `New issue ${day} by ${entry.authorEmail}`;
  return `Note ${day} by ${entry.authorEmail}`;
}

function PhotoButtons({
  onPick,
}: {
  onPick: (file: File) => void;
}) {
  return (
    <div className="photo-actions">
      <label className="tool-button file-button">
        Camera
        <input
          type="file"
          accept="image/*"
          capture="environment"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) onPick(file);
          }}
        />
      </label>
      <label className="tool-button file-button">
        Library
        <input
          type="file"
          accept="image/*"
          multiple
          onChange={(event) => {
            const files = [...(event.target.files ?? [])];
            event.target.value = "";
            files.forEach(onPick);
          }}
        />
      </label>
    </div>
  );
}

function OpenItemCard({
  item,
  latest,
  position,
  busy,
  onSave,
}: {
  item: ViolationItem;
  latest: FieldEntry | null;
  position: { lat: number; lon: number } | null;
  busy: boolean;
  onSave: (draft: Omit<FieldDraft, "homeId" | "address" | "kind"> & { disposition: FieldDisposition }) => Promise<void>;
}) {
  const noteId = useId();
  const [note, setNote] = useState("");
  const [photo, setPhoto] = useState<{ blob: Blob; url: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function addPhoto(file: File) {
    try {
      const blob = await compressPhoto(file);
      setPhoto((current) => {
        if (current) URL.revokeObjectURL(current.url);
        return { blob, url: URL.createObjectURL(blob) };
      });
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add the photo.");
    }
  }

  async function save(disposition: FieldDisposition) {
    setError(null);
    const fix = await capturePosition(position);
    try {
      await onSave({
        disposition,
        category: null,
        note,
        lat: fix?.lat ?? null,
        lon: fix?.lon ?? null,
        sentry: {
          date: item.date,
          code: item.code,
          description: item.description,
          status: item.status,
        },
        photos: photo ? [{ blob: photo.blob }] : [],
      });
      setNote("");
      setPhoto((current) => {
        if (current) URL.revokeObjectURL(current.url);
        return null;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.");
    }
  }

  return (
    <article className="item-card">
      <div className="item-top">
        <time dateTime={item.date}>{formatDate(item.date)}</time>
        <span>{item.ageDays} days</span>
      </div>
      <p>{item.description}</p>
      <p className="meta">Sentry: {item.code} · {item.status}</p>
      <p className="field-line">{latest ? fieldSentence(latest) : "Field: no observation yet"}</p>
      <label className="field-label" htmlFor={noteId}>
        Note (optional)
      </label>
      <textarea id={noteId} value={note} maxLength={2000} rows={2} onChange={(event) => setNote(event.target.value)} />
      <PhotoButtons onPick={(file) => void addPhoto(file)} />
      {photo && (
        // Blob preview of a photo that has not been uploaded yet.
        // eslint-disable-next-line @next/next/no-img-element
        <img className="thumb" src={photo.url} alt="Photo to attach" />
      )}
      {error && <p className="form-error">{error}</p>}
      <div className="field-actions">
        <button type="button" className="btn-resolved" disabled={busy} onClick={() => void save("resolved")}>
          Resolved
        </button>
        <button type="button" className="btn-still" disabled={busy} onClick={() => void save("still_open")}>
          Still open
        </button>
      </div>
    </article>
  );
}

export function FieldPanel({
  home,
  entries,
  viewerEmail,
  position,
  busy,
  onCreate,
  onPatch,
  onDelete,
  onExport,
}: {
  home: Home;
  entries: FieldEntry[];
  viewerEmail: string | null;
  position: { lat: number; lon: number } | null;
  busy: boolean;
  onCreate: (draft: FieldDraft) => Promise<void>;
  onPatch: (id: string, patch: { note?: string; disposition?: FieldDisposition; category?: string }) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onExport: () => Promise<void>;
}) {
  const [keys, setKeys] = useState<Record<string, string>>({});
  const [issueOpen, setIssueOpen] = useState(false);
  const [category, setCategory] = useState<string>(FIELD_CATEGORIES[0]);
  const [issueNote, setIssueNote] = useState("");
  const [issuePhotos, setIssuePhotos] = useState<{ blob: Blob; url: string }[]>([]);
  const [propertyNote, setPropertyNote] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [editNote, setEditNote] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancel = false;
    (async () => {
      const next: Record<string, string> = {};
      for (const item of [...home.violations, ...home.architectural]) {
        next[itemIdentity(item)] = await violationKey(item);
      }
      if (!cancel) setKeys(next);
    })();
    return () => {
      cancel = true;
    };
  }, [home]);

  const knownKeys = new Set(Object.values(keys));
  const homeEntries = entries.filter((entry) => entry.homeId === home.id);

  async function addIssuePhoto(file: File) {
    if (issuePhotos.length >= 4) {
      setMessage("Four photos is the limit.");
      return;
    }
    const blob = await compressPhoto(file);
    setIssuePhotos((current) => [...current, { blob, url: URL.createObjectURL(blob) }]);
  }

  async function saveIssue() {
    const fix = await capturePosition(position);
    await onCreate({
      homeId: home.id,
      address: home.address,
      kind: "issue",
      disposition: null,
      category,
      note: issueNote,
      lat: fix?.lat ?? null,
      lon: fix?.lon ?? null,
      sentry: null,
      photos: issuePhotos.map((photo) => ({ blob: photo.blob })),
    });
    issuePhotos.forEach((photo) => URL.revokeObjectURL(photo.url));
    setIssuePhotos([]);
    setIssueNote("");
    setIssueOpen(false);
    setMessage("Issue recorded.");
  }

  async function saveNote() {
    const fix = await capturePosition(position);
    await onCreate({
      homeId: home.id,
      address: home.address,
      kind: "note",
      disposition: null,
      category: null,
      note: propertyNote,
      lat: fix?.lat ?? null,
      lon: fix?.lon ?? null,
      sentry: null,
      photos: [],
    });
    setPropertyNote("");
    setMessage("Note recorded.");
  }

  function renderItems(title: string, items: ViolationItem[]) {
    const open = items.filter((item) => isOpenStatus(item.status));
    const closed = items.filter((item) => !isOpenStatus(item.status));
    return (
      <>
        <h3>{title}</h3>
        {open.length === 0 && closed.length === 0 && <p className="empty-copy">None</p>}
        {open.map((item) => (
          <OpenItemCard
            key={itemIdentity(item)}
            item={item}
            latest={keys[itemIdentity(item)] ? latestDisposition(homeEntries, home.id, keys[itemIdentity(item)]) : null}
            position={position}
            busy={busy}
            onSave={async (draft) => {
              await onCreate({ ...draft, homeId: home.id, address: home.address, kind: "disposition" });
              setMessage("Field observation recorded. Sentry status is unchanged.");
            }}
          />
        ))}
        {closed.map((item) => (
          <article key={itemIdentity(item)} className="item-card">
            <div className="item-top">
              <time dateTime={item.date}>{formatDate(item.date)}</time>
              <span>{item.ageDays} days</span>
            </div>
            <p>{item.description}</p>
            <p className="meta">Sentry: {item.code} · {item.status}</p>
          </article>
        ))}
      </>
    );
  }

  return (
    <div className="field-panel">
      <div className="field-toolbar">
        <button type="button" className="tool-button" onClick={() => setIssueOpen((open) => !open)}>
          New issue
        </button>
        <button type="button" className="tool-button" onClick={() => void onExport()}>
          Export this home
        </button>
      </div>
      {message && <p className="field-line">{message}</p>}

      {issueOpen && (
        <form
          className="issue-form"
          onSubmit={(event) => {
            event.preventDefault();
            void saveIssue().catch((err: unknown) => {
              setMessage(err instanceof Error ? err.message : "Could not save the issue.");
            });
          }}
        >
          <h3>New issue</h3>
          <label className="field-label" htmlFor="issue-category">
            Category
          </label>
          <select id="issue-category" value={category} onChange={(event) => setCategory(event.target.value)}>
            {FIELD_CATEGORIES.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          <label className="field-label" htmlFor="issue-note">
            Note (optional)
          </label>
          <textarea id="issue-note" value={issueNote} maxLength={2000} rows={3} onChange={(event) => setIssueNote(event.target.value)} />
          <PhotoButtons onPick={(file) => void addIssuePhoto(file).catch((err: unknown) => setMessage(err instanceof Error ? err.message : "Could not add the photo."))} />
          {issuePhotos.length > 0 && (
            <div className="thumbs">
              {issuePhotos.map((photo) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={photo.url} className="thumb" src={photo.url} alt="New issue photo" />
              ))}
            </div>
          )}
          <button type="submit" className="btn-resolved" disabled={busy}>
            Save issue
          </button>
        </form>
      )}

      <h3>Property note</h3>
      <textarea
        aria-label="Property note"
        value={propertyNote}
        maxLength={2000}
        rows={2}
        placeholder="What you saw at the property"
        onChange={(event) => setPropertyNote(event.target.value)}
      />
      <button
        type="button"
        className="tool-button"
        disabled={busy || !propertyNote.trim()}
        onClick={() => void saveNote().catch((err: unknown) => setMessage(err instanceof Error ? err.message : "Could not save the note."))}
      >
        Add note
      </button>

      {renderItems("Violations", home.violations)}
      {renderItems("Architectural", home.architectural)}

      <h3>Field history</h3>
      {homeEntries.length === 0 && <p className="empty-copy">No field entries yet</p>}
      <ul className="field-history">
        {homeEntries.map((entry) => {
          const mine = viewerEmail != null && entry.authorEmail.toLowerCase() === viewerEmail.toLowerCase();
          const historical = entry.kind === "disposition" && entry.violationKey != null && knownKeys.size > 0 && !knownKeys.has(entry.violationKey);
          return (
            <li key={entry.id}>
              <p className="field-line">
                {fieldSentence(entry)}
                {entry.pending ? " · Pending" : ""}
                {historical ? " · Earlier record" : ""}
              </p>
              {entry.category && <p className="meta">{entry.category}</p>}
              {entry.sentryDescription && <p>{entry.sentryDescription}</p>}
              {editing === entry.id ? (
                <textarea aria-label="Edit note" value={editNote} maxLength={2000} rows={2} onChange={(event) => setEditNote(event.target.value)} />
              ) : (
                entry.note && <p>{entry.note}</p>
              )}
              {entry.photos.length > 0 && (
                <div className="thumbs">
                  {entry.photos.map((photo) => (
                    <a key={photo.id} href={photo.url}>
                      {/* Protected field photo. next/image cannot send the Access cookie to a Pages Function. */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img className="thumb" src={photo.url} alt="Field photo" />
                    </a>
                  ))}
                </div>
              )}
              {(mine || entry.pending) && (
                <div className="inline-actions">
                  {editing === entry.id ? (
                    <button
                      type="button"
                      className="tool-button"
                      onClick={() => {
                        void onPatch(entry.id, { note: editNote }).then(() => setEditing(null));
                      }}
                    >
                      Save edit
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="tool-button"
                      onClick={() => {
                        setEditing(entry.id);
                        setEditNote(entry.note);
                      }}
                    >
                      Edit
                    </button>
                  )}
                  {confirmDelete === entry.id ? (
                    <button type="button" className="tool-button danger" onClick={() => void onDelete(entry.id).then(() => setConfirmDelete(null))}>
                      Confirm delete
                    </button>
                  ) : (
                    <button type="button" className="tool-button" onClick={() => setConfirmDelete(entry.id)}>
                      Delete
                    </button>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function latestHomeFieldLine(homeId: string, entries: FieldEntry[]): string | null {
  const latest = entries.find((entry) => entry.homeId === homeId);
  return latest ? fieldSentence(latest) : null;
}
