"use client";
import { useEffect, useState } from "react";

interface GalleryItem {
  id: string;
  url: string;
  caption?: string;
  date?: string;
}

export default function Gallery() {
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [lightbox, setLightbox] = useState<GalleryItem | null>(null);

  useEffect(() => {
    fetch("/api/content?key=gallery")
      .then((r) => r.json())
      .then((data: GalleryItem[]) => {
        if (Array.isArray(data)) setItems(data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightbox(null);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  if (loading || items.length === 0) return null;

  return (
    <>
      <section id="gallery" className="bg-stone-900 py-16 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center gap-3 mb-10">
            <div className="h-px flex-1 bg-stone-700" />
            <h2 className="text-center text-2xl font-serif font-semibold text-amber-200 tracking-wide whitespace-nowrap">
              Community Gallery
            </h2>
            <div className="h-px flex-1 bg-stone-700" />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {items.map((item) => (
              <button
                key={item.id}
                onClick={() => setLightbox(item)}
                className="group relative aspect-square overflow-hidden rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.url}
                  alt={item.caption ?? "Community photo"}
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors duration-200 flex items-end">
                  {item.caption && (
                    <p className="text-white text-xs font-medium px-3 py-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 line-clamp-2">
                      {item.caption}
                    </p>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
        >
          <div
            className="relative max-w-4xl w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setLightbox(null)}
              className="absolute -top-10 right-0 text-white/70 hover:text-white text-sm font-medium"
            >
              ✕ Close
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={lightbox.url}
              alt={lightbox.caption ?? ""}
              className="w-full max-h-[80vh] object-contain rounded-xl"
            />
            {lightbox.caption && (
              <p className="text-white/80 text-center text-sm mt-3 font-medium">
                {lightbox.caption}
              </p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
