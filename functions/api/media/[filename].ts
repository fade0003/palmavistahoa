// Public image serving from R2 — GET /api/media/[filename]

interface Env {
  HOA_MEDIA: R2Bucket;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const filename = context.params.filename as string;

  if (!filename || filename.includes("..")) {
    return new Response("Not found", { status: 404 });
  }

  const object = await context.env.HOA_MEDIA.get(filename);

  if (!object) {
    return new Response("Not found", { status: 404 });
  }

  return new Response(object.body, {
    headers: {
      "Content-Type": object.httpMetadata?.contentType ?? "application/octet-stream",
      "Cache-Control": "public, max-age=31536000, immutable",
      "ETag": object.etag,
    },
  });
};
