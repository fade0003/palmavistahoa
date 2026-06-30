// Protected admin endpoint — GET/POST /api/admin/content
// Access controlled by Cloudflare Access policy on /api/admin/*

interface Env {
  HOA_CONTENT: KVNamespace;
}

const VALID_KEYS = ["announcements", "faq", "gallery", "contacts"];

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json",
};

export const onRequestOptions: PagesFunction = async () =>
  new Response(null, { status: 204, headers: corsHeaders });

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const url = new URL(context.request.url);
  const key = url.searchParams.get("key");

  if (!key || !VALID_KEYS.includes(key)) {
    return new Response(JSON.stringify({ error: "Invalid key" }), {
      status: 400,
      headers: corsHeaders,
    });
  }

  const value = await context.env.HOA_CONTENT.get(key, "json");
  return new Response(JSON.stringify(value ?? null), { headers: corsHeaders });
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
  let body: { key: string; data: unknown };

  try {
    body = (await context.request.json()) as { key: string; data: unknown };
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: corsHeaders,
    });
  }

  if (!body.key || !VALID_KEYS.includes(body.key)) {
    return new Response(JSON.stringify({ error: "Invalid key" }), {
      status: 400,
      headers: corsHeaders,
    });
  }

  await context.env.HOA_CONTENT.put(body.key, JSON.stringify(body.data));
  return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
};
