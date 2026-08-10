"use client";

import { useState } from "react";

export default function FeedbackModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [type, setType] = useState("General Suggestion");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message) {
      setError("Please write a message before submitting.");
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, contact, type, message }),
      });

      if (!res.ok) {
        throw new Error("Failed to submit feedback");
      }

      setSubmitted(true);
      setName("");
      setContact("");
      setType("General Suggestion");
      setMessage("");
    } catch (err) {
      setError("Unable to submit at this time. Please try again later.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      {/* Floating Trigger Button (Bottom Left) */}
      <button
        onClick={() => {
          setIsOpen(true);
          setSubmitted(false);
          setError("");
        }}
        className="fixed bottom-6 left-6 z-40 flex items-center gap-2 rounded-full bg-emerald-800 hover:bg-emerald-700 text-amber-200 px-5 py-3.5 text-sm font-semibold shadow-xl border border-emerald-700/50 hover:scale-105 active:scale-95 transition-all duration-200"
        aria-label="Open suggestion box"
      >
        <span className="text-base">📝</span>
        <span className="hidden sm:inline">Suggestion Box</span>
      </button>

      {/* Modal Overlay */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div
            className="bg-white rounded-2xl w-full max-w-lg shadow-2xl border border-stone-100 overflow-hidden flex flex-col max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="bg-emerald-900 text-white px-6 py-5 flex items-center justify-between border-b border-emerald-950">
              <div>
                <h3 className="font-serif text-lg font-bold text-amber-200">
                  Palma Vista Suggestion Box
                </h3>
                <p className="text-xs text-emerald-200 mt-1">
                  Send private feedback directly to the Board
                </p>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="text-emerald-200 hover:text-white text-xl font-medium focus:outline-none"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto flex-1">
              {submitted ? (
                <div className="text-center py-8">
                  <div className="w-16 h-16 bg-emerald-100 text-emerald-800 rounded-full flex items-center justify-center text-3xl mx-auto mb-4 animate-bounce">
                    ✓
                  </div>
                  <h4 className="text-lg font-bold text-stone-800">
                    Thank You!
                  </h4>
                  <p className="text-sm text-stone-600 mt-2 max-w-sm mx-auto">
                    Your suggestion has been submitted successfully and is queued
                    for Board review. We appreciate your feedback.
                  </p>
                  <button
                    onClick={() => setIsOpen(false)}
                    className="mt-6 px-6 py-2.5 bg-emerald-800 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold transition-colors"
                  >
                    Close Window
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wider mb-1.5">
                      Feedback Type *
                    </label>
                    <select
                      value={type}
                      onChange={(e) => setType(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-stone-800 text-sm focus:outline-none focus:border-emerald-700 focus:ring-1 focus:ring-emerald-700"
                    >
                      <option>General Suggestion</option>
                      <option>Gate &amp; Access Suggestion</option>
                      <option>Landscaping &amp; Common Areas</option>
                      <option>Rules &amp; Regulations Feedback</option>
                      <option>Compliment / Appreciation</option>
                      <option>Other / Question</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wider mb-1.5">
                        Your Name (Optional)
                      </label>
                      <input
                        type="text"
                        placeholder="John Doe"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-stone-800 text-sm focus:outline-none focus:border-emerald-700 focus:ring-1 focus:ring-emerald-700"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wider mb-1.5">
                        Contact Email/Phone (Optional)
                      </label>
                      <input
                        type="text"
                        placeholder="john@example.com"
                        value={contact}
                        onChange={(e) => setContact(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-stone-800 text-sm focus:outline-none focus:border-emerald-700 focus:ring-1 focus:ring-emerald-700"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wider mb-1.5">
                      Your Message *
                    </label>
                    <textarea
                      rows={5}
                      placeholder="Type your feedback, comment, or suggestion here..."
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      maxLength={1000}
                      className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-stone-800 text-sm focus:outline-none focus:border-emerald-700 focus:ring-1 focus:ring-emerald-700 resize-none"
                    ></textarea>
                    <div className="text-right text-[10px] text-stone-400 mt-1">
                      {message.length}/1000 characters
                    </div>
                  </div>

                  {error && (
                    <div className="p-3 bg-red-50 text-red-700 border border-red-100 rounded-xl text-xs font-medium">
                      ⚠️ {error}
                    </div>
                  )}

                  <div className="flex justify-end gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setIsOpen(false)}
                      className="px-5 py-2.5 text-stone-500 hover:bg-stone-50 rounded-xl text-sm font-semibold transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="px-6 py-2.5 bg-emerald-800 hover:bg-emerald-700 disabled:bg-emerald-800/60 text-white rounded-xl text-sm font-semibold shadow-md transition-colors flex items-center gap-2"
                    >
                      {isSubmitting ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                          Submitting...
                        </>
                      ) : (
                        "Submit Suggestion"
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
