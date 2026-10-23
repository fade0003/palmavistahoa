// Protected image upload — POST /api/admin/upload
// Cloudflare Access covers /api/admin/*, and this function checks the Access JWT too.

import { requireAccess, type AccessEnv } from "../../../lib/access/verify-access";

interface Env extends AccessEnv {
  HOA_MEDIA: R2Bucket;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export const onRequestOptions: PagesFunction = async () =>
  new Response(null, { status: 204, headers: corsHeaders });

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const denied = await requireAccess(context.request, context.env);
  if (denied) return denied;

  let formData: FormData;
  try {
    formData = await context.request.formData();
  } catch {
    return new Response(JSON.stringify({ error: "Expected multipart form data" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const file = formData.get("file") as File | null;
  if (!file) {
    return new Response(JSON.stringify({ error: "No file provided" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Validate type
  const allowed = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"];
  if (!allowed.includes(file.type)) {
    return new Response(JSON.stringify({ error: "Only JPEG, PNG, WebP, and GIF images are allowed" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Sanitize filename
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const safeName = file.name
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-z0-9]/gi, "-")
    .toLowerCase()
    .slice(0, 40);
  const filename = `${Date.now()}-${safeName}.${ext}`;

  await context.env.HOA_MEDIA.put(filename, await file.arrayBuffer(), {
    httpMetadata: { contentType: file.type },
  });

  return new Response(
    JSON.stringify({ url: `/api/media/${filename}`, filename }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
};
