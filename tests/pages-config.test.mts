import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";

const read = (path: string) => readFileSync(path, "utf8");

test("Cloudflare Pages is served from the domain root", () => {
  const config = read("next.config.ts");
  assert.doesNotMatch(config, /basePath\s*:/);
  assert.doesNotMatch(config, /assetPrefix\s*:/);
  assert.match(config, /output:\s*"export"/);
  assert.equal(existsSync(".github/workflows/deploy.yml"), false);
});

test("protected functions check Access and public functions do not", () => {
  const protectedFiles = [
    "functions/api/admin/content.ts",
    "functions/api/admin/upload.ts",
    "functions/violations/data.ts",
  ];
  for (const file of protectedFiles) {
    assert.match(read(file), /requireAccess/);
  }
  assert.match(read("functions/violations/field/[[path]].ts"), /authenticateAccess/);
  assert.equal(existsSync("functions/violations/field.ts"), false);

  const publicFiles = [
    "functions/api/content.ts",
    "functions/api/feedback.ts",
    "functions/api/chat.ts",
    "functions/api/rules-data.ts",
    "functions/api/media/[filename].ts",
  ];
  for (const file of publicFiles) {
    const source = read(file);
    assert.doesNotMatch(source, /requireAccess/);
    assert.doesNotMatch(source, /verifyAccessJwt/);
  }

  const violations = read("functions/violations/data.ts");
  assert.match(violations, /\/violations\/data/);
  assert.doesNotMatch(violations, /onRequest(?:Get|Post):\s*PagesFunction[\s\S]*functions\/violations\.ts/);
  assert.equal(existsSync("functions/violations.ts"), false);
  assert.equal(existsSync("functions/violations/index.ts"), false);
});

test("headers allow geolocation and map tiles only on /violations", () => {
  const headers = read("public/_headers");
  assert.match(headers, /Permissions-Policy: camera=\(\), microphone=\(\), geolocation=\(\)/);
  assert.match(headers, /\/violations\*[\s\S]*geolocation=\(self\)/);
  assert.match(headers, /\/violations\*[\s\S]*! Content-Security-Policy/);
  assert.match(headers, /\/violations\*[\s\S]*https:\/\/server\.arcgisonline\.com/);
  assert.match(headers, /\/violations\*[\s\S]*https:\/\/tile\.openstreetmap\.org/);
  assert.match(headers, /\/violations\*[\s\S]*X-Robots-Tag: noindex/);
  assert.match(headers, /\/admin\*[\s\S]*X-Robots-Tag: noindex/);

  const globalBlock = headers.split("/admin*")[0];
  assert.match(globalBlock, /geolocation=\(\)/);
  assert.doesNotMatch(globalBlock, /tile\.openstreetmap\.org/);
  assert.doesNotMatch(globalBlock, /geolocation=\(self\)/);
});
