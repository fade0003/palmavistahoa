import { isFieldCategory } from "./categories.ts";
import type { FieldDisposition, FieldKind, SentrySnapshot } from "./types.ts";

export const MAX_NOTE_LENGTH = 2000;
export const MAX_PHOTOS = 4;
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
export const MAX_ADDRESS_LENGTH = 200;

const HOME_ID = /^[a-f0-9]{8,64}$/i;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

export class FieldInputError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "FieldInputError";
    this.status = status;
  }
}

export function cleanNote(value: unknown): string {
  if (value == null) return "";
  if (typeof value !== "string") throw new FieldInputError("Note must be text.");
  const note = value.trim();
  if (note.length > MAX_NOTE_LENGTH) {
    throw new FieldInputError(`Note must be ${MAX_NOTE_LENGTH} characters or less.`);
  }
  return note;
}

export function cleanHomeId(value: unknown): string {
  if (typeof value !== "string" || !HOME_ID.test(value.trim())) {
    throw new FieldInputError("Home id is not valid.");
  }
  return value.trim().toLowerCase();
}

export function cleanAddress(value: unknown): string {
  if (typeof value !== "string") throw new FieldInputError("Address is required.");
  const address = value.trim();
  if (!address || address.length > MAX_ADDRESS_LENGTH) {
    throw new FieldInputError("Address is required.");
  }
  return address;
}

export function cleanKind(value: unknown): FieldKind {
  if (value === "disposition" || value === "note" || value === "issue") return value;
  throw new FieldInputError("Unknown field entry type.");
}

export function cleanDisposition(value: unknown): FieldDisposition {
  if (value === "resolved" || value === "still_open") return value;
  throw new FieldInputError("Disposition must be resolved or still open.");
}

export function cleanCategory(value: unknown): string {
  if (typeof value !== "string" || !isFieldCategory(value.trim())) {
    throw new FieldInputError("Choose a category from the list.");
  }
  return value.trim();
}

export function cleanCoordinate(value: unknown, min: number, max: number): number | null {
  if (value == null || value === "") return null;
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(number) || number < min || number > max) {
    throw new FieldInputError("Location is not valid.");
  }
  return number;
}

export function cleanSnapshot(input: {
  date: unknown;
  code: unknown;
  description: unknown;
  status: unknown;
}): SentrySnapshot {
  if (typeof input.date !== "string" || !DAY.test(input.date.trim())) {
    throw new FieldInputError("Violation date is not valid.");
  }
  if (typeof input.code !== "string" || !input.code.trim() || input.code.trim().length > 40) {
    throw new FieldInputError("Violation code is not valid.");
  }
  if (
    typeof input.description !== "string" ||
    !input.description.trim() ||
    input.description.trim().length > 500
  ) {
    throw new FieldInputError("Violation description is not valid.");
  }
  if (typeof input.status !== "string" || !input.status.trim() || input.status.trim().length > 20) {
    throw new FieldInputError("Violation status is not valid.");
  }
  return {
    date: input.date.trim(),
    code: input.code.trim(),
    description: input.description.trim().replace(/\s+/g, " "),
    status: input.status.trim(),
  };
}

export function sniffImage(bytes: Uint8Array, declaredType: string): "image/jpeg" | "image/png" | "image/webp" {
  const type = declaredType.toLowerCase().split(";")[0].trim();
  if (bytes.byteLength < 12 || bytes.byteLength > MAX_PHOTO_BYTES) {
    throw new FieldInputError("Each photo must be a JPEG, PNG, or WebP under 5 MB.");
  }
  const jpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const png =
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  const webp =
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50;
  if (jpeg && (type === "image/jpeg" || type === "image/jpg" || type === "")) return "image/jpeg";
  if (png && (type === "image/png" || type === "")) return "image/png";
  if (webp && (type === "image/webp" || type === "")) return "image/webp";
  throw new FieldInputError("Each photo must be a JPEG, PNG, or WebP under 5 MB.");
}

export function photoExtension(type: "image/jpeg" | "image/png" | "image/webp"): string {
  if (type === "image/png") return "png";
  if (type === "image/webp") return "webp";
  return "jpg";
}
