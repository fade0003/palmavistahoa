// Verify Cloudflare Access JWTs (Cf-Access-Jwt-Assertion) with Web Crypto.
// Team domain and audience default to the Palma Vista Access application
// and can be overridden with ACCESS_TEAM_DOMAIN and ACCESS_AUD.

export const DEFAULT_TEAM_DOMAIN = "shrill-river-897c.cloudflareaccess.com";
export const DEFAULT_AUD =
  "57b9409fcf45794f589916c5c1d543e51eeed6b354e241db44d84eaddb7e6c98";

const SKEW_SECONDS = 60;
const MIN_TTL_MS = 60_000;
const MAX_TTL_MS = 24 * 60 * 60 * 1000;
const DEFAULT_TTL_MS = 60 * 60 * 1000;

export interface AccessEnv {
  ACCESS_TEAM_DOMAIN?: string;
  ACCESS_AUD?: string;
  /** Local wrangler only. Ignored unless the request host is localhost. */
  ACCESS_DEV_BYPASS?: string;
  ACCESS_DEV_EMAIL?: string;
}

export interface AccessJwtPayload {
  aud?: string | string[];
  iss?: string;
  exp?: number;
  nbf?: number;
  iat?: number;
  email?: string;
  sub?: string;
  [key: string]: unknown;
}

export type VerifyResult =
  | { ok: true; payload: AccessJwtPayload }
  | { ok: false; status: 403; reason: string };

export interface AccessJwk {
  kid?: string;
  kty?: string;
  alg?: string;
  use?: string;
  n?: string;
  e?: string;
}

export interface VerifyAccessOptions {
  audience: string;
  issuer: string;
  certsUrl: string;
  /** Test hook. When set, JWKS are not fetched or cached. */
  loadKeys?: () => Promise<AccessJwk[]>;
  now?: () => number;
  skewSeconds?: number;
}

type KeyCacheEntry = {
  expiresAt: number;
  keys: Map<string, CryptoKey>;
};

const keyCache = new Map<string, KeyCacheEntry>();

export function clearAccessKeyCache(): void {
  keyCache.clear();
}

