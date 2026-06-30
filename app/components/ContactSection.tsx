"use client";
import { useEffect, useState } from "react";

interface Contacts {
  company?: string;
  manager?: string;
  phone?: string;
  email?: string;
  officeHours?: string;
  gateEmail?: string;
  gateInstructions?: string;
}

export default function ContactSection() {
  const [contacts, setContacts] = useState<Contacts | null>(null);

  useEffect(() => {
    fetch("/api/content?key=contacts")
      .then((r) => r.json())
      .then((data: Contacts) => {
        if (data && typeof data === "object") setContacts(data);
      })
      .catch(() => {});
  }, []);

  const c: Contacts = contacts ?? {
    company: "Sentry Management",
    officeHours: "Monday–Friday, 9am–5pm",
    gateInstructions:
      "To request a gate access decal, please contact the management office.",
  };

  return (
    <section id="contact" className="bg-stone-800 py-16 px-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-3 mb-10">
          <div className="h-px flex-1 bg-stone-600" />
          <h2 className="text-center text-2xl font-serif font-semibold text-amber-200 tracking-wide whitespace-nowrap">
            Contact &amp; Access
          </h2>
          <div className="h-px flex-1 bg-stone-600" />
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Management */}
          <div className="bg-stone-700/50 rounded-2xl p-6 border border-stone-600">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-emerald-800 flex items-center justify-center text-emerald-300 text-lg">🏢</div>
              <div>
                <p className="text-xs text-stone-400 uppercase tracking-widest font-medium">Management</p>
                <p className="text-white font-semibold text-sm">{c.company ?? "Management Company"}</p>
              </div>
            </div>
            <div className="flex flex-col gap-3">
              {c.manager && (
                <div className="flex items-start gap-3 text-sm">
                  <span className="text-stone-400 w-5 mt-0.5">👤</span>
                  <span className="text-stone-200">{c.manager}</span>
                </div>
              )}
              {c.phone && (
                <div className="flex items-start gap-3 text-sm">
                  <span className="text-stone-400 w-5 mt-0.5">📞</span>
                  <a href={`tel:${c.phone.replace(/\D/g, "")}`} className="text-amber-300 hover:text-amber-200 transition-colors">{c.phone}</a>
                </div>
              )}
              {c.email && (
                <div className="flex items-start gap-3 text-sm">
                  <span className="text-stone-400 w-5 mt-0.5">✉️</span>
                  <a href={`mailto:${c.email}`} className="text-amber-300 hover:text-amber-200 transition-colors break-all">{c.email}</a>
                </div>
              )}
              {c.officeHours && (
                <div className="flex items-start gap-3 text-sm">
                  <span className="text-stone-400 w-5 mt-0.5">🕐</span>
                  <span className="text-stone-300">{c.officeHours}</span>
                </div>
              )}
            </div>
          </div>

          {/* Gate Access */}
          <div className="bg-stone-700/50 rounded-2xl p-6 border border-stone-600">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-amber-900 flex items-center justify-center text-amber-300 text-lg">🚗</div>
              <div>
                <p className="text-xs text-stone-400 uppercase tracking-widest font-medium">Gate Access</p>
                <p className="text-white font-semibold text-sm">Decal Requests</p>
              </div>
            </div>
            {c.gateInstructions && (
              <p className="text-stone-300 text-sm leading-relaxed mb-4 whitespace-pre-wrap">{c.gateInstructions}</p>
            )}
            {c.gateEmail && (
              <a href={`mailto:${c.gateEmail}`} className="inline-flex items-center gap-2 px-4 py-2.5 bg-amber-600 hover:bg-amber-500 text-white text-sm font-semibold rounded-xl transition-colors">
                ✉️ {c.gateEmail}
              </a>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
