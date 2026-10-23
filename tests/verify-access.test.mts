import assert from "node:assert/strict";
import { test } from "node:test";
import {
  audienceFromEnv,
  bytesToBase64Url,
  certsUrlForTeam,
  clearAccessKeyCache,
  DEFAULT_AUD,
  DEFAULT_TEAM_DOMAIN,
  issuerForTeam,
  requireAccess,
  teamDomainFromEnv,
  verifyAccessJwt,
  type AccessJwk,
} from "../lib/access/verify-access.ts";

const AUD = DEFAULT_AUD;
const ISSUER = issuerForTeam(DEFAULT_TEAM_DOMAIN);
const CERTS = certsUrlForTeam(DEFAULT_TEAM_DOMAIN);
const NOW = 1_700_000_000_000;

async function makeKey(kid = "test-key") {
  const pair = await crypto.subtle.generateKey(
    {
      name: "RSASSA-PKCS1-v1_5",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["sign", "verify"],
  );
  const jwk = await crypto.subtle.exportKey("jwk", pair.publicKey);
  const publicJwk: AccessJwk = {
    kid,
    kty: "RSA",
    alg: "RS256",
    use: "sig",
    n: jwk.n,
    e: jwk.e,
  };
  return { privateKey: pair.privateKey, publicJwk };
}

function encode(value: unknown): string {
  return bytesToBase64Url(new TextEncoder().encode(JSON.stringify(value)));
}

async function signToken(
  privateKey: CryptoKey,
  payload: unknown,
  header: { alg?: string; kid?: string } = {},
): Promise<string> {
  const encodedHeader = encode({ alg: "RS256", kid: "test-key", typ: "JWT", ...header });
  const encodedPayload = encode(payload);
  const data = new TextEncoder().encode(`${encodedHeader}.${encodedPayload}`);
  const signature = new Uint8Array(
    await crypto.subtle.sign("RSASSA-PKCS1-v1_5", privateKey, data),
  );
  return `${encodedHeader}.${encodedPayload}.${bytesToBase64Url(signature)}`;
}

function payload(overrides: Record<string, unknown> = {}) {
  return {
    aud: AUD,
    iss: ISSUER,
    exp: Math.floor(NOW / 1000) + 3600,
    iat: Math.floor(NOW / 1000),
    email: "board@example.com",
    sub: "fixture-user",
    ...overrides,
  };
}

function options(loadKeys: () => Promise<AccessJwk[]>) {
  return {
    audience: AUD,
    issuer: ISSUER,
    certsUrl: CERTS,
    loadKeys,
    now: () => NOW,
  };
}

test("accepts a valid RS256 Access token", async () => {
  const { privateKey, publicJwk } = await makeKey();
  const token = await signToken(privateKey, payload());
  const result = await verifyAccessJwt(token, options(async () => [publicJwk]));
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.payload.email, "board@example.com");
});

test("accepts aud as an array containing the application tag", async () => {
  const { privateKey, publicJwk } = await makeKey();
  const token = await signToken(privateKey, payload({ aud: ["other", AUD] }));
  const result = await verifyAccessJwt(token, options(async () => [publicJwk]));
  assert.equal(result.ok, true);
});

test("rejects an expired token", async () => {
  const { privateKey, publicJwk } = await makeKey();
  const token = await signToken(
    privateKey,
    payload({ exp: Math.floor(NOW / 1000) - 120 }),
  );
  const result = await verifyAccessJwt(token, options(async () => [publicJwk]));
  assert.deepEqual(result, { ok: false, status: 403, reason: "expired" });
});

test("allows a token inside the clock-skew window", async () => {
  const { privateKey, publicJwk } = await makeKey();
  const token = await signToken(
    privateKey,
    payload({ exp: Math.floor(NOW / 1000) - 30 }),
  );
  const result = await verifyAccessJwt(token, options(async () => [publicJwk]));
  assert.equal(result.ok, true);
});

test("rejects the wrong audience", async () => {
  const { privateKey, publicJwk } = await makeKey();
  const token = await signToken(privateKey, payload({ aud: "not-the-application" }));
  const result = await verifyAccessJwt(token, options(async () => [publicJwk]));
  assert.deepEqual(result, { ok: false, status: 403, reason: "audience" });
});

