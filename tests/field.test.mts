import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { violationKey } from "../lib/field/keys.ts";
import { homeFieldCleared, latestDisposition } from "../lib/field/match.ts";
import { buildFieldReport, letterMailto } from "../lib/field/report.ts";
import { fieldSchemaSql } from "../lib/field/schema.ts";
import type { FieldEntry } from "../lib/field/types.ts";
import { FieldInputError, cleanCategory, cleanNote, sniffImage } from "../lib/field/validate.ts";

const item = {
  date: "2026-01-02",
  code: "FIX-TRASH",
  description: "FIXTURE: example trash cart",
  status: "O-F1P",
};

function entry(overrides: Partial<FieldEntry> = {}): FieldEntry {
  return {
    id: "entry-1",
    homeId: "abc12345",
    address: "104 Example Ct",
    kind: "disposition",
    violationKey: null,
    disposition: "resolved",
    category: null,
    note: "Cart was in",
    lat: 28.5,
    lon: -81.46,
    authorEmail: "palingenstudios@gmail.com",
    createdAt: "2026-10-24T15:00:00.000Z",
    updatedAt: "2026-10-24T15:00:00.000Z",
    sentryDate: item.date,
    sentryCode: item.code,
    sentryDescription: item.description,
    sentryStatus: item.status,
    photos: [],
    ...overrides,
  };
}

test("violation key is stable and ignores surrounding whitespace", async () => {
  const first = await violationKey(item);
  const second = await violationKey({ ...item, description: "  FIXTURE: example trash cart  " });
  assert.equal(first, second);
  assert.equal(first.length, 64);
  assert.notEqual(first, await violationKey({ ...item, code: "FIX-LAWN" }));
});

test("a home is field-cleared only when every open item is marked resolved", async () => {
  const key = await violationKey(item);
  const home = { id: "abc12345", violations: [item], architectural: [] };
  assert.equal(await homeFieldCleared(home, []), false);
  assert.equal(await homeFieldCleared(home, [entry({ violationKey: key, disposition: "still_open" })]), false);
  assert.equal(await homeFieldCleared(home, [entry({ violationKey: key, disposition: "resolved" })]), true);
  const newer = entry({
    id: "entry-2",
    violationKey: key,
    disposition: "still_open",
    createdAt: "2026-10-25T15:00:00.000Z",
  });
  assert.equal(latestDisposition([entry({ violationKey: key }), newer], home.id, key)?.id, "entry-2");
  assert.equal(await homeFieldCleared({ id: "abc12345", violations: [], architectural: [] }, []), false);
});

test("field input validation rejects unknown categories, long notes, and non-images", () => {
  assert.equal(cleanCategory("Mailbox"), "Mailbox");
  assert.throws(() => cleanCategory("Pool"), FieldInputError);
  assert.throws(() => cleanNote("x".repeat(2001)), FieldInputError);
  assert.equal(sniffImage(Uint8Array.from([0xff, 0xd8, 0xff, 0, 0, 0, 0, 0, 0, 0, 0, 0]), "image/jpeg"), "image/jpeg");
  assert.throws(() => sniffImage(Uint8Array.from([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]), "image/jpeg"), FieldInputError);
});

test("schema migration matches the lazy init statements", () => {
  const migration = readFileSync("migrations/0001_field.sql", "utf8");
  const normalize = (sql: string) => sql.replace(/\s+/g, " ").trim();
  assert.equal(normalize(migration), normalize(fieldSchemaSql()));
  assert.match(migration, /CREATE TABLE IF NOT EXISTS field_entries/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS field_photos/);
});

test("report embeds photos and writes a letter to Sentry Management", () => {
  const sentAt = "2026-10-24T15:00:00.000Z";
  const report = buildFieldReport(
    "Palma Vista HOA field observations — 104 <Example> Ct",
    [
      {
        ...entry(),
        address: `104 <Example> Ct`,
        historical: false,
        embedded: [{ dataUri: "data:image/jpeg;base64,abc" }],
      },
      {
        ...entry({
          id: "entry-2",
          kind: "issue",
          disposition: null,
          category: "Lawn/landscaping",
          note: "Edge needs edging",
          sentryDate: null,
          sentryCode: null,
          sentryDescription: null,
          sentryStatus: null,
        }),
        address: `104 <Example> Ct`,
        historical: false,
        embedded: [],
      },
    ],
    { scope: "home", sentAt, address: "104 <Example> Ct" },
  );
  assert.match(report.html, /104 &lt;Example&gt; Ct/);
  assert.match(report.html, /data:image\/jpeg;base64,abc/);
  assert.match(report.html, /letter to Sentry Management/);
  assert.match(report.csv, /palingenstudios@gmail.com/);
  assert.match(report.text, /^October 24, 2026\n\nSentry Management,/);
  assert.match(report.text, /observed at 104 <Example> Ct on October 24, 2026/);
  assert.match(report.text, /appeared resolved in the field/);
  assert.match(report.text, /dated January 2, 2026, code FIX-TRASH, status O-F1P/);
  assert.match(report.text, /The violation reads: FIXTURE: example trash cart\./);
  assert.match(report.text, /Cart was in\./);
  assert.match(report.text, /One photo is included with this letter\./);
  assert.match(report.text, /noted a new issue: Lawn\/landscaping/);
  assert.match(report.text, /Palma Vista Homeowners Association\nBoard of Directors$/);
  assert.doesNotMatch(report.text, /Field: resolved/);
  assert.doesNotMatch(report.text, /HTML report was downloaded/);
  assert.doesNotMatch(report.html, /<script/);

  const mail = letterMailto("Palma Vista HOA field observations", report.text);
  assert.match(decodeURIComponent(mail), /Sentry Management/);
  assert.doesNotMatch(decodeURIComponent(mail), /saved on this phone/);
  const long = letterMailto("Subject", `${"Sentry Management,\n\n"}${"Observation. ".repeat(400)}`);
  assert.ok(long.length <= 1800);
  assert.match(decodeURIComponent(long), /Sentry Management/);
  assert.match(decodeURIComponent(long), /saved on this phone/);
});
