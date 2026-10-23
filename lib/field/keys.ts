// Stable id for a Sentry row. The weekly KV file is replaced, so dispositions
// match next week's row when the date, code, and description are unchanged.

export async function violationKey(parts: {
  date: string;
  code: string;
  description: string;
}): Promise<string> {
  const normalized = [
    parts.date.trim(),
    parts.code.trim(),
    parts.description.trim().replace(/\s+/g, " "),
  ].join("|");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(normalized));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
