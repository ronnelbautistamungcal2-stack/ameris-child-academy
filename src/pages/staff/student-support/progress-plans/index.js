import StaffLayout from "@/components/staff/StaffLayout";
import { NAVY, StatusPill, formatDate } from "@/components/ipp/ippUi";
import Pager from "@/components/ui/Pager";
import { apiJson } from "@/lib/api";
import { IPP_FOCUS_AREAS, IPP_PLAN_TYPES, IPP_STATUSES } from "@/lib/ipp";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

// Individual Progress Plans list (client mockup 2026-10-02): filters, a
// current / all toggle, and a table whose names open the child's plan.

const ROLES = ["STUDENT_SUPPORT"];
const PAGE_SIZE = 10;
const control = "rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100";
const REVIEW_FILTERS = [
  { value: "", label: "All Dates" },
  { value: "overdue", label: "Overdue" },
  { value: "30", label: "Next 30 days" },
  { value: "90", label: "Next 90 days" },
];
const COLUMNS = [
  ["childName", "Student Name"],
  ["planType", "Plan Type"],
  ["focusArea", "Plan Focus Area"],
  ["startDate", "Plan Start Date"],
  ["nextReviewDate", "Next Review Date"],
  ["status", "Status"],
  ["goals", "Goals"],
  ["updatedAt", "Last Updated"],
];

function inReviewWindow(plan, filter) {
  if (!filter) return true;
  if (!plan.nextReviewDate) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = (new Date(plan.nextReviewDate) - today) / 86400000;
  if (filter === "overdue") return days < 0;
  return days >= 0 && days <= Number(filter);
}