test("rejects the wrong issuer", async () => {
  const { privateKey, publicJwk } = await makeKey();
  const token = await signToken(privateKey, payload({ iss: "https://evil.example" }));
  const result = await verifyAccessJwt(token, options(async () => [publicJwk]));
  assert.deepEqual(result, { ok: false, status: 403, reason: "issuer" });
});

test("rejects a bad signature", async () => {
  const { privateKey, publicJwk } = await makeKey();
  const token = await signToken(privateKey, payload());
  const [h, p, s] = token.split(".");
  const flipped = s.slice(0, -2) + (s.endsWith("a") ? "b" : "a");
  const result = await verifyAccessJwt(`${h}.${p}.${flipped}`, options(async () => [publicJwk]));
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.status, 403);
});

test("rejects alg none", async () => {
  const header = encode({ alg: "none", kid: "test-key" });
  const body = encode(payload());
  const result = await verifyAccessJwt(`${header}.${body}.`, options(async () => []));
  assert.deepEqual(result, { ok: false, status: 403, reason: "alg" });
});

test("caches JWKS and refreshes once for an unknown kid", async () => {
  clearAccessKeyCache();
  const { privateKey, publicJwk } = await makeKey("rotated");
  const token = await signToken(privateKey, payload(), { kid: "rotated" });
  let calls = 0;
  const original = globalThis.fetch;
  globalThis.fetch = async () => {
    calls += 1;
    const keys = calls === 1 ? [] : [publicJwk];
    return new Response(JSON.stringify({ keys }), {
      status: 200,
      headers: { "cache-control": "public, max-age=3600" },
    });
  };
  try {
    const opts = { audience: AUD, issuer: ISSUER, certsUrl: CERTS, now: () => NOW };
    const first = await verifyAccessJwt(token, opts);
    const second = await verifyAccessJwt(token, opts);
    assert.equal(first.ok, true);
    assert.equal(second.ok, true);
    assert.equal(calls, 2);
    await verifyAccessJwt(token, opts);
    assert.equal(calls, 2);
  } finally {
    globalThis.fetch = original;
    clearAccessKeyCache();
  }
});

test("requireAccess returns 401 when the header is missing and 403 when it is invalid", async () => {
  const missing = await requireAccess(new Request("https://www.palmavistahoa.com/violations/data"));
  assert.ok(missing);
  assert.equal(missing.status, 401);
  assert.equal(missing.headers.get("cache-control"), "private, no-store");

  const invalid = await requireAccess(
    new Request("https://www.palmavistahoa.com/api/admin/content", {
      headers: { "Cf-Access-Jwt-Assertion": "not-a-token" },
    }),
  );
  assert.ok(invalid);
  assert.equal(invalid.status, 403);
  assert.equal(invalid.headers.get("x-robots-tag"), "noindex");
});

test("env overrides replace the default team domain and audience", async () => {
  clearAccessKeyCache();
  const domain = "example-team.cloudflareaccess.com";
  const aud = "custom-aud-tag";
  const { privateKey, publicJwk } = await makeKey();
  const token = await signToken(
    privateKey,
    payload({
      aud,
      iss: issuerForTeam(domain),
      exp: Math.floor(Date.now() / 1000) + 3600,
    }),
  );
  const original = globalThis.fetch;
  let requested = "";
  globalThis.fetch = async (input) => {
    requested = String(input);
    return new Response(JSON.stringify({ keys: [publicJwk] }), {
      status: 200,
      headers: { "cache-control": "max-age=120" },
    });
  };
  try {
    const response = await requireAccess(
      new Request("https://www.palmavistahoa.com/violations/data", {
        headers: { "Cf-Access-Jwt-Assertion": token },
      }),
      {
        ACCESS_TEAM_DOMAIN: `https://${domain}/cdn-cgi/access`,
        ACCESS_AUD: aud,
      },
    );
    assert.equal(response, null);
    assert.equal(requested, certsUrlForTeam(domain));
    assert.equal(teamDomainFromEnv(undefined), DEFAULT_TEAM_DOMAIN);
    assert.equal(audienceFromEnv("  "), DEFAULT_AUD);
  } finally {
    globalThis.fetch = original;
    clearAccessKeyCache();
  }
});
