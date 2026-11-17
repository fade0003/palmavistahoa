import assert from "node:assert/strict";
import { test } from "node:test";
import { SNAP_METERS, nearestHome } from "../app/violations/geo.ts";
import { markerTone, type Home } from "../app/violations/types.ts";

function home(overrides: Partial<Home> = {}): Home {
  return {
    id: "abc12345abcd",
    address: "104 Example Ct",
    lat: 28.5,
    lon: -81.46,
    status: "gray",
    violations: [],
    architectural: [],
    arrears: null,
    ...overrides,
  };
}

test("map tap snaps to the nearest loaded home and ignores a far tap", () => {
  const near = home({ id: "near00000001", lat: 28.5, lon: -81.46 });
  const far = home({ id: "far000000002", lat: 29.5, lon: -81.46 });
  const hit = nearestHome([far, near], { lat: 28.5, lon: -81.46 }, SNAP_METERS);
  assert.equal(hit?.home.id, "near00000001");
  assert.equal(hit?.meters, 0);
  assert.equal(nearestHome([far], { lat: 28.5, lon: -81.46 }, SNAP_METERS), null);
  assert.equal(nearestHome([{ ...near, lat: Number.NaN }], { lat: 28.5, lon: -81.46 }, SNAP_METERS), null);
});

test("neutral markers stay available for homes without an open violation", () => {
  const quiet = home();
  const red = home({ id: "red000000001", status: "red" });
  const owes = home({
    id: "owe000000001",
    arrears: { total: 10, pastDue: 10, collection: null },
  });
  assert.equal(markerTone(quiet, "all", null), "quiet");
  assert.equal(markerTone(red, "all", null), "vivid");
  assert.equal(markerTone(red, "orange", null), "quiet");
  assert.equal(markerTone(red, "red", null), "vivid");
  assert.equal(markerTone(owes, "owes", null), "vivid");
  assert.equal(markerTone(quiet, "red", quiet.id), "vivid");
});
