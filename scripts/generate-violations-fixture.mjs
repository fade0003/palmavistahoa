// Builds fixtures/violations.sample.json.
// Every address and description is fictional. Do not point this at real records.

import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";

const UPDATED = "2026-10-23";
const STREETS = [
  "Example Ct",
  "Sample Ln",
  "Placeholder Dr",
  "Fictional Way",
  "Demo Cir",
  "Test Blvd",
  "Mock Pl",
];
const HOMES_PER_STREET = 15;
const VIOLATIONS = [
  { code: "FIX-LAWN", description: "FIXTURE: sample lawn taller than the guideline along the front yard" },
  { code: "FIX-TRASH", description: "FIXTURE: example trash cart left at the curb past pickup" },
  { code: "FIX-PAINT", description: "FIXTURE: placeholder exterior color outside the sample palette" },
  { code: "FIX-EDGE", description: "FIXTURE: fictional bed edging that was never approved" },
  { code: "FIX-VEH", description: "FIXTURE: demo vehicle stored in the driveway past the sample limit" },
];
const ARCHITECTURAL = [
  { code: "FIX-ARB", description: "FIXTURE: sample screen enclosure request, not a real application" },
  { code: "FIX-FENCE", description: "FIXTURE: fictional fence review with no homeowner attached" },
  { code: "FIX-ROOF", description: "FIXTURE: placeholder roof-tile sample still in review" },
];
const ITEM_STATUSES = ["O-N1", "O-N2", "O-F1P"];

function mulberry32(seed) {
  let a = seed >>> 0;
  return function rand() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(0x50414c4d);

function pick(list) {
  return list[Math.floor(rand() * list.length)];
}

function dateForAge(ageDays) {
  const [year, month, day] = UPDATED.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() - ageDays);
  return date.toISOString().slice(0, 10);
}

function item(templates, ageDays) {
  const template = pick(templates);
  return {
    date: dateForAge(ageDays),
    code: template.code,
    description: template.description,
    ageDays,
    status: pick(ITEM_STATUSES),
  };
}

function statusFor(violations) {
  const open = violations.filter((entry) => String(entry.status).toUpperCase().startsWith("O"));
  if (open.some((entry) => entry.ageDays >= 90)) return "red";
  if (open.length > 0) return "orange";
  return "gray";
}

function bucket(ageDays) {
  if (ageDays <= 30) return "0-30";
  if (ageDays <= 60) return "31-60";
  if (ageDays <= 90) return "61-90";
  if (ageDays <= 180) return "91-180";
  return "180+";
}

const homes = [];
let index = 0;
for (let street = 0; street < STREETS.length; street++) {
  for (let house = 0; house < HOMES_PER_STREET; house++) {
    const number = 100 + house * 4;
    const jitterLat = (rand() - 0.5) * 0.00008;
    const jitterLon = (rand() - 0.5) * 0.00008;
    const violations = [];
    const roll = rand();
    if (roll < 0.2) {
      violations.push(item(VIOLATIONS, 90 + Math.floor(rand() * 320)));
      if (rand() < 0.65) violations.push(item(VIOLATIONS, 1 + Math.floor(rand() * 200)));
      if (rand() < 0.25) violations.push(item(VIOLATIONS, 200 + Math.floor(rand() * 200)));
    } else if (roll < 0.38) {
      violations.push(item(VIOLATIONS, 1 + Math.floor(rand() * 89)));
      if (rand() < 0.45) violations.push(item(VIOLATIONS, 1 + Math.floor(rand() * 60)));
    }

    const architectural = [];
    if (rand() < 0.18) architectural.push(item(ARCHITECTURAL, 5 + Math.floor(rand() * 100)));
    if (rand() < 0.05) architectural.push(item(ARCHITECTURAL, 10 + Math.floor(rand() * 40)));

    let arrears = null;
    if (rand() < 0.24) {
      const totalCents = 4000 + Math.floor(rand() * 76000);
      const pastCents = Math.floor(rand() * (totalCents + 1));
      arrears = {
        total: totalCents / 100,
        pastDue: pastCents / 100,
        collection: rand() < 0.28 ? "Lien (LN)" : null,
      };
    }

    homes.push({
      id: createHash("sha256").update(`palma-vista-fixture-home-${index}`).digest("hex").slice(0, 12),
      address: `${number} ${STREETS[street]}`,
      lat: Math.round((28.4992 + street * 0.00105 + jitterLat) * 1e6) / 1e6,
      lon: Math.round((-81.4628 + house * 0.00078 + jitterLon) * 1e6) / 1e6,
      status: statusFor(violations),
      violations,
      architectural,
      arrears,
    });
    index += 1;
  }
}

const aging = { "0-30": 0, "31-60": 0, "61-90": 0, "91-180": 0, "180+": 0 };
let openItems = 0;
for (const home of homes) {
  for (const entry of home.violations) {
    if (!String(entry.status).toUpperCase().startsWith("O")) continue;
    openItems += 1;
    aging[bucket(entry.ageDays)] += 1;
  }
}

const withBalance = homes.filter((home) => home.arrears);
const summary = {
  openItems,
  homesWithOpen: homes.filter((home) => home.status === "red" || home.status === "orange").length,
  aging,
  arrearsTotal: withBalance.reduce((sum, home) => sum + Math.round(home.arrears.total * 100), 0) / 100,
  pastDue: withBalance.reduce((sum, home) => sum + Math.round(home.arrears.pastDue * 100), 0) / 100,
  inCollection: withBalance.filter((home) => home.arrears.collection).length,
};

const data = {
  updated: UPDATED,
  sources: {
    violations: "FAKE fixture — not real violation records",
    arrears: "FAKE fixture — not real arrears records",
  },
  summary,
  homes,
};

writeFileSync("fixtures/violations.sample.json", `${JSON.stringify(data, null, 2)}\n`);
console.log(
  `wrote ${homes.length} homes, openItems=${summary.openItems}, homesWithOpen=${summary.homesWithOpen}, arrears=${summary.arrearsTotal}`,
);
