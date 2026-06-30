"use client";
import { useEffect, useState } from "react";

interface Announcement {
  id: string;
  title: string;
  body: string;
  date: string;
  pinned: boolean;
  imageUrl?: string | null;
}

function formatDate(d: string) {
  try {
    return new Date(d + "T00:00:00").toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return d;
  }
}

export default function Announcements() {
  const [items, setItems] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/content?key=announcements")
      .then((r) => r.json())
      .then((data: Announcement[]) => {
        if (Array.isArray(data) && data.length > 0) {
          const sorted = [...data].sort((a, b) => {
            if (a.pinned && !b.pinned) return -1;
            if (!a.pinned && b.pinned) return 1;
            return new Date(b.date).getTime() - new Date(a.date).getTime();
          });
          setItems(sorted);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading || items.length === 0) return null;

  return (
    <section id="announcements" className="relative bg-amber-50 py-16 px-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-3 mb-10">
          <div className="h-px flex-1 bg-amber-200" />
          <h2 className="text-center text-2xl font-serif font-semibold text-stone-800 tracking-wide whitespace-nowrap">
            Community Announcements
          </h2>
          <div className="h-px flex-1 bg-amber-200" />
        </div>

        <div className="flex flex-col gap-4">
          {items.map((ann) => (
            <div
              key={ann.id}
              className="bg-white rounded-2xl border border-amber-100 shadow-sm overflow-hidden"
            >
              {/* Image */}
              {ann.imageUrl && (
                <div className="w-full h-48 overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={ann.imageUrl}
                    alt={ann.title}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
              <div className="p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      {ann.pinned && (
                        <span className="inline-flex items-center gap-1 text-xs font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full uppercase tracking-wide">
                          📌 Pinned
                        </span>
                      )}
                      <span className="text-xs text-stone-400 font-medium">
                        {formatDate(ann.date)}
                      </span>
                    </div>
                    <h3 className="text-lg font-semibold text-stone-800">
                      {ann.title}
                    </h3>
                  </div>
                  {ann.body.length > 180 && (
                    <button
                      onClick={() =>
                        setExpanded(expanded === ann.id ? null : ann.id)
                      }
                      className="flex-shrink-0 text-sm font-medium text-emerald-700 hover:text-emerald-600 transition-colors"
                    >
                      {expanded === ann.id ? "Show less ▲" : "Read more ▼"}
                    </button>
                  )}
                </div>
                <p className="mt-3 text-stone-600 text-sm leading-relaxed whitespace-pre-wrap">
                  {expanded === ann.id || ann.body.length <= 180
                    ? ann.body
                    : ann.body.slice(0, 180) + "…"}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
