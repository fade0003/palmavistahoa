export default function PaymentRibbon() {
  return (
    <section className="w-full bg-emerald-800 py-12 px-6">
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-4 text-center sm:flex-row sm:justify-between sm:text-left">
        {/* Text block */}
        <div>
          <h2 className="text-2xl font-semibold text-white tracking-tight">
            Homeowner Dues &amp; Account Management
          </h2>
          <p className="mt-1 text-emerald-200 text-sm">
            Pay your HOA dues, submit service requests, and manage your
            account through our management partner.
          </p>
        </div>

        {/* CTA Button */}
        <a
          id="sentry-payment-link"
          href="https://sentrymgt.com"
          target="_blank"
          rel="noopener noreferrer"
          className="flex-shrink-0 rounded-lg bg-[#f5f2eb] px-8 py-4 text-base font-semibold text-[#1c2d27] shadow-lg
                     transition-all duration-200 hover:bg-[#eae5da] hover:shadow-stone-500/20 hover:shadow-xl
                     focus:outline-none focus:ring-2 focus:ring-[#f5f2eb] focus:ring-offset-2 focus:ring-offset-emerald-800"
        >
          Pay Dues &amp; Manage Account
          <span className="ml-2 text-emerald-800">via Sentry Management →</span>
        </a>
      </div>
    </section>
  );
}
