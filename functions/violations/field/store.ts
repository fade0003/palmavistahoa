import { violationKey } from "../../../lib/field/keys";
import { FIELD_SCHEMA } from "../../../lib/field/schema";
import type { FieldDisposition, FieldEntry, FieldKind, FieldPhoto } from "../../../lib/field/types";
import {
  FieldInputError,
  MAX_PHOTOS,
  photoExtension,
  sniffImage,
} from "../../../lib/field/validate";

export interface FieldBindings {
  FIELD_DB?: D1Database;
  FIELD_PHOTOS?: R2Bucket;
}

interface EntryRow {
  id: string;
  home_id: string;
  address: string;
  kind: FieldKind;
  violation_key: string | null;
  disposition: FieldDisposition | null;
  category: string | null;
  note: string;
  lat: number | null;
  lon: number | null;
  author_email: string;
  created_at: string;
  updated_at: string;
  sentry_date: string | null;
  sentry_code: string | null;
  sentry_description: string | null;
  sentry_status: string | null;
}

interface PhotoRow {
  id: string;
  entry_id: string;
  home_id: string;
  r2_key: string;
  content_type: string;
  byte_size: number;
  created_at: string;
  sort_index: number;
}

const schemaReady = new WeakMap<D1Database, Promise<void>>();

export function ensureFieldSchema(db: D1Database): Promise<void> {
  let pending = schemaReady.get(db);
  if (!pending) {
    pending = db
      .batch(FIELD_SCHEMA.map((sql) => db.prepare(sql)))
      .then(() => undefined);
    schemaReady.set(db, pending);
    pending.catch(() => schemaReady.delete(db));
  }
  return pending;
}

function photoUrl(id: string): string {
  return `/violations/field/photos/${id}`;
}

function toEntry(row: EntryRow, photos: PhotoRow[]): FieldEntry {
  return {
    id: row.id,
    homeId: row.home_id,
    address: row.address,
    kind: row.kind,
    violationKey: row.violation_key,
    disposition: row.disposition,
    category: row.category,
    note: row.note,
    lat: row.lat,
    lon: row.lon,
    authorEmail: row.author_email,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    sentryDate: row.sentry_date,
    sentryCode: row.sentry_code,
    sentryDescription: row.sentry_description,
    sentryStatus: row.sentry_status,
    photos: photos
      .filter((photo) => photo.entry_id === row.id)
      .sort((a, b) => a.sort_index - b.sort_index)
      .map((photo) => ({ id: photo.id, url: photoUrl(photo.id) })),
  };
}

export async function listEntries(db: D1Database, homeId: string | null): Promise<FieldEntry[]> {
  const entryQuery = homeId
    ? db.prepare("SELECT * FROM field_entries WHERE home_id = ? ORDER BY created_at DESC").bind(homeId)
    : db.prepare("SELECT * FROM field_entries ORDER BY created_at DESC LIMIT 2000");
  const entries = await entryQuery.all<EntryRow>();
  const rows = entries.results ?? [];
  if (rows.length === 0) return [];
  const photos = homeId
    ? await db.prepare("SELECT * FROM field_photos WHERE home_id = ? ORDER BY sort_index").bind(homeId).all<PhotoRow>()
    : await db.prepare("SELECT * FROM field_photos ORDER BY sort_index LIMIT 4000").all<PhotoRow>();
  const photoRows = photos.results ?? [];
  return rows.map((row) => toEntry(row, photoRows));
}

async function readEntry(db: D1Database, id: string): Promise<EntryRow | null> {
  return db.prepare("SELECT * FROM field_entries WHERE id = ?").bind(id).first<EntryRow>();
}

export async function entryById(db: D1Database, id: string): Promise<FieldEntry | null> {
  const row = await readEntry(db, id);
  if (!row) return null;
  const photos = await db
    .prepare("SELECT * FROM field_photos WHERE entry_id = ? ORDER BY sort_index")
    .bind(id)
    .all<PhotoRow>();
  return toEntry(row, photos.results ?? []);
}

export interface CreateFieldInput {
  homeId: string;
  address: string;
  kind: FieldKind;
  disposition: FieldDisposition | null;
  category: string | null;
  note: string;
  lat: number | null;
  lon: number | null;
  authorEmail: string;
  sentry: { date: string; code: string; description: string; status: string } | null;
  photos: { bytes: Uint8Array; type: "image/jpeg" | "image/png" | "image/webp" }[];
}