export function teamDomainFromEnv(value: string | undefined): string {
  const raw = (value && value.trim()) || DEFAULT_TEAM_DOMAIN;
  return raw.replace(/^https?:\/\//i, "").replace(/\/.*$/, "");
}

export function audienceFromEnv(value: string | undefined): string {
  const raw = value?.trim();
  return raw ? raw : DEFAULT_AUD;
}

export function issuerForTeam(domain: string): string {
  return `https://${domain}`;
}

export function certsUrlForTeam(domain: string): string {
  return `https://${domain}/cdn-cgi/access/certs`;
}

function fail(reason: string): VerifyResult {
  return { ok: false, status: 403, reason };
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlToBytes(input: string): Uint8Array {
  if (!input || !/^[A-Za-z0-9_-]+$/.test(input)) {
    throw new Error("bad-base64url");
  }
  const padded = input.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (input.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function decodeJson<T>(part: string): T {
  const text = new TextDecoder().decode(base64UrlToBytes(part));
  return JSON.parse(text) as T;
}

function bufferOf(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function audienceMatches(aud: unknown, expected: string): boolean {
  if (typeof aud === "string") return aud === expected;
  if (Array.isArray(aud)) return aud.some((entry) => entry === expected);
  return false;
}

function ttlFromCacheControl(header: string | null): number {
  if (!header) return DEFAULT_TTL_MS;
  const match = /max-age=(\d+)/i.exec(header);
  if (!match) return DEFAULT_TTL_MS;
  const seconds = Number(match[1]);
  if (!Number.isFinite(seconds)) return DEFAULT_TTL_MS;
  return Math.min(MAX_TTL_MS, Math.max(MIN_TTL_MS, seconds * 1000));
}

async function importRsaKey(jwk: AccessJwk): Promise<CryptoKey | null> {
  if (jwk.kty !== "RSA" || !jwk.n || !jwk.e) return null;
  if (jwk.alg && jwk.alg !== "RS256") return null;
  return crypto.subtle.importKey(
    "jwk",
    { kty: "RSA", n: jwk.n, e: jwk.e, alg: "RS256" },
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"],
  );
}

async function importKeySet(jwks: AccessJwk[]): Promise<Map<string, CryptoKey>> {
  const keys = new Map<string, CryptoKey>();
  for (const jwk of jwks) {
    if (!jwk.kid) continue;
    const key = await importRsaKey(jwk);
    if (key) keys.set(jwk.kid, key);
  }
  return keys;
}

async function fetchKeySet(certsUrl: string): Promise<KeyCacheEntry> {
  const response = await fetch(certsUrl, {
    headers: { accept: "application/json" },
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`certs-${response.status}`);
  }
  const body = (await response.json()) as { keys?: AccessJwk[] };
  const keys = await importKeySet(Array.isArray(body.keys) ? body.keys : []);
  return {
    keys,
    expiresAt: Date.now() + ttlFromCacheControl(response.headers.get("cache-control")),
  };
}

async function cachedKeys(certsUrl: string, force: boolean): Promise<Map<string, CryptoKey>> {
  const cached = keyCache.get(certsUrl);
  if (!force && cached && cached.expiresAt > Date.now()) {
    return cached.keys;
  }
  const fresh = await fetchKeySet(certsUrl);
  keyCache.set(certsUrl, fresh);
  return fresh.keys;
}

async function keyForKid(
  kid: string,
  options: VerifyAccessOptions,
): Promise<CryptoKey | null> {
  if (options.loadKeys) {
    const keys = await importKeySet(await options.loadKeys());
    return keys.get(kid) ?? null;
  }
  let keys = await cachedKeys(options.certsUrl, false);
  if (!keys.has(kid)) {
    keys = await cachedKeys(options.certsUrl, true);
  }
  return keys.get(kid) ?? null;
}

export async function verifyAccessJwt(
  token: string,
  options: VerifyAccessOptions,
): Promise<VerifyResult> {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return fail("malformed");

    const [encodedHeader, encodedPayload, encodedSignature] = parts;
    const header = decodeJson<{ alg?: unknown; kid?: unknown }>(encodedHeader);
    if (header.alg !== "RS256") return fail("alg");
    if (typeof header.kid !== "string" || header.kid.length === 0) return fail("kid");

    const key = await keyForKid(header.kid, options);
    if (!key) return fail("kid");

    const signature = base64UrlToBytes(encodedSignature);
    const signed = new TextEncoder().encode(`${encodedHeader}.${encodedPayload}`);
    const valid = await crypto.subtle.verify(
      "RSASSA-PKCS1-v1_5",
      key,
      bufferOf(signature),
      bufferOf(signed),
    );
    if (!valid) return fail("signature");

    const payload = decodeJson<AccessJwtPayload>(encodedPayload);
    if (payload.iss !== options.issuer) return fail("issuer");
    if (!audienceMatches(payload.aud, options.audience)) return fail("audience");

    const now = Math.floor((options.now ?? Date.now)() / 1000);
    const skew = options.skewSeconds ?? SKEW_SECONDS;
    if (typeof payload.exp !== "number" || !Number.isFinite(payload.exp)) return fail("expiry");
    if (payload.exp + skew < now) return fail("expired");
    if (typeof payload.nbf === "number" && payload.nbf - skew > now) return fail("nbf");

    return { ok: true, payload };
  } catch (err) {
    console.error("Access JWT verification failed", err);
    return fail("malformed");
  }
}

function accessFailure(status: 401 | 403, error: string): Response {
  return Response.json(
    { error },
    {
      status,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "private, no-store",
        "X-Robots-Tag": "noindex",
      },
    },
  );
}

export type AccessIdentity =
  | { ok: true; email: string | null; payload: AccessJwtPayload | null }
  | { ok: false; response: Response };

function localhostDevEmail(request: Request, env: AccessEnv): string | null {
  if (env.ACCESS_DEV_BYPASS !== "1") return null;
  let host = "";
  try {
    host = new URL(request.url).hostname;
  } catch {
    return null;
  }
  if (host !== "localhost" && host !== "127.0.0.1" && host !== "::1") return null;
  const configured = env.ACCESS_DEV_EMAIL?.trim();
  if (configured && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(configured)) return configured;
  return "board@example.test";
}

function emailFromPayload(payload: AccessJwtPayload): string | null {
  const value = payload.email;
  if (typeof value !== "string") return null;
  const email = value.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return email;
}

/** Verifies the Access JWT and returns the email claim when the token has one. */
export async function authenticateAccess(
  request: Request,
  env: AccessEnv = {},
): Promise<AccessIdentity> {
  const devEmail = localhostDevEmail(request, env);
  if (devEmail) return { ok: true, email: devEmail, payload: null };

  const token = request.headers.get("Cf-Access-Jwt-Assertion");
  if (!token || !token.trim()) {
    return { ok: false, response: accessFailure(401, "Missing Cloudflare Access token") };
  }
  const domain = teamDomainFromEnv(env.ACCESS_TEAM_DOMAIN);
  const result = await verifyAccessJwt(token.trim(), {
    audience: audienceFromEnv(env.ACCESS_AUD),
    issuer: issuerForTeam(domain),
    certsUrl: certsUrlForTeam(domain),
  });
  if (!result.ok) {
    console.error("Cloudflare Access JWT rejected:", result.reason);
    return { ok: false, response: accessFailure(403, "Invalid Cloudflare Access token") };
  }
  return { ok: true, email: emailFromPayload(result.payload), payload: result.payload };
}

/** Returns a 401/403 response when the Access JWT is missing or invalid, otherwise null. */
export async function requireAccess(
  request: Request,
  env: AccessEnv = {},
): Promise<Response | null> {
  const result = await authenticateAccess(request, env);
  return result.ok ? null : result.response;
}

export { bytesToBase64Url };
