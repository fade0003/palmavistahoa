// JSON responses for GET /violations/data. The Pages Function reads KV;
// this helper only shapes the HTTP response so it can be tested without Workers.

export const VIOLATIONS_KEY = "violations.json";

export const PRIVATE_JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "private, no-store",
  "X-Robots-Tag": "noindex",
} as const;

export function violationsDataResponse(input: {
  bindingPresent: boolean;
  raw?: string | null;
  readError?: boolean;
}): Response {
  if (!input.bindingPresent) {
    return Response.json(
      { error: "Violations store is not configured" },
      { status: 503, headers: PRIVATE_JSON_HEADERS },
    );
  }
  if (input.readError) {
    return Response.json(
      { error: "Could not read violations data" },
      { status: 503, headers: PRIVATE_JSON_HEADERS },
    );
  }
  if (input.raw == null || input.raw.trim() === "") {
    return Response.json(
      { error: "No violations data has been loaded" },
      { status: 404, headers: PRIVATE_JSON_HEADERS },
    );
  }
  try {
    JSON.parse(input.raw);
  } catch {
    return Response.json(
      { error: "Violations data is not valid JSON" },
      { status: 500, headers: PRIVATE_JSON_HEADERS },
    );
  }
  return new Response(input.raw, { status: 200, headers: PRIVATE_JSON_HEADERS });
}
