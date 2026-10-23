"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { violationKey } from "../../../lib/field/keys";
import type { FieldDisposition, FieldEntry, FieldKind, SentrySnapshot } from "../../../lib/field/types";

const DB_NAME = "pv-field-outbox";
const STORE = "jobs";

export interface FieldPhotoInput {
  blob: Blob;
}

export interface FieldDraft {
  homeId: string;
  address: string;
  kind: FieldKind;
  disposition: FieldDisposition | null;
  category: string | null;
  note: string;
  lat: number | null;
  lon: number | null;
  sentry: SentrySnapshot | null;
  photos: FieldPhotoInput[];
}

interface StoredPhoto {
  type: string;
  buffer: ArrayBuffer;
}

interface StoredDraft {
  homeId: string;
  address: string;
  kind: FieldKind;
  disposition: FieldDisposition | null;
  category: string | null;
  note: string;
  lat: number | null;
  lon: number | null;
  sentry: SentrySnapshot | null;
  violationKey: string | null;
  photos: StoredPhoto[];
}

type OutboxJob =
  | { id: string; op: "create"; createdAt: string; draft: StoredDraft }
  | {
      id: string;
      op: "patch";
      createdAt: string;
      entryId: string;
      patch: { note?: string; disposition?: FieldDisposition; category?: string };
    }
  | { id: string; op: "delete"; createdAt: string; entryId: string };

export class FieldRequestError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "FieldRequestError";
  }
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) {
        request.result.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function idbAll(): Promise<OutboxJob[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE, "readonly").objectStore(STORE).getAll();
    request.onsuccess = () => resolve((request.result as OutboxJob[]).sort((a, b) => a.createdAt.localeCompare(b.createdAt)));
    request.onerror = () => reject(request.error);
  });
}

async function idbPut(job: OutboxJob): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const request = db.transaction(STORE, "readwrite").objectStore(STORE).put(job);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

async function idbDelete(id: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const request = db.transaction(STORE, "readwrite").objectStore(STORE).delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

function shouldQueue(error: unknown): boolean {
  return error instanceof TypeError;
}

async function readError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: string };
    return body.error || "Could not save the field entry.";
  } catch {
    return "Could not save the field entry.";
  }
}

async function postDraft(draft: StoredDraft): Promise<FieldEntry> {
  const form = new FormData();
  form.set("kind", draft.kind);
  form.set("homeId", draft.homeId);
  form.set("address", draft.address);
  form.set("note", draft.note);
  if (draft.disposition) form.set("disposition", draft.disposition);
  if (draft.category) form.set("category", draft.category);
  if (draft.lat != null) form.set("lat", String(draft.lat));
  if (draft.lon != null) form.set("lon", String(draft.lon));
  if (draft.sentry) {
    form.set("violationDate", draft.sentry.date);
    form.set("violationCode", draft.sentry.code);
    form.set("violationDescription", draft.sentry.description);
    form.set("violationStatus", draft.sentry.status);
  }
  draft.photos.forEach((photo, index) => {
    form.append("photos", new Blob([photo.buffer], { type: photo.type }), `photo-${index}.jpg`);
  });
  const response = await fetch("/violations/field/entries", { method: "POST", body: form, cache: "no-store" });
  if (!response.ok) throw new FieldRequestError(response.status, await readError(response));
  const body = (await response.json()) as { entry: FieldEntry };
  return body.entry;
}

function jobToEntry(job: Extract<OutboxJob, { op: "create" }>, previews: string[]): FieldEntry {
  return {
    id: `local:${job.id}`,
    homeId: job.draft.homeId,
    address: job.draft.address,
    kind: job.draft.kind,
    violationKey: job.draft.violationKey,
    disposition: job.draft.disposition,
    category: job.draft.category,
    note: job.draft.note,
    lat: job.draft.lat,
    lon: job.draft.lon,
    authorEmail: "Queued on this phone",
    createdAt: job.createdAt,
    updatedAt: job.createdAt,
    sentryDate: job.draft.sentry?.date ?? null,
    sentryCode: job.draft.sentry?.code ?? null,
    sentryDescription: job.draft.sentry?.description ?? null,
    sentryStatus: job.draft.sentry?.status ?? null,
    photos: previews.map((url, index) => ({ id: `${job.id}-${index}`, url })),
    pending: true,
  };
}

