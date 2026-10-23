// /violations/field/* — board field notes. Access covers the /violations prefix,
// and every method here checks the Access JWT. The author is the token email.
// Do not add functions/violations.ts; that would take the map page.

import { authenticateAccess, type AccessEnv } from "../../../lib/access/verify-access";
import type { FieldDisposition, FieldKind } from "../../../lib/field/types";
import {
  cleanAddress,
  cleanCategory,
  cleanCoordinate,
  cleanDisposition,
  cleanHomeId,
  cleanKind,
  cleanNote,
  cleanSnapshot,
  FieldInputError,
} from "../../../lib/field/validate";
import {
  createEntry,
  deleteEntry,
  ensureFieldSchema,
  entryById,
  listEntries,
  readPhoto,
  readPhotoFiles,
  updateEntry,
  type FieldBindings,
} from "./store";

interface Env extends AccessEnv, FieldBindings {}

const PRIVATE = {
  "Cache-Control": "private, no-store",
  "X-Robots-Tag": "noindex",
  "X-Content-Type-Options": "nosniff",
};

function json(body: unknown, status = 200): Response {
  return Response.json(body, {
    status,
    headers: { ...PRIVATE, "Content-Type": "application/json; charset=utf-8" },
  });
}

function segments(path: string | string[] | undefined): string[] {
  if (!path) return [];
  return Array.isArray(path) ? path : [path];
}

function textField(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === "string" ? value : "";
}

async function photosFromForm(form: FormData): Promise<File[]> {
  const files: File[] = [];
  for (const name of ["photo", "photos"]) {
    for (const value of form.getAll(name)) {
      if (value instanceof File && value.size > 0) files.push(value);
    }
  }
  return files;
}

export const onRequest: PagesFunction<Env, "path"> = async (context) => {
  const auth = await authenticateAccess(context.request, context.env);
  if (!auth.ok) return auth.response;
  if (!auth.email) return json({ error: "Access token has no email." }, 403);

  const db = context.env.FIELD_DB;
  if (!db) return json({ error: "Field storage is not configured." }, 503);
  try {
    await ensureFieldSchema(db);
  } catch (err) {
    console.error("FIELD_DB schema failed", err);
    return json({ error: "Field storage is not available." }, 503);
  }

  const parts = segments(context.params.path);
  const method = context.request.method;
  try {
    if (parts.length === 1 && parts[0] === "entries" && method === "GET") {
      const homeId = new URL(context.request.url).searchParams.get("homeId");
      const entries = await listEntries(db, homeId ? cleanHomeId(homeId) : null);
      return json({ viewerEmail: auth.email, entries });
    }

    if (parts.length === 1 && parts[0] === "entries" && method === "POST") {
      return await createFromRequest(context.request, db, context.env.FIELD_PHOTOS, auth.email);
    }

    if (parts.length === 2 && parts[0] === "entries" && method === "PATCH") {
      return await patchFromRequest(context.request, db, parts[1], auth.email);
    }

    if (parts.length === 2 && parts[0] === "entries" && method === "DELETE") {
      await deleteEntry(db, context.env.FIELD_PHOTOS, parts[1], auth.email);
      return json({ ok: true });
    }

    if (parts.length === 2 && parts[0] === "photos" && method === "GET") {
      if (!context.env.FIELD_PHOTOS) return json({ error: "Field photos are not configured." }, 503);
      const photo = await readPhoto(db, context.env.FIELD_PHOTOS, parts[1]);
      if (!photo) return json({ error: "Photo not found." }, 404);
      return new Response(photo.body, {
        headers: { ...PRIVATE, "Content-Type": photo.contentType },
      });
    }

    return json({ error: "Not found." }, 404);
  } catch (err) {
    if (err instanceof FieldInputError) return json({ error: err.message }, err.status);
    if (err instanceof Error && err.message === "photos-unconfigured") {
      return json({ error: "Field photos are not configured." }, 503);
    }
    console.error("field request failed", err);
    return json({ error: "Could not save the field entry." }, 500);
  }
};

async function createFromRequest(
  request: Request,
  db: D1Database,
  bucket: R2Bucket | undefined,
  authorEmail: string,
): Promise<Response> {
  const form = await request.formData();
  const kind: FieldKind = cleanKind(textField(form, "kind"));
  const note = cleanNote(textField(form, "note"));
  if (kind === "note" && !note) throw new FieldInputError("A note needs text.");
  const disposition = kind === "disposition" ? cleanDisposition(textField(form, "disposition")) : null;
  const category = kind === "issue" ? cleanCategory(textField(form, "category")) : null;
  const sentry =
    kind === "disposition"
      ? cleanSnapshot({
          date: textField(form, "violationDate"),
          code: textField(form, "violationCode"),
          description: textField(form, "violationDescription"),
          status: textField(form, "violationStatus"),
        })
      : null;
  const files = await photosFromForm(form);
  const photos = await readPhotoFiles(files);
  const entry = await createEntry(db, bucket, {
    homeId: cleanHomeId(textField(form, "homeId")),
    address: cleanAddress(textField(form, "address")),
    kind,
    disposition,
    category,
    note,
    lat: cleanCoordinate(textField(form, "lat"), -90, 90),
    lon: cleanCoordinate(textField(form, "lon"), -180, 180),
    authorEmail,
    sentry,
    photos,
  });
  return json({ entry }, 201);
}

async function patchFromRequest(
  request: Request,
  db: D1Database,
  id: string,
  authorEmail: string,
): Promise<Response> {
  const body = (await request.json()) as {
    note?: unknown;
    disposition?: unknown;
    category?: unknown;
  };
  const existing = await entryById(db, id);
  if (!existing) throw new FieldInputError("That field entry was not found.", 404);
  const patch: { note?: string; disposition?: FieldDisposition; category?: string } = {};
  if ("note" in body) patch.note = cleanNote(body.note);
  if ("disposition" in body && body.disposition != null) patch.disposition = cleanDisposition(body.disposition);
  if ("category" in body && body.category != null) patch.category = cleanCategory(body.category);
  if (Object.keys(patch).length === 0) throw new FieldInputError("Nothing to update.");
  const entry = await updateEntry(db, id, authorEmail, patch);
  return json({ entry });
}
