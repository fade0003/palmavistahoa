"use client";

import Link from "next/link";
import { formatDate, formatMoney } from "./geo";
import type { Home, HomeFilter, ViolationsData } from "./types";

export type ChromePanel = "search" | "filters" | "summary" | null;

const FILTERS: { id: HomeFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "red", label: "Open 90+" },
  { id: "orange", label: "Open <90" },
  { id: "owes", label: "Owes money" },
];

function IconSearch() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" width="22" height="22">
      <circle cx="11" cy="11" r="6" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M16 16l5 5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function IconFilter() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" width="22" height="22">
      <path d="M4 6h16M7 12h10M10 18h4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function IconInfo() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" width="22" height="22">
      <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M12 11v5M12 8h.01" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function TopChrome({
  panel,
  setPanel,
  query,
  setQuery,
  results,
  onSelect,
  filter,
  setFilter,
  counts,
  data,
  pendingCount,
  onExportDrive,
  onExportWeek,
  onExportAll,
  searchId,
  listId,
}: {
  panel: ChromePanel;
  setPanel: (panel: ChromePanel) => void;
  query: string;
  setQuery: (value: string) => void;
  results: Home[];
  onSelect: (id: string) => void;
  filter: HomeFilter;
  setFilter: (filter: HomeFilter) => void;
  counts: Record<HomeFilter, number>;
  data: ViolationsData | null;
  pendingCount: number;
  onExportDrive: () => void;
  onExportWeek: () => void;
  onExportAll: () => void;
  searchId: string;
  listId: string;
}) {
  function toggle(next: Exclude<ChromePanel, null>) {
    setPanel(panel === next ? null : next);
  }

  return (
    <>
      <div className="top-bar">
        <button type="button" className="icon-fab" aria-expanded={panel === "search"} aria-label="Search addresses" onClick={() => toggle("search")}>
          <IconSearch />
        </button>
        <button type="button" className="icon-fab" aria-expanded={panel === "filters"} aria-label="Filters" onClick={() => toggle("filters")}>
          <IconFilter />
          {filter !== "all" && <span className="fab-badge">{counts[filter]}</span>}
        </button>
        <button type="button" className="icon-fab" aria-expanded={panel === "summary"} aria-label="Summary" onClick={() => toggle("summary")}>
          <IconInfo />
        </button>
        {pendingCount > 0 && <span className="pending-pill">{pendingCount} pending</span>}
        <Link className="portal-link bar-link" href="/">
          Portal
        </Link>
      </div>

      {panel && (
        <button type="button" className="chrome-backdrop" aria-label="Close panel" onClick={() => setPanel(null)} />
      )}

      {panel === "search" && (
        <section className="chrome-sheet" aria-label="Search">
          <div className="sheet-title">
            <h2>Search</h2>
            <button type="button" className="close-button" aria-label="Close search" onClick={() => setPanel(null)}>
              ×
            </button>
          </div>
          <input
            id={searchId}
            type="search"
            placeholder="Search address"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            enterKeyHint="search"
            value={query}
            role="combobox"
            aria-expanded={query.trim().length > 0}
            aria-controls={listId}
            aria-autocomplete="list"
            onChange={(event) => setQuery(event.target.value)}
          />
          <ul className="results" id={listId} role="listbox">
            {query.trim() && results.length === 0 && <li className="empty">No matching address</li>}
            {results.map((home) => (
              <li key={home.id}>
                <button type="button" role="option" aria-selected={false} onClick={() => onSelect(home.id)}>
                  {home.address}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {panel === "filters" && (
        <section className="chrome-sheet" aria-label="Filters">
          <div className="sheet-title">
            <h2>Filters</h2>
            <button type="button" className="close-button" aria-label="Close filters" onClick={() => setPanel(null)}>
              ×
            </button>
          </div>
          <div className="chip-row" role="toolbar" aria-label="Filter homes">
            {FILTERS.map((item) => (
              <button
                key={item.id}
                type="button"
                className="chip"
                aria-pressed={filter === item.id}
                onClick={() => {
                  setFilter(item.id);
                  setPanel(null);
                }}
              >
                {item.label}
                <span className="count">{counts[item.id]}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {panel === "summary" && data && (
        <section className="chrome-sheet summary-card" aria-label="Violations summary">
          <div className="sheet-title">
            <h2>Updated {formatDate(data.updated)}</h2>
            <button type="button" className="close-button" aria-label="Close summary" onClick={() => setPanel(null)}>
              ×
            </button>
          </div>
          <div className="stats">
            <div className="stat">
              <b>{data.summary.openItems}</b>
              <span>Open items</span>
            </div>
            <div className="stat">
              <b>{data.summary.homesWithOpen}</b>
              <span>Homes with open items</span>
            </div>
            <div className="stat">
              <b>{formatMoney(data.summary.arrearsTotal)}</b>
              <span>Arrears</span>
            </div>
            <div className="stat">
              <b>{formatMoney(data.summary.pastDue)}</b>
              <span>Past due</span>
            </div>
            <div className="stat">
              <b>{data.summary.inCollection}</b>
              <span>In collection</span>
            </div>
          </div>
          <div className="aging" aria-label="Open items by age">
            {(Object.keys(data.summary.aging) as (keyof ViolationsData["summary"]["aging"])[]).map((key) => (
              <span key={key}>
                {key}: {data.summary.aging[key]}
              </span>
            ))}
          </div>
          <div className="legend">
            <span><i className="dot dot-red" /> Open 90+</span>
            <span><i className="dot dot-orange" /> Open under 90</span>
            <span><i className="dot dot-gray" /> None</span>
            <span><i className="dot dot-green" /> Field resolved</span>
          </div>
          <p className="sources">Plain-text letter to Sentry Management.</p>
          <div className="export-row">
            <button type="button" className="tool-button" onClick={onExportDrive}>Email this drive</button>
            <button type="button" className="tool-button" onClick={onExportWeek}>Email last 7 days</button>
            <button type="button" className="tool-button" onClick={onExportAll}>Email all notes</button>
          </div>
          {data.sources && (
            <p className="sources">
              {data.sources.violations}
              {data.sources.arrears ? ` · ${data.sources.arrears}` : ""}
            </p>
          )}
        </section>
      )}
    </>
  );
}
