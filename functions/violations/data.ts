// GET /violations/data — board-only violations JSON.
// The route stays under /violations so Cloudflare Access covers it.
// Do not add functions/violations.ts or functions/violations/index.ts:
// either file would take /violations away from the static map page.
// Static /violations is served from the Next.js export (out/violations.html).

import { requireAccess, type AccessEnv } from "../../lib/access/verify-access";
import { VIOLATIONS_KEY, violationsDataResponse } from "../../lib/violations/respond";

interface Env extends AccessEnv {
  VIOLATIONS_KV?: KVNamespace;
  ASSETS?: { fetch: typeof fetch };
}

function localDev(request: Request, env: AccessEnv): boolean {
  if (env.ACCESS_DEV_BYPASS !== "1") return false;
  try {
    const host = new URL(request.url).hostname;
    return host === "localhost" || host === "127.0.0.1" || host === "::1";
  } catch {
    return false;
  }
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const denied = await requireAccess(context.request, context.env);
  if (denied) return denied;

  const kv = context.env.VIOLATIONS_KV;
  if (!kv) return violationsDataResponse({ bindingPresent: false });

  try {
    let raw = await kv.get(VIOLATIONS_KEY, "text");
    if ((!raw || !raw.trim()) && localDev(context.request, context.env) && context.env.ASSETS) {
      const asset = await context.env.ASSETS.fetch(new URL("/dev-fixtures/violations.sample.json", context.request.url));
      if (asset.ok) raw = await asset.text();
    }
    return violationsDataResponse({ bindingPresent: true, raw });
  } catch (err) {
    console.error("VIOLATIONS_KV read failed", err);
    return violationsDataResponse({ bindingPresent: true, readError: true });
  }
};
