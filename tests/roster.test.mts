import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { PROPERTIES_KEY, mergePropertyRoster } from "../lib/violations/roster.ts";

const existing = {
  id: "abc12345abcd",
  address: "104 Example Ct",
  lat: 28.5,
  lon: -81.46,
  status: "red",
  violations: [{ date: "2026-01-02", code: "FIX", description: "Sample", ageDays: 1, status: "O-N1" }],
  architectural: [],
  arrears: null,
};

function violationsRaw(): string {
  return JSON.stringify({
    updated: "2026-01-01",
    summary: { openItems: 1 },
    homes: [existing],
  });
}

test("property roster key stays private and is merged only behind access", () => {
  assert.equal(PROPERTIES_KEY, "properties.json");
  const source = readFileSync("functions/violations/data.ts", "utf8");
  assert.match(source, /requireAccess/);
  assert.match(source, /PROPERTIES_KEY/);
  assert.match(source, /mergePropertyRoster/);
  assert.doesNotMatch(readFileSync("functions/api/content.ts", "utf8"), /properties\.json|VIOLATIONS_KV|FIELD_DB/);
});

test("roster adds a missing fictional home and ignores duplicates and private extras", () => {
  const raw = violationsRaw();
  assert.equal(mergePropertyRoster(raw, null), raw);
  assert.equal(mergePropertyRoster(raw, "not json"), raw);
  const roster = JSON.stringify({
    homes: [
      { id: "def67890abcd", address: "  10 Fictional Way ", lat: 28.51, lon: -81.47, owner: "do not keep" },
      { id: existing.id.toUpperCase(), address: "999 Other", lat: 28.52, lon: -81.48 },
      { id: "aabbccddeeff", address: "104 example ct", lat: 28.53, lon: -81.49 },
      { id: "bad", address: "1 Demo Cir", lat: 28.5, lon: -81.4 },
      { id: "001122334455", address: "2 Demo Cir", lat: 0, lon: 0 },
    ],
  });
  const merged = JSON.parse(mergePropertyRoster(raw, roster)) as {
    summary: { openItems: number };
    homes: Array<{ id: string; address: string; status: string; violations: unknown[]; arrears: null; owner?: string }>;
  };
  assert.equal(merged.summary.openItems, 1);
  assert.equal(merged.homes.length, 2);
  assert.equal(merged.homes[0].id, existing.id);
  assert.equal(merged.homes[0].status, "red");
  assert.equal(merged.homes[1].id, "def67890abcd");
  assert.equal(merged.homes[1].address, "10 Fictional Way");
  assert.equal(merged.homes[1].status, "gray");
  assert.deepEqual(merged.homes[1].violations, []);
  assert.equal(merged.homes[1].arrears, null);
  assert.equal(merged.homes[1].owner, undefined);
});