export default function ProgressPlansPage() {
  const [view, setView] = useState("current");
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState({ status: "", planType: "", focusArea: "", review: "" });
  const [sort, setSort] = useState({ key: "childName", dir: 1 });
  const [page, setPage] = useState(1);

  useEffect(() => {
    setLoading(true);
    setError("");
    apiJson(`/api/v1/ipp?view=${view}`)
      .then((data) => setPlans(data.plans || []))
      .catch((e) => setError(e.message || "Could not load the plans"))
      .finally(() => setLoading(false));
  }, [view]);

  const visible = useMemo(() => {
    const list = plans.filter(
      (p) =>
        (!filters.status || p.status === filters.status) &&
        (!filters.planType || p.planType === filters.planType) &&
        (!filters.focusArea || p.focusArea === filters.focusArea) &&
        inReviewWindow(p, filters.review),
    );
    return list.sort((a, b) => {
      const x = a[sort.key] ?? "";
      const y = b[sort.key] ?? "";
      const cmp = typeof x === "number" ? x - y : String(x).localeCompare(String(y), undefined, { numeric: true });
      return cmp * sort.dir;
    });
  }, [plans, filters, sort]);

  const pages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const current = Math.min(page, pages);
  const shown = visible.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);
  const filtered = Object.values(filters).some(Boolean);
  const focusAreas = [...new Set([...IPP_FOCUS_AREAS, ...plans.map((p) => p.focusArea).filter(Boolean)])].sort();
  const setFilter = (key, value) => {
    setFilters({ ...filters, [key]: value });
    setPage(1);
  };

  const filterSelect = (key, label, all, options) => (
    <label className={`text-sm font-bold ${NAVY}`}>
      {label}
      <select value={filters[key]} onChange={(e) => setFilter(key, e.target.value)} className={`${control} mt-1 block w-48`}>
        <option value="">{all}</option>
        {options.map((o) => (typeof o === "string" ? { value: o, label: o } : o)).map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </label>
  );

  return (
    <StaffLayout title="Individual Progress Plans" roles={ROLES}>
      <div className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className={`text-3xl font-black ${NAVY}`}>Individual Progress Plans</h1>
            <p className={`text-base ${NAVY}`}>View and manage individualized progress plans.</p>
          </div>
          <Link href="/staff/student-support/progress-plans/new" className="rounded-lg bg-blue-600 px-5 py-3 text-sm font-bold text-white hover:bg-blue-700">
            + New Progress Plan
          </Link>
        </div>

        <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
          <label className={`text-sm font-bold ${NAVY}`}>
            View
            <select value={view} onChange={(e) => setView(e.target.value)} className={`${control} mt-1 block w-44`}>
              <option value="current">Current plans</option>
              <option value="all">All plans</option>
            </select>
          </label>
          {filterSelect("status", "Status", "All Statuses", IPP_STATUSES)}
          {filterSelect("planType", "Plan Type", "All Types", IPP_PLAN_TYPES)}
          {filterSelect("focusArea", "Plan Focus Area", "All Focus Areas", focusAreas)}
          <label className={`text-sm font-bold ${NAVY}`}>
            Next Review Date
            <select value={filters.review} onChange={(e) => setFilter("review", e.target.value)} className={`${control} mt-1 block w-48`}>
              {REVIEW_FILTERS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </label>
          <button
            type="button"
            disabled={!filtered}
            onClick={() => setFilters({ status: "", planType: "", focusArea: "", review: "" })}
            className="ml-auto rounded-lg border border-blue-600 px-5 py-2 text-sm font-semibold text-blue-700 disabled:opacity-40 dark:text-blue-300"
          >
            Clear Filters
          </button>
        </div>

        {error && <div role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

        <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead>
              <tr className={`bg-blue-50 font-bold dark:bg-gray-800 ${NAVY}`}>
                {COLUMNS.map(([key, label]) => (
                  <th key={key} className="px-3 py-2.5">
                    <button
                      type="button"
                      onClick={() => setSort((s) => ({ key, dir: s.key === key ? -s.dir : 1 }))}
                      className="inline-flex items-center gap-1"
                      aria-label={`Sort by ${label}`}
                    >
                      {label}
                      <span aria-hidden className="text-[10px] text-gray-400">{sort.key === key ? (sort.dir === 1 ? "▲" : "▼") : "↕"}</span>
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={8} className="px-3 py-6 text-center text-gray-500">Loading...</td>
                </tr>
              )}
              {!loading && !shown.length && (
                <tr>
                  <td colSpan={8} className="px-3 py-6 text-center text-gray-500">
                    {filtered ? "No plans match these filters." : view === "current" ? "No current progress plans." : "No progress plans yet."}
                  </td>
                </tr>
              )}
              {shown.map((p) => (
                <tr key={p.id} className="border-t border-gray-100 text-gray-700 dark:border-gray-800 dark:text-gray-300">
                  <td className="px-3 py-2.5">
                    <Link href={`/staff/student-support/progress-plans/${p.id}`} className="font-semibold text-blue-700 hover:underline dark:text-blue-300">
                      {p.childName}
                    </Link>
                  </td>
                  <td className="px-3 py-2.5">{p.planType || "—"}</td>
                  <td className="px-3 py-2.5">{p.focusArea || "—"}</td>
                  <td className="px-3 py-2.5">{formatDate(p.startDate)}</td>
                  <td className="px-3 py-2.5">{formatDate(p.nextReviewDate)}</td>
                  <td className="px-3 py-2.5"><StatusPill status={p.status} /></td>
                  <td className="px-3 py-2.5 text-center">{p.goals}</td>
                  <td className="px-3 py-2.5">
                    <div>{formatDate(p.updatedAt)}</div>
                    <div className="text-xs text-gray-500">by {p.updatedBy}</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className={`flex flex-wrap items-center justify-between gap-3 text-sm ${NAVY}`}>
          <span>
            Showing {visible.length ? (current - 1) * PAGE_SIZE + 1 : 0} to {Math.min(current * PAGE_SIZE, visible.length)} of {visible.length} plans
          </span>
          <Pager page={current} pages={pages} onPage={setPage} />
        </div>
      </div>
    </StaffLayout>
  );
}
