"use client";
import { useEffect, useState } from "react";

interface FAQItem {
  id: string;
  question: string;
  answer: string;
}

export default function FAQSection() {
  const [items, setItems] = useState<FAQItem[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/content?key=faq")
      .then((r) => r.json())
      .then((data: FAQItem[]) => {
        if (Array.isArray(data)) setItems(data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading || items.length === 0) return null;

  return (
    <section id="faq" className="bg-white py-16 px-6">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-3 mb-10">
          <div className="h-px flex-1 bg-stone-200" />
          <h2 className="text-center text-2xl font-serif font-semibold text-stone-800 tracking-wide whitespace-nowrap">
            Frequently Asked Questions
          </h2>
          <div className="h-px flex-1 bg-stone-200" />
        </div>

        <div className="flex flex-col divide-y divide-stone-100 border border-stone-100 rounded-2xl overflow-hidden shadow-sm">
          {items.map((item, idx) => (
            <div key={item.id}>
              <button
                className="w-full flex items-center justify-between gap-4 px-6 py-5 text-left hover:bg-stone-50 transition-colors"
                onClick={() => setOpen(open === item.id ? null : item.id)}
                aria-expanded={open === item.id}
              >
                <span className="font-semibold text-stone-800 text-sm md:text-base">
                  {item.question}
                </span>
                <span
                  className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold transition-all duration-200 ${
                    open === item.id
                      ? "bg-emerald-700 rotate-180"
                      : "bg-stone-300"
                  }`}
                >
                  ▼
                </span>
              </button>
              {open === item.id && (
                <div className="px-6 pb-5 text-sm text-stone-600 leading-relaxed whitespace-pre-wrap bg-emerald-50/40 border-t border-stone-100">
                  <div className="pt-4">{item.answer}</div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
