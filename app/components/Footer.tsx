export default function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="w-full bg-slate-900 px-6 py-10 text-center text-sm text-slate-400">
      <p className="font-serif text-lg text-slate-200 tracking-wide">Palma Vista Homeowners Association</p>
      <p className="mt-1 text-slate-500">A MetroWest Community · Orlando, Florida</p>
      <div className="mt-4 flex justify-center gap-6">
        <a
          href="https://sentrymgt.com"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-orange-400 transition-colors"
        >
          Sentry Management
        </a>
      </div>
      <p className="mt-6 text-xs text-slate-600">
        © {year} Palma Vista HOA. All rights reserved.
      </p>
    </footer>
  );
}
