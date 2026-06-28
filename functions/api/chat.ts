// Cloudflare Pages Function — handles POST /api/chat
// Runs as a Cloudflare Worker (edge function) keeping your API key secret

import RULES_TEXT from "../../data/rules-text.js";

interface Env {
  OPENAI_API_KEY: string;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

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

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  // CORS headers
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  try {
    const body = await request.json() as { messages: ChatMessage[] };
    const { messages } = body;

    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: "Invalid request" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Limit conversation history to last 10 messages to control cost
    const recentMessages = messages.slice(-10);

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

    const data = await openaiResponse.json() as {
      choices: Array<{ message: { content: string } }>;
    };

    const reply = data.choices?.[0]?.message?.content ?? "I couldn't generate a response. Please try again.";

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

// Handle OPTIONS preflight
export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
};
