import Link from "next/link";

interface Document {
  title: string;
  category: string;
  path: string;
  description?: string;
}

const CATEGORIES: Record<string, { label: string; color: string }> = {
  "Foundational Documents": {
    label: "Foundational Documents",
    color: "bg-orange-100 text-orange-800",
  },
  "Amendments & Rights": {
    label: "Amendments & Rights",
    color: "bg-emerald-100 text-emerald-800",
  },
  "Community Rules": {
    label: "Community Rules",
    color: "bg-sky-100 text-sky-800",
  },
  "Forms & Applications": {
    label: "Forms & Applications",
    color: "bg-violet-100 text-violet-800",
  },
};

const DOCUMENTS: Document[] = [
  // Foundational Documents
  {
    title: "Articles of Incorporation",
    category: "Foundational Documents",
    path: "/docs/Articles_of_Incorporation.pdf",
    description: "The legal charter establishing Palma Vista HOA as a Florida non-profit corporation.",
  },
  {
    title: "Master Declaration",
    category: "Foundational Documents",
    path: "/docs/Master_Declaration.pdf",
    description: "The primary governing document setting the rights and obligations of all homeowners.",
  },
  {
    title: "Bylaws",
    category: "Foundational Documents",
    path: "/docs/Bylaws.pdf",
    description: "Internal rules governing Board elections, meetings, and HOA operations.",
  },
  // Amendments & Rights
  {
    title: "5th Amendment",
    category: "Amendments & Rights",
    path: "/docs/5th_Amendment.pdf",
    description: "The fifth amendment to the Master Declaration.",
  },
  {
    title: "Assignment of Declarant's Rights",
    category: "Amendments & Rights",
    path: "/docs/Assignment_of_Declarants_Rights.pdf",
    description: "Document transferring declarant rights to the homeowners association.",
  },
  {
    title: "Easement Agreement",
    category: "Amendments & Rights",
    path: "/docs/Easement.pdf",
    description: "Recorded easements affecting common areas and property boundaries.",
  },
  // Community Rules
  {
    title: "MetroWest Rules & Regulations",
    category: "Community Rules",
    path: "/docs/121021Rules_and_Regulations.pdf",
    description: "The current community rules governing use of property, common areas, and resident conduct.",
  },
  // Forms & Applications
  {
    title: "Architectural Review Board (ARB) Application",
    category: "Forms & Applications",
    path: "https://na3.docusign.net/Member/PowerFormSigning.aspx?PowerFormId=5b5c6e21-7434-4d1f-b2bf-6ad2be0f6548&env=na3&acct=fe250a78-3b52-4c5b-8bbe-a9c89bd48aef&v=2",
    description: "Online DocuSign form to request approval for exterior home modifications or improvements.",
  },
];

function LinkIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      className="h-10 w-10 text-violet-500 flex-shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
    </svg>
  );
}

function PdfIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      className="h-10 w-10 text-red-500 flex-shrink-0"
      fill="currentColor"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M5.625 1.5H9a3.75 3.75 0 013.75 3.75v1.875c0 1.036.84 1.875 1.875 1.875H16.5a3.75 3.75 0 013.75 3.75v7.875c0 1.035-.84 1.875-1.875 1.875H5.625a1.875 1.875 0 01-1.875-1.875V3.375c0-1.036.84-1.875 1.875-1.875zM9.75 17.25a.75.75 0 00-1.5 0V21a.75.75 0 001.5 0v-3.75zm3-3a.75.75 0 00-1.5 0V21a.75.75 0 001.5 0v-6.75zm3 1.5a.75.75 0 00-1.5 0V21a.75.75 0 001.5 0V15.75z"
        clipRule="evenodd"
      />
      <path d="M14.25 5.25a5.23 5.23 0 00-1.279-3.434 9.768 9.768 0 016.963 6.963A5.23 5.23 0 0016.5 7.5h-1.875a.375.375 0 01-.375-.375V5.25z" />
    </svg>
  );
}

function DocumentCard({ doc }: { doc: Document }) {
  const categoryStyle = CATEGORIES[doc.category]?.color ?? "bg-slate-100 text-slate-700";

  return (
    <a
      href={doc.path}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex flex-col gap-4 rounded-2xl border border-slate-100 bg-white p-6
                 shadow-sm transition-all duration-200
                 hover:shadow-lg hover:shadow-slate-200/80 hover:-translate-y-1 hover:border-orange-200
                 focus:outline-none focus:ring-2 focus:ring-orange-400"
      aria-label={`Open ${doc.title}`}
    >
      <div className="flex items-start gap-4">
        {doc.path.endsWith('.pdf') ? <PdfIcon /> : <LinkIcon />}
        <div className="flex-1 min-w-0">
          <span
            className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${categoryStyle}`}
          >
            {doc.category}
          </span>
          <h3 className="mt-2 text-base font-semibold text-slate-800 group-hover:text-orange-700 transition-colors leading-snug">
            {doc.title}
          </h3>
          {doc.description && (
            <p className="mt-1 text-sm text-slate-500 leading-relaxed line-clamp-2">
              {doc.description}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1 text-xs font-medium text-orange-600 group-hover:gap-2 transition-all">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-3.5 w-3.5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
          />
        </svg>
        Open Document
      </div>
    </a>
  );
}

export default function DocumentGrid() {
  const categories = Object.keys(CATEGORIES);

  return (
    <section className="bg-slate-50 py-20 px-6">
      <div className="mx-auto max-w-6xl">
        {/* Section header */}
        <div className="mb-14 text-center">
          <span className="inline-block rounded-full bg-orange-100 px-4 py-1.5 text-sm font-semibold uppercase tracking-widest text-orange-700">
            Community Documents
          </span>
          <h2 className="mt-4 font-serif text-4xl font-light text-slate-800">
            Governing Documents &amp; Policies
          </h2>
          <p className="mt-3 text-slate-500 max-w-xl mx-auto">
            Access all official HOA documents below. Click any card to open
            the PDF in a new tab.
          </p>
        </div>

        {/* Documents grouped by category */}
        <div className="space-y-12">
          {categories.map((cat) => {
            const catDocs = DOCUMENTS.filter((d) => d.category === cat);
            if (!catDocs.length) return null;
            return (
              <div key={cat}>
                <h3 className="mb-5 flex items-center gap-3 text-lg font-semibold text-slate-700">
                  <span
                    className={`h-px flex-1 bg-slate-200`}
                  />
                  {CATEGORIES[cat].label}
                  <span className="h-px flex-1 bg-slate-200" />
                </h3>
                <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
                  {catDocs.map((doc) => (
                    <DocumentCard key={doc.path} doc={doc} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
