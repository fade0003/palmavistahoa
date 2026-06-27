export default function ContactSection() {
  return (
    <section className="bg-white py-20 px-6 border-t border-slate-100">
      <div className="mx-auto max-w-4xl text-center">
        {/* Section header */}
        <span className="inline-block rounded-full bg-orange-100 px-4 py-1.5 text-sm font-semibold uppercase tracking-widest text-orange-700">
          Contact Us
        </span>
        <h2 className="mt-4 font-serif text-3xl font-light text-slate-800 md:text-4xl">
          Get in Touch
        </h2>
        <p className="mt-3 text-slate-500 max-w-xl mx-auto">
          Need assistance or have questions? Reach out to our dedicated community manager.
        </p>
        
        {/* Contact Card */}
        <div className="mt-10 mx-auto max-w-lg bg-slate-50 rounded-2xl p-8 border border-slate-100 shadow-sm text-left hover:shadow-md transition-shadow">
          <div className="flex items-center gap-4 border-b border-slate-200 pb-5 mb-5">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <div>
              <h3 className="text-xl font-semibold text-slate-800 tracking-tight">ANTHONY LANGUZZI</h3>
              <p className="text-orange-700 font-medium text-sm mt-0.5 tracking-wide uppercase">Community Manager</p>
            </div>
          </div>
          
          <div className="space-y-4 text-slate-600">
            <div className="flex items-start gap-3">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-400 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <address className="not-italic leading-relaxed">
                2180 W SR 434 Ste 5000<br/>
                LONGWOOD FL 32779-5044
              </address>
            </div>
            
            <div className="flex items-center gap-3">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
              <a href="tel:4077886700" className="hover:text-orange-600 font-medium transition-colors">(407) 788-6700</a>
            </div>
            
            <div className="flex items-center gap-3">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              <a href="mailto:communitycare@sentrymgt.com" className="hover:text-orange-600 transition-colors text-orange-600 font-medium break-all">
                communitycare@sentrymgt.com
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
