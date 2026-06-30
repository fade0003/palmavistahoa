// Public read-only endpoint — GET /api/content?key=announcements|faq|gallery|contacts

interface Env {
  HOA_CONTENT: KVNamespace;
}

type ContentKey = "announcements" | "faq" | "gallery" | "contacts";

const DEFAULTS: Record<ContentKey, unknown> = {
  announcements: [],
  faq: [],
  gallery: [],
  contacts: {
    company: "Sentry Management",
    manager: "",
    phone: "",
    email: "",
    officeHours: "Monday–Friday, 9am–5pm",
    gateEmail: "",
    gateInstructions: "To request a gate access decal, please email the management office.",
  },
};

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const url = new URL(context.request.url);
  const key = url.searchParams.get("key") as ContentKey | null;

  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json",
  };

  if (!key || !Object.keys(DEFAULTS).includes(key)) {
    return new Response(JSON.stringify({ error: "Invalid key" }), {
      status: 400,
      headers: corsHeaders,
    });
  }

  const value = await context.env.HOA_CONTENT.get(key, "json");
  const data = value ?? DEFAULTS[key];

  return new Response(JSON.stringify(data), {
    headers: {
      ...corsHeaders,
      "Cache-Control": "public, max-age=30",
    },
  });
};
