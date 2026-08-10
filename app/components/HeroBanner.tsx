"use client";
import Image from "next/image";

function openChatBot() {
  const btn = document.getElementById("hoa-chat-trigger") as HTMLButtonElement | null;
  if (btn) btn.click();
}

export default function HeroBanner() {
  return (
    <>
      {/* Fixed Background Layer */}
      <div className="fixed inset-0 w-full h-full -z-10">
        <Image
          src="/hero-bg.jpg"
          alt="Palma Vista Mediterranean community home"
          fill
          priority
          className="object-cover object-center"
          sizes="100vw"
        />
        {/* Warm dark gradient overlay — preserves the terracotta warmth */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/35 to-black/65" />
      </div>

      {/* Hero Content Layer */}
      <section className="relative h-screen w-full flex flex-col items-center justify-center px-6 text-center">
        {/* Official logo */}
        <div className="mb-6 drop-shadow-2xl">
          <Image
            src="/logo.jpg"
            alt="Palma Vista HOA Logo"
            width={180}
            height={180}
            className="rounded-2xl"
            priority
          />
        </div>

        {/* Welcome text */}
        <h1 className="font-serif text-5xl font-light tracking-wide text-white drop-shadow-lg md:text-7xl">
          Welcome to
        </h1>
        <p className="mt-2 font-serif text-6xl font-semibold tracking-tight text-amber-200 drop-shadow-xl md:text-8xl">
          Palma Vista
        </p>
        <p className="mt-6 max-w-xl text-lg font-light text-white/80 tracking-widest uppercase">
          A MetroWest Community
        </p>

        {/* AI Assistant CTA */}
        <button
          onClick={openChatBot}
          className="mt-10 flex items-center gap-2.5 rounded-full border border-white/30 bg-white/10 px-6 py-3 text-sm font-medium text-white backdrop-blur-sm transition-all duration-300 hover:bg-white/20 hover:border-white/60 hover:scale-105 hover:shadow-lg hover:shadow-emerald-900/30 focus:outline-none focus:ring-2 focus:ring-white/50"
          aria-label="Open HOA AI Assistant"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4 flex-shrink-0" fill="currentColor" aria-hidden="true">
            <path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7H3a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2M7.5 13A2.5 2.5 0 0 0 5 15.5 2.5 2.5 0 0 0 7.5 18a2.5 2.5 0 0 0 2.5-2.5A2.5 2.5 0 0 0 7.5 13m9 0A2.5 2.5 0 0 0 14 15.5a2.5 2.5 0 0 0 2.5 2.5 2.5 2.5 0 0 0 2.5-2.5A2.5 2.5 0 0 0 16.5 13M7 20h10v1a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1v-1z" />
          </svg>
          Chat with our AI Assistant →
        </button>

        {/* Scroll cue */}
        <div className="absolute bottom-10 flex flex-col items-center gap-2 text-white/60 animate-bounce">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-6 w-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M19 9l-7 7-7-7"
            />
          </svg>
          <span className="text-xs tracking-widest uppercase">Scroll</span>
        </div>
      </section>
    </>
  );
}