export async function createEntry(
  db: D1Database,
  bucket: R2Bucket | undefined,
  input: CreateFieldInput,
): Promise<FieldEntry> {
  if (input.photos.length > MAX_PHOTOS) {
    throw new FieldInputError(`No more than ${MAX_PHOTOS} photos.`);
  }
  if (input.photos.length > 0 && !bucket) {
    throw new Error("photos-unconfigured");
  }
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  const key = input.sentry ? await violationKey(input.sentry) : null;
  await db
    .prepare(
      `INSERT INTO field_entries (
        id, home_id, address, kind, violation_key, disposition, category, note,
        lat, lon, author_email, created_at, updated_at,
        sentry_date, sentry_code, sentry_description, sentry_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      id,
      input.homeId,
      input.address,
      input.kind,
      key,
      input.disposition,
      input.category,
      input.note,
      input.lat,
      input.lon,
      input.authorEmail,
      now,
      now,
      input.sentry?.date ?? null,
      input.sentry?.code ?? null,
      input.sentry?.description ?? null,
      input.sentry?.status ?? null,
    )
    .run();

  const photos: FieldPhoto[] = [];
  try {
    for (let index = 0; index < input.photos.length; index += 1) {
      const photo = input.photos[index];
      const photoId = crypto.randomUUID();
      const extension = photoExtension(photo.type);
      const r2Key = `field/${input.homeId}/${id}/${index}.${extension}`;
      await bucket!.put(r2Key, photo.bytes, { httpMetadata: { contentType: photo.type } });
      await db
        .prepare(
          `INSERT INTO field_photos (
            id, entry_id, home_id, r2_key, content_type, byte_size, created_at, sort_index
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(photoId, id, input.homeId, r2Key, photo.type, photo.bytes.byteLength, now, index)
        .run();
      photos.push({ id: photoId, url: photoUrl(photoId) });
    }
  } catch (err) {
    await deleteEntryRows(db, bucket, id);
    throw err;
  }

  const created = await entryById(db, id);
  if (!created) throw new Error("insert-missing");
  return created;
}

export async function updateEntry(
  db: D1Database,
  id: string,
  authorEmail: string,
  patch: { note?: string; disposition?: FieldDisposition; category?: string },
): Promise<FieldEntry> {
  const row = await readEntry(db, id);
  if (!row) throw new FieldInputError("That field entry was not found.", 404);
  if (row.author_email.toLowerCase() !== authorEmail.toLowerCase()) {
    throw new FieldInputError("You can only edit your own field entry.", 403);
  }
  const note = patch.note ?? row.note;
  const disposition = patch.disposition ?? row.disposition;
  const category = patch.category ?? row.category;
  if (row.kind !== "disposition" && patch.disposition) {
    throw new FieldInputError("Only a violation observation has a disposition.");
  }
  if (row.kind !== "issue" && patch.category) {
    throw new FieldInputError("Only a new issue has a category.");
  }
  if (row.kind === "note" && !note) throw new FieldInputError("A note needs text.");
  const now = new Date().toISOString();
  await db
    .prepare(
      "UPDATE field_entries SET note = ?, disposition = ?, category = ?, updated_at = ? WHERE id = ?",
    )
    .bind(note, row.kind === "disposition" ? disposition : null, row.kind === "issue" ? category : null, now, id)
    .run();
  const updated = await entryById(db, id);
  if (!updated) throw new Error("update-missing");
  return updated;
}

async function deleteEntryRows(db: D1Database, bucket: R2Bucket | undefined, id: string): Promise<void> {
  const photos = await db
    .prepare("SELECT r2_key FROM field_photos WHERE entry_id = ?")
    .bind(id)
    .all<{ r2_key: string }>();
  if (bucket) {
    for (const photo of photos.results ?? []) {
      await bucket.delete(photo.r2_key);
    }
  }
  await db.batch([
    db.prepare("DELETE FROM field_photos WHERE entry_id = ?").bind(id),
    db.prepare("DELETE FROM field_entries WHERE id = ?").bind(id),
  ]);
}

export async function deleteEntry(
  db: D1Database,
  bucket: R2Bucket | undefined,
  id: string,
  authorEmail: string,
): Promise<void> {
  const row = await readEntry(db, id);
  if (!row) throw new FieldInputError("That field entry was not found.", 404);
  if (row.author_email.toLowerCase() !== authorEmail.toLowerCase()) {
    throw new FieldInputError("You can only delete your own field entry.", 403);
  }
  await deleteEntryRows(db, bucket, id);
}

export async function readPhoto(
  db: D1Database,
  bucket: R2Bucket | undefined,
  id: string,
): Promise<{ body: ReadableStream; contentType: string } | null> {
  if (!bucket) return null;
  const row = await db
    .prepare("SELECT r2_key, content_type FROM field_photos WHERE id = ?")
    .bind(id)
    .first<{ r2_key: string; content_type: string }>();
  if (!row) return null;
  const object = await bucket.get(row.r2_key);
  if (!object) return null;
  return { body: object.body, contentType: row.content_type };
}

export async function readPhotoFiles(files: File[]): Promise<CreateFieldInput["photos"]> {
  if (files.length > MAX_PHOTOS) throw new FieldInputError(`No more than ${MAX_PHOTOS} photos.`);
  const photos: CreateFieldInput["photos"] = [];
  for (const file of files) {
    if (file.size === 0) continue;
    const bytes = new Uint8Array(await file.arrayBuffer());
    const type = sniffImage(bytes, file.type || "image/jpeg");
    photos.push({ bytes, type });
  }
  return photos;
}
