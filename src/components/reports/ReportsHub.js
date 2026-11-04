import { DEFAULT_REPORT_FILTERS, ReportFiltersContext } from "@/components/reports/ReportFilters";
import { apiJson } from "@/lib/api";
import { exportElementTables } from "@/lib/exportTable";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useMemo, useRef, useState } from "react";

// Reports page for admins and coaches (client mockup 15-01): report
// categories down the left, the chosen report on the right, and a Select
// Filter for all / currently enrolled children and all / currently employed
// staff that every report follows.

const NAVY = "text-[#0b2a5b] dark:text-blue-100";
const FILTERS_KEY = "aca:reportFilters";

function readSavedFilters() {
  try {
    const saved = JSON.parse(window.localStorage.getItem(FILTERS_KEY) || "null");
    if (saved && ["ALL", "ENROLLED"].includes(saved.children) && ["ALL", "EMPLOYED"].includes(saved.staff)) return saved;
  } catch {
    // storage unavailable: use the defaults
  }
  return DEFAULT_REPORT_FILTERS;
}

/**
 * categories: [{ label, icon, reports: [{ key, label }] }]
 * selectedKey, hrefFor(key), children: the selected report.
 */
export default function ReportsHub({ categories, selectedKey, hrefFor, children }) {
  const [search, setSearch] = useState("");
  const [collapsed, setCollapsed] = useState({});
  const [filters, setFilters] = useState(DEFAULT_REPORT_FILTERS);
  const [filterOpen, setFilterOpen] = useState(false);
  const filterRef = useRef(null);
  const printRef = useRef(null);
  const router = useRouter();
  const [centers, setCenters] = useState([]);
  const [exportError, setExportError] = useState("");

  useEffect(() => setFilters(readSavedFilters()), []);

  // The center name heads the printed report.
  useEffect(() => {
    apiJson("/api/v1/centers")
      .then((rows) => setCenters(Array.isArray(rows) ? rows : []))
      .catch(() => setCenters([]));
  }, []);
  const centerName = useMemo(() => {
    if (centers.length === 1) return centers[0].name;
    const segment = String(router.pathname || "/").split("/").filter(Boolean)[0] || "global";
    let stored = "";
    try {
      stored = typeof window !== "undefined" ? window.localStorage.getItem(`aca:selectedCenter:${segment}`) || "" : "";
    } catch {
      stored = "";
    }
    return centers.find((c) => c.id === stored)?.name || centers[0]?.name || "";
  }, [centers, router.pathname]);

  function changeFilters(patch) {
    const next = { ...filters, ...patch };
    setFilters(next);
    try {
      window.localStorage.setItem(FILTERS_KEY, JSON.stringify(next));
    } catch {
      // not saved; the choice still applies on this page
    }
  }

  useEffect(() => {
    if (!filterOpen) return undefined;
    const close = (event) => {
      if (filterRef.current && !filterRef.current.contains(event.target)) setFilterOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [filterOpen]);

  const q = search.trim().toLowerCase();
  const shown = useMemo(
    () =>
      categories
        .map((cat) => ({ ...cat, reports: cat.reports.filter((r) => !q || r.label.toLowerCase().includes(q)) }))
        .filter((cat) => cat.reports.length),
    [categories, q],
  );
  const selected = categories.flatMap((c) => c.reports).find((r) => r.key === selectedKey);

  async function exportExcel() {
    setExportError("");
    try {
      const name = selected?.label || "Report";
      await exportElementTables(printRef.current, `${name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-${new Date().toISOString().slice(0, 10)}`, name);
    } catch (e) {
      setExportError(e.message || "Export failed");
    }
  }
  const activeFilters = (filters.children === "ALL" ? 1 : 0) + (filters.staff === "ALL" ? 1 : 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className={`text-3xl font-black ${NAVY}`}>Reports</h1>
        <div ref={filterRef} className="relative">
          <button
            type="button"
            onClick={() => setFilterOpen((o) => !o)}
            aria-expanded={filterOpen}
            className="inline-flex items-center gap-2 rounded-lg border border-blue-300 bg-white px-4 py-2 text-sm font-bold text-blue-700 hover:bg-blue-50 dark:bg-gray-900"
          >
            <span aria-hidden="true">⏷</span> Select Filter
            {activeFilters ? <span className="rounded-full bg-blue-600 px-1.5 text-xs text-white">{activeFilters}</span> : null}
          </button>
          {filterOpen ? (
            <div className="absolute right-0 z-30 mt-2 w-64 space-y-3 rounded-xl border border-gray-200 bg-white p-4 shadow-xl dark:border-gray-700 dark:bg-gray-900">
              <fieldset>
                <legend className={`text-xs font-black uppercase ${NAVY}`}>Children</legend>
                {[["ENROLLED", "Currently enrolled children"], ["ALL", "All children"]].map(([value, text]) => (
                  <label key={value} className="mt-1 flex items-center gap-2 text-sm">
                    <input type="radio" name="report-children" checked={filters.children === value} onChange={() => changeFilters({ children: value })} />
                    {text}
                  </label>
                ))}
              </fieldset>
              <fieldset>
                <legend className={`text-xs font-black uppercase ${NAVY}`}>Employees</legend>
                {[["EMPLOYED", "Currently employed staff"], ["ALL", "All staff"]].map(([value, text]) => (
                  <label key={value} className="mt-1 flex items-center gap-2 text-sm">
                    <input type="radio" name="report-staff" checked={filters.staff === value} onChange={() => changeFilters({ staff: value })} />
                    {text}
                  </label>
                ))}
              </fieldset>
            </div>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
        <nav aria-label="Report categories" className="no-print h-max rounded-xl border border-gray-200 bg-white p-3 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <div className={`px-1 pb-2 text-base font-black ${NAVY}`}>Report Categories</div>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search reports..."
            aria-label="Search reports"
            className="mb-2 w-full rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800"
          />
          {shown.map((cat) => {
            const isCollapsed = Boolean(collapsed[cat.label]) && !q;
            return (
              <div key={cat.label} className="mb-1">
                <button
                  type="button"
                  onClick={() => setCollapsed((c) => ({ ...c, [cat.label]: !c[cat.label] }))}
                  aria-expanded={!isCollapsed}
                  className="flex w-full items-center justify-between rounded-md bg-blue-50 px-2 py-1.5 text-left text-sm font-black text-[#0b2a5b] dark:bg-gray-800 dark:text-blue-100"
                >
                  <span>
                    <span aria-hidden="true" className="mr-1.5">{cat.icon}</span>
                    {cat.label}
                  </span>
                  <span aria-hidden="true">{isCollapsed ? "▸" : "▾"}</span>
                </button>
                {isCollapsed ? null : (
                  <ul className="mt-0.5">
                    {cat.reports.map((r) => (
                      <li key={r.key}>
                        <Link
                          href={hrefFor(r.key)}
                          aria-current={r.key === selectedKey ? "page" : undefined}
                          className={`flex items-center justify-between rounded-md px-2 py-1.5 text-sm ${
                            r.key === selectedKey ? "bg-blue-100 font-bold text-blue-800 dark:bg-gray-700 dark:text-blue-100" : "text-[#0b2a5b] hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800"
                          }`}
                        >
                          {r.label}
                          <span aria-hidden="true" className="text-gray-400">›</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
          {!shown.length ? <p className="px-2 py-4 text-sm text-gray-500">No reports match.</p> : null}
        </nav>

        <section aria-label={selected?.label || "Report"} className="min-w-0">
          {/* Every report can be printed on its own (with the center name on top)
              or exported to Excel; Print > Save as PDF gives the PDF
              (client requests 2026-10-29). */}
          {selected ? (
            <div className="no-print mb-3 flex flex-wrap items-center justify-end gap-2">
              {exportError ? <span role="alert" className="mr-auto text-sm text-red-700">{exportError}</span> : null}
              <button type="button" onClick={() => window.print()} className="rounded-lg border border-blue-300 bg-white px-4 py-2 text-sm font-bold text-blue-700 hover:bg-blue-50 dark:bg-gray-900">
                🖨 Print / PDF
              </button>
              <button type="button" onClick={exportExcel} className="rounded-lg border border-emerald-600 bg-white px-4 py-2 text-sm font-bold text-emerald-700 hover:bg-emerald-50 dark:bg-gray-900">
                ⬇ Export to Excel
              </button>
            </div>
          ) : null}
          <div id="reports-print-area" ref={printRef}>
            <div className="reports-print-head hidden text-center print:block">
              {centerName ? <div className="text-2xl font-black text-[#0b2a5b]" style={{ fontFamily: "Georgia, serif" }}>{centerName}</div> : null}
              {selected ? <div className="text-lg font-bold text-[#0b2a5b]">{selected.label}</div> : null}
            </div>
            <ReportFiltersContext.Provider value={filters}>
              {selected ? children : <p className="rounded-xl border border-gray-200 bg-white p-6 text-sm text-gray-600">Choose a report on the left.</p>}
            </ReportFiltersContext.Provider>
          </div>
          <style jsx global>{`
            @media print {
              @page {
                size: portrait;
                margin: 10mm;
              }
              body * {
                visibility: hidden;
              }
              #reports-print-area,
              #reports-print-area * {
                visibility: visible;
              }
              #reports-print-area {
                position: absolute;
                left: 0;
                top: 0;
                width: 100%;
              }
              #reports-print-area button,
              #reports-print-area select,
              #reports-print-area input[type="search"],
              #reports-print-area .no-print {
                display: none !important;
              }
              #reports-print-area:has(#report-print-sheet) .reports-print-head {
                display: none !important;
              }
              #reports-print-area .overflow-x-auto,
              #reports-print-area .overflow-auto {
                overflow: visible !important;
                max-height: none !important;
              }
            }
          `}</style>
        </section>
      </div>
    </div>
  );
}