async function toStored(draft: FieldDraft): Promise<StoredDraft> {
  const photos: StoredPhoto[] = [];
  for (const photo of draft.photos) {
    photos.push({ type: photo.blob.type || "image/jpeg", buffer: await photo.blob.arrayBuffer() });
  }
  return {
    homeId: draft.homeId,
    address: draft.address,
    kind: draft.kind,
    disposition: draft.disposition,
    category: draft.category,
    note: draft.note,
    lat: draft.lat,
    lon: draft.lon,
    sentry: draft.sentry,
    violationKey: draft.sentry ? await violationKey(draft.sentry) : null,
    photos,
  };
}

export function useFieldLog() {
  const [serverEntries, setServerEntries] = useState<FieldEntry[]>([]);
  const [viewerEmail, setViewerEmail] = useState<string | null>(null);
  const [jobs, setJobs] = useState<OutboxJob[]>([]);
  const [previews, setPreviews] = useState<Record<string, string[]>>({});
  const [storageError, setStorageError] = useState<string | null>(null);
  const [flushing, setFlushing] = useState(false);

  const refresh = useCallback(async () => {
    const response = await fetch("/violations/field/entries", { cache: "no-store" });
    if (response.status === 503) {
      setStorageError("Field notes are not available on this deployment yet.");
      return;
    }
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        setStorageError("Cloudflare Access did not authorize field notes.");
      }
      return;
    }
    const body = (await response.json()) as { viewerEmail: string; entries: FieldEntry[] };
    setViewerEmail(body.viewerEmail);
    setServerEntries(body.entries);
    setStorageError(null);
  }, []);

  const reloadJobs = useCallback(async () => {
    const stored = await idbAll();
    setJobs(stored);
    setPreviews((current) => {
      const next: Record<string, string[]> = {};
      for (const job of stored) {
        if (job.op !== "create") continue;
        if (current[job.id]) {
          next[job.id] = current[job.id];
          continue;
        }
        next[job.id] = job.draft.photos.map((photo) => URL.createObjectURL(new Blob([photo.buffer], { type: photo.type })));
      }
      for (const [id, urls] of Object.entries(current)) {
        if (!next[id]) urls.forEach((url) => URL.revokeObjectURL(url));
      }
      return next;
    });
  }, []);

  const flush = useCallback(async () => {
    const stored = await idbAll();
    if (stored.length === 0) return;
    setFlushing(true);
    try {
      for (const job of stored) {
        try {
          if (job.op === "create") await postDraft(job.draft);
          else if (job.op === "delete") {
            const response = await fetch(`/violations/field/entries/${job.entryId}`, { method: "DELETE", cache: "no-store" });
            if (!response.ok && response.status !== 404) {
              throw new FieldRequestError(response.status, await readError(response));
            }
          } else {
            const response = await fetch(`/violations/field/entries/${job.entryId}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(job.patch),
              cache: "no-store",
            });
            if (!response.ok) throw new FieldRequestError(response.status, await readError(response));
          }
          await idbDelete(job.id);
        } catch (error) {
          if (!shouldQueue(error) && error instanceof FieldRequestError) {
            await idbDelete(job.id);
            setStorageError(error.message);
          }
          break;
        }
      }
      await reloadJobs();
      await refresh();
    } finally {
      setFlushing(false);
    }
  }, [refresh, reloadJobs]);

  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        await refresh();
        if (!cancel) await reloadJobs();
      } catch {
        if (!cancel) setStorageError("Could not load field notes.");
      }
    })();
    return () => {
      cancel = true;
    };
  }, [refresh, reloadJobs]);

  useEffect(() => {
    const onOnline = () => {
      void flush();
    };
    window.addEventListener("online", onOnline);
    const timer = window.setInterval(() => {
      if (navigator.onLine) void flush();
    }, 15000);
    return () => {
      window.removeEventListener("online", onOnline);
      window.clearInterval(timer);
    };
  }, [flush]);

  const queueCreate = useCallback(async (draft: FieldDraft) => {
    const stored = await toStored(draft);
    const job: OutboxJob = { id: crypto.randomUUID(), op: "create", createdAt: new Date().toISOString(), draft: stored };
    await idbPut(job);
    const urls = draft.photos.map((photo) => URL.createObjectURL(photo.blob));
    setPreviews((current) => ({ ...current, [job.id]: urls }));
    setJobs((current) => [...current, job]);
    setStorageError("Saved on this phone. It will send when the signal returns.");
  }, []);

  const create = useCallback(
    async (draft: FieldDraft) => {
      const stored = await toStored(draft);
      try {
        await postDraft(stored);
        await refresh();
        setStorageError(null);
      } catch (error) {
        if (shouldQueue(error)) {
          await queueCreate(draft);
          return;
        }
        setStorageError(error instanceof Error ? error.message : "Could not save the field entry.");
        throw error;
      }
    },
    [queueCreate, refresh],
  );

  const patch = useCallback(
    async (entryId: string, body: { note?: string; disposition?: FieldDisposition; category?: string }) => {
      if (entryId.startsWith("local:")) {
        const id = entryId.slice("local:".length);
        const existing = jobs.find((job) => job.id === id && job.op === "create");
        if (!existing || existing.op !== "create") return;
        const draft = {
          ...existing.draft,
          note: body.note ?? existing.draft.note,
          disposition: body.disposition ?? existing.draft.disposition,
          category: body.category ?? existing.draft.category,
        };
        const job: OutboxJob = { ...existing, draft };
        await idbPut(job);
        setJobs((current) => current.map((item) => (item.id === id ? job : item)));
        return;
      }
      try {
        const response = await fetch(`/violations/field/entries/${entryId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          cache: "no-store",
        });
        if (!response.ok) throw new FieldRequestError(response.status, await readError(response));
        await refresh();
      } catch (error) {
        if (!shouldQueue(error)) {
          setStorageError(error instanceof Error ? error.message : "Could not update the field entry.");
          return;
        }
        const job: OutboxJob = {
          id: crypto.randomUUID(),
          op: "patch",
          createdAt: new Date().toISOString(),
          entryId,
          patch: body,
        };
        await idbPut(job);
        setJobs((current) => [...current, job]);
        setStorageError("Change queued until the signal returns.");
      }
    },
    [jobs, refresh],
  );

  const remove = useCallback(
    async (entryId: string) => {
      if (entryId.startsWith("local:")) {
        const id = entryId.slice("local:".length);
        await idbDelete(id);
        setPreviews((current) => {
          current[id]?.forEach((url) => URL.revokeObjectURL(url));
          const next = { ...current };
          delete next[id];
          return next;
        });
        setJobs((current) => current.filter((job) => job.id !== id));
        return;
      }
      try {
        const response = await fetch(`/violations/field/entries/${entryId}`, { method: "DELETE", cache: "no-store" });
        if (!response.ok) throw new FieldRequestError(response.status, await readError(response));
        await refresh();
      } catch (error) {
        if (!shouldQueue(error)) {
          setStorageError(error instanceof Error ? error.message : "Could not delete the field entry.");
          return;
        }
        const job: OutboxJob = { id: crypto.randomUUID(), op: "delete", createdAt: new Date().toISOString(), entryId };
        await idbPut(job);
        setJobs((current) => [...current, job]);
        setStorageError("Delete queued until the signal returns.");
      }
    },
    [refresh],
  );

  const entries = useMemo(() => {
    const pending = jobs
      .filter((job): job is Extract<OutboxJob, { op: "create" }> => job.op === "create")
      .map((job) => jobToEntry(job, previews[job.id] ?? []));
    const hidden = new Set(jobs.filter((job) => job.op === "delete").map((job) => job.entryId));
    const patched = serverEntries
      .filter((entry) => !hidden.has(entry.id))
      .map((entry) => {
        const update = [...jobs].reverse().find((job) => job.op === "patch" && job.entryId === entry.id);
        if (!update || update.op !== "patch") return entry;
        return { ...entry, ...update.patch, pending: true };
      });
    return [...pending, ...patched].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [jobs, previews, serverEntries]);

  return {
    entries,
    viewerEmail,
    pendingCount: jobs.length,
    flushing,
    storageError,
    clearStorageError: () => setStorageError(null),
    create,
    patch,
    remove,
    flush,
  };
}
