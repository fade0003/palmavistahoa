"use client";
import Image from "next/image";

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
