// Public endpoint — POST /api/feedback
// Allows anyone to submit feedback which is stored in KV for admins to view

interface Env {
  HOA_CONTENT: KVNamespace;
}

interface FeedbackEntry {
  id: string;
  name?: string;
  contact?: string;
  type: string;
  message: string;
  date: string;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json",
};

export const onRequestOptions: PagesFunction = async () =>
  new Response(null, { status: 204, headers: corsHeaders });

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const body = (await context.request.json()) as Partial<FeedbackEntry>;
    const { name, contact, type, message } = body;

    if (!message || !type) {
      return new Response(
        JSON.stringify({ error: "Feedback type and message are required" }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Read existing feedback list
    const existingRaw = await context.env.HOA_CONTENT.get("feedback", "json");
    const feedbackList = Array.isArray(existingRaw) ? existingRaw : [];

    // Create new entry
    const newEntry: FeedbackEntry = {
      id: crypto.randomUUID(),
      name: name?.trim() || "Anonymous",
      contact: contact?.trim() || undefined,
      type: type.trim(),
      message: message.trim(),
      date: new Date().toISOString(),
    };

    // Add to list and limit to last 200 items to manage storage
    feedbackList.unshift(newEntry);
    const trimmedList = feedbackList.slice(0, 200);

    // Save back to KV
    await context.env.HOA_CONTENT.put("feedback", JSON.stringify(trimmedList));

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: corsHeaders,
    });
  } catch (err) {
    console.error("Feedback submission error:", err);
    return new Response(
      JSON.stringify({ error: "Failed to submit feedback" }),
      { status: 500, headers: corsHeaders }
    );
  }
};
