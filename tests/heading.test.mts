import assert from "node:assert/strict";
import { test } from "node:test";
import {
  angularDelta,
  chooseHeading,
  headingFromOrientation,
  normalizeHeading,
  rotateScreenPoint,
  smoothHeading,
} from "../app/violations/heading.ts";

test("facing east puts an eastern point at the top of the screen", () => {
  const cssAngle = -90;
  const east = rotateScreenPoint(40, 0, cssAngle, 0, 0);
  const north = rotateScreenPoint(0, -30, cssAngle, 0, 0);
  assert.ok(Math.abs(east.x) < 0.001);
  assert.ok(east.y < -39);
  assert.ok(north.x < -29);
  assert.ok(Math.abs(north.y) < 0.001);
});

test("heading smoothing takes the short way around north", () => {
  assert.equal(normalizeHeading(-10), 350);
  assert.equal(angularDelta(350, 10), 20);
  const stepped = smoothHeading(350, 10, 0.5);
  assert.ok(stepped > 350 || stepped < 20);
  assert.equal(smoothHeading(null, 90), 90);
});

test("course is used while moving and the compass is used while stopped", () => {
  assert.equal(chooseHeading({ demo: 90, course: 10, speed: 5, compass: 20 }), 90);
  assert.equal(chooseHeading({ demo: null, course: 180, speed: 3, compass: 20 }), 180);
  assert.equal(chooseHeading({ demo: null, course: 180, speed: 0.2, compass: 45 }), 45);
  assert.equal(chooseHeading({ demo: null, course: null, speed: null, compass: null }), null);
});

test("orientation events read the compass heading", () => {
  assert.equal(headingFromOrientation({ alpha: 10, absolute: false, webkitCompassHeading: 120 }), 120);
  assert.equal(headingFromOrientation({ alpha: 90, absolute: true, webkitCompassHeading: null }), 270);
  assert.equal(headingFromOrientation({ alpha: 90, absolute: false, webkitCompassHeading: null }), null);
});
