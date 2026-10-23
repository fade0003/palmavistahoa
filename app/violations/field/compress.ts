const MAX_EDGE = 1600;
const QUALITY = 0.8;
const MAX_BYTES = 5 * 1024 * 1024;

export async function compressPhoto(file: File): Promise<Blob> {
  if (!file.type.startsWith("image/") && !/\.(jpe?g|png|webp|heic|heif)$/i.test(file.name)) {
    throw new Error("Choose an image.");
  }
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Could not prepare the photo.");
    context.drawImage(bitmap, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", QUALITY));
    if (!blob) throw new Error("Could not compress the photo.");
    if (blob.size > MAX_BYTES) throw new Error("Photo is still over 5 MB after compression.");
    return blob;
  } finally {
    bitmap.close();
  }
}

export function capturePosition(
  existing: { lat: number; lon: number } | null,
): Promise<{ lat: number; lon: number } | null> {
  if (existing) return Promise.resolve({ lat: existing.lat, lon: existing.lon });
  if (typeof navigator === "undefined" || !navigator.geolocation) return Promise.resolve(null);
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({ lat: position.coords.latitude, lon: position.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: true, maximumAge: 10_000, timeout: 4_000 },
    );
  });
}
