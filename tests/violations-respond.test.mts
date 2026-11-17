import assert from "node:assert/strict";
import { test } from "node:test";
import { VIOLATIONS_KEY, violationsDataResponse } from "../lib/violations/respond.ts";

test("violations key is the production KV key", () => {
  assert.equal(VIOLATIONS_KEY, "violations.json");
});

test("missing binding and missing key fail closed without throwing", async () => {
  const missingBinding = violationsDataResponse({ bindingPresent: false });
  assert.equal(missingBinding.status, 503);
  assert.equal(missingBinding.headers.get("cache-control"), "private, no-store");
  assert.equal(missingBinding.headers.get("x-robots-tag"), "noindex");
  const bindingBody = (await missingBinding.json()) as { error: string };
  assert.match(bindingBody.error, /not configured/);

  const missingKey = violationsDataResponse({ bindingPresent: true, raw: null });
  assert.equal(missingKey.status, 404);
  assert.equal(missingKey.headers.get("cache-control"), "private, no-store");

  const readError = violationsDataResponse({ bindingPresent: true, readError: true });
  assert.equal(readError.status, 503);
});

test("invalid JSON is rejected and valid JSON is returned uncached", async () => {
  const invalid = violationsDataResponse({ bindingPresent: true, raw: "{not json" });
  assert.equal(invalid.status, 500);

  const raw = JSON.stringify({ updated: "2026-10-23", homes: [] });
  const ok = violationsDataResponse({ bindingPresent: true, raw });
  assert.equal(ok.status, 200);
  assert.equal(ok.headers.get("cache-control"), "private, no-store");
  assert.equal(await ok.text(), raw);
});
