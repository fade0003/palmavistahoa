// Cloudflare Pages Function — handles POST /api/chat
// Runs as a Cloudflare Worker (edge function) keeping your API key secret

import { RULES_TEXT } from "./rules-data";

interface Env {
  OPENAI_API_KEY: string;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const ALLOWED_ORIGIN = "https://palmavistahoa.com";
const MAX_MESSAGES = 10;         // max messages accepted per request
const MAX_MESSAGE_LENGTH = 1000; // max chars per individual message
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX = 20;       // max requests per IP per window

// ─── In-memory rate limiter (resets on cold-start; good enough for edge) ─────
const ipRequestMap = new Map<string, { count: number; windowStart: number }>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = ipRequestMap.get(ip);

  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    // Start a new window
    ipRequestMap.set(ip, { count: 1, windowStart: now });
    return false;
  }

  if (entry.count >= RATE_LIMIT_MAX) {
    return true;
  }

  entry.count++;
  return false;
}

// ─── CORS helpers ─────────────────────────────────────────────────────────────
function getCorsHeaders(requestOrigin: string | null) {
  // Only echo the allowed origin back; reject anything else
  const origin =
    requestOrigin === ALLOWED_ORIGIN ? ALLOWED_ORIGIN : "null";
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin",
  };
}

// ─── System prompt ────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are the official AI assistant for the Palma Vista Homeowners Association (HOA) in Orlando, Florida.

Your job is to answer homeowner questions accurately based ONLY on the official Palma Vista Rules and Regulations document provided below. 

Guidelines:
- Be helpful, friendly, and professional
- Answer questions directly and clearly  
- Quote or cite specific rule sections when relevant
- If a question is not covered in the document, say so clearly and suggest they contact the HOA manager at Sentry Management
- Never make up rules that aren't in the document
- For architectural changes, always remind homeowners to submit an ARB application BEFORE starting work
- Keep answers concise — 2-4 sentences unless the rule requires more detail
- Use plain English, not legal jargon

PALMA VISTA RULES AND REGULATIONS DOCUMENT:
---
${RULES_TEXT}
---

Always end responses about potential violations with a reminder that homeowners should contact Sentry Management for official guidance.`;

// ─── Main handler ─────────────────────────────────────────────────────────────
export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const requestOrigin = request.headers.get("Origin");
  const corsHeaders = getCorsHeaders(requestOrigin);

  // ── Rate limiting ──────────────────────────────────────────────────────────
  const ip =
    request.headers.get("CF-Connecting-IP") ??
    request.headers.get("X-Forwarded-For") ??
    "unknown";

  if (isRateLimited(ip)) {
    return new Response(
      JSON.stringify({ error: "Too many requests. Please wait a moment and try again." }),
      { status: 429, headers: { "Content-Type": "application/json", "Retry-After": "60", ...corsHeaders } }
    );
  }

  try {
    // ── Parse & validate body ────────────────────────────────────────────────
    let body: { messages?: unknown };
    try {
      body = (await request.json()) as { messages?: unknown };
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON body." }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    if (!body.messages || !Array.isArray(body.messages)) {
      return new Response(JSON.stringify({ error: "Invalid request: messages must be an array." }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Validate each message: only allow role=user|assistant, cap content length
    const ALLOWED_ROLES = new Set(["user", "assistant"]);
    for (const msg of body.messages) {
      if (
        typeof msg !== "object" ||
        msg === null ||
        !ALLOWED_ROLES.has((msg as ChatMessage).role) ||
        typeof (msg as ChatMessage).content !== "string"
      ) {
        return new Response(
          JSON.stringify({ error: "Invalid message format." }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
      if ((msg as ChatMessage).content.length > MAX_MESSAGE_LENGTH) {
        return new Response(
          JSON.stringify({ error: "Message too long. Please keep questions under 1,000 characters." }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
    }

    const messages = body.messages as ChatMessage[];

    // Limit conversation history to last N messages to control cost
    const recentMessages = messages.slice(-MAX_MESSAGES);

    // ── Call OpenAI ──────────────────────────────────────────────────────────
    const openaiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          ...recentMessages,
        ],
        max_tokens: 600,
        temperature: 0.3, // Low temp for factual accuracy
        stream: false,
      }),
    });

    if (!openaiResponse.ok) {
      const errText = await openaiResponse.text();
      console.error("OpenAI error:", errText);
      return new Response(
        JSON.stringify({ error: "AI service temporarily unavailable. Please try again." }),
        { status: 502, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const data = (await openaiResponse.json()) as {
      choices: Array<{ message: { content: string } }>;
    };

    const reply =
      data.choices?.[0]?.message?.content ??
      "I couldn't generate a response. Please try again.";

    return new Response(JSON.stringify({ reply }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (err) {
    console.error("Chat function error:", err);
    return new Response(
      JSON.stringify({ error: "An error occurred. Please try again." }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

// ─── OPTIONS preflight ────────────────────────────────────────────────────────
export const onRequestOptions: PagesFunction = async (context) => {
  const requestOrigin = context.request.headers.get("Origin");
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(requestOrigin),
  });
};
