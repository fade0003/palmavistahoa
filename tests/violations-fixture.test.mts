import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const data = JSON.parse(readFileSync("fixtures/violations.sample.json", "utf8"));

const FAKE_ADDRESS =
  /^\d+ (Example Ct|Sample Ln|Placeholder Dr|Fictional Way|Demo Cir|Test Blvd|Mock Pl)$/;

function bucket(ageDays: number): string {
  if (ageDays <= 30) return "0-30";
  if (ageDays <= 60) return "31-60";
  if (ageDays <= 90) return "61-90";
  if (ageDays <= 180) return "91-180";
  return "180+";
}

function expectedStatus(violations: Array<{ status: string; ageDays: number }>): string {
  const open = violations.filter((entry) => entry.status.toUpperCase().startsWith("O"));
  if (open.some((entry) => entry.ageDays >= 90)) return "red";
  if (open.length > 0) return "orange";
  return "gray";
}

test("sample fixture is fictional and internally consistent", () => {
  assert.equal(data.homes.length, 105);
  assert.match(data.sources.violations, /FAKE/);
  assert.match(data.sources.arrears, /FAKE/);
  assert.match(data.updated, /^\d{4}-\d{2}-\d{2}$/);

  const ids = new Set<string>();
  const aging: Record<string, number> = { "0-30": 0, "31-60": 0, "61-90": 0, "91-180": 0, "180+": 0 };
  let openItems = 0;
  let arrearsCents = 0;
  let pastCents = 0;
  let inCollection = 0;

  for (const home of data.homes) {
    assert.match(home.id, /^[a-f0-9]{12}$/);
    assert.equal(ids.has(home.id), false);
    ids.add(home.id);
    assert.match(home.address, FAKE_ADDRESS);
    assert.equal(home.address.includes("Palma"), false);
    assert.ok(home.lat > 28.49 && home.lat < 28.52);
    assert.ok(home.lon < -81.45 && home.lon > -81.48);
    assert.equal(home.status, expectedStatus(home.violations));
    for (const entry of [...home.violations, ...home.architectural]) {
      assert.match(entry.description, /^FIXTURE:/);
      assert.match(entry.code, /^FIX-/);
      assert.match(entry.date, /^\d{4}-\d{2}-\d{2}$/);
    }
    for (const entry of home.violations) {
      if (!String(entry.status).toUpperCase().startsWith("O")) continue;
      openItems += 1;
      aging[bucket(entry.ageDays)] += 1;
    }
    if (home.arrears) {
      arrearsCents += Math.round(home.arrears.total * 100);
      pastCents += Math.round(home.arrears.pastDue * 100);
      if (home.arrears.collection) {
        assert.equal(home.arrears.collection, "Lien (LN)");
        inCollection += 1;
      }
    }
  }

  assert.equal(data.summary.openItems, openItems);
  assert.equal(
    data.summary.homesWithOpen,
    data.homes.filter((home: { status: string }) => home.status === "red" || home.status === "orange").length,
  );
  assert.deepEqual(data.summary.aging, aging);
  assert.equal(Math.round(data.summary.arrearsTotal * 100), arrearsCents);
  assert.equal(Math.round(data.summary.pastDue * 100), pastCents);
  assert.equal(data.summary.inCollection, inCollection);
  assert.ok(data.summary.homesWithOpen > 0);
  assert.ok(data.summary.inCollection > 0);
});
