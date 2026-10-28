import { CategoryPill, NAVY, StatusPill, card, control } from "@/components/training/trainingUi";
import Skeleton from "@/components/ui/Skeleton";
import { apiJson } from "@/lib/api";
import { PROGRESS_STATUSES, TRAINING_AGE_GROUPS, ageGroupsLabel } from "@/lib/training";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

// Professional Development tab (client mockup 01): the Staff Training
// Pathways that apply to the signed-in staff member, with their progress.
// Start / Continue / View open the pathway (pathwayHref).

export default function MyPathways({ centerId, pathwayHref }) {
  const [pathways, setPathways] = useState(null);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState({ search: "", category: "", ageGroup: "", status: "" });

  useEffect(() => {
    setPathways(null);
    setError("");
    apiJson(`/api/v1/training/pathways?centerId=${encodeURIComponent(centerId)}&mine=1`)
      .then((res) => setPathways(res.pathways || []))
      .catch((e) => setError(e.message || "Failed to load training pathways"));
  }, [centerId]);

  const categories = useMemo(() => [...new Set((pathways || []).map((p) => p.category).filter(Boolean))].sort(), [pathways]);
  const rows = (pathways || []).filter((p) => {
    const q = filters.search.trim().toLowerCase();
    if (q && !`${p.title} ${p.description}`.toLowerCase().includes(q)) return false;
    if (filters.category && p.category !== filters.category) return false;
    if (filters.ageGroup && p.ageGroups.length && !p.ageGroups.includes(filters.ageGroup)) return false;
    if (filters.status && p.myProgress.status !== filters.status) return false;
    return true;
  });
  const set = (patch) => setFilters((f) => ({ ...f, ...patch }));

  if (error) return <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>;
  if (!pathways) return <Skeleton count={5} />;

  return (
    <div className="space-y-4">
      <h2 className={`text-2xl font-black ${NAVY}`}>Staff Training Pathway</h2>
      <div className={`${card} grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr_auto] lg:items-end`}>
        <label className="text-sm font-bold">
          Search
          <input value={filters.search} onChange={(e) => set({ search: e.target.value })} placeholder="Search trainings..." className={control} />
        </label>
        <label className="text-sm font-bold">
          Category
          <select value={filters.category} onChange={(e) => set({ category: e.target.value })} className={control}>
            <option value="">All Categories</option>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        <label className="text-sm font-bold">
          Age Group(s)
          <select value={filters.ageGroup} onChange={(e) => set({ ageGroup: e.target.value })} className={control}>
            <option value="">All Age Groups</option>
            {TRAINING_AGE_GROUPS.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
        </label>
        <label className="text-sm font-bold">
          Status
          <select value={filters.status} onChange={(e) => set({ status: e.target.value })} className={control}>
            <option value="">All Statuses</option>
            {PROGRESS_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </label>
        <button type="button" onClick={() => setFilters({ search: "", category: "", ageGroup: "", status: "" })} className="rounded-lg border border-blue-300 px-4 py-2 text-sm font-bold text-blue-700 hover:bg-blue-50">
          Clear Filters
        </button>
      </div>

      <div className={`${card} overflow-x-auto`}>
        <table className="min-w-full text-sm">
          <thead className="bg-blue-50 text-left text-[#0b2a5b] dark:bg-gray-800 dark:text-blue-100">
            <tr>
              {["Training Name", "Description", "Category", "Age Group(s)", "Total Trainings", "Status", "Action"].map((h) => (
                <th key={h} className="px-4 py-3 font-bold">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {rows.map((p) => {
              const status = p.myProgress.status;
              return (
                <tr key={p.id}>
                  <td className="px-4 py-3 font-bold text-[#0b2a5b] dark:text-blue-100">{p.title}</td>
                  <td className="max-w-xs px-4 py-3 text-gray-600 dark:text-gray-400">{p.description}</td>
                  <td className="px-4 py-3"><CategoryPill value={p.category} /></td>
                  <td className="px-4 py-3">{ageGroupsLabel(p.ageGroups)}</td>
                  <td className="px-4 py-3 text-center">{p.myProgress.total}</td>
                  <td className="px-4 py-3"><StatusPill status={status} /></td>
                  <td className="px-4 py-3">
                    <Link
                      href={pathwayHref(p.id)}
                      className={`inline-block w-24 rounded-lg px-3 py-1.5 text-center text-sm font-bold ${status === "COMPLETED" ? "border border-blue-300 text-blue-700 hover:bg-blue-50" : "bg-blue-600 text-white hover:bg-blue-700"}`}
                    >
                      {status === "COMPLETED" ? "View" : status === "IN_PROGRESS" ? "Continue" : "Start"}
                    </Link>
                  </td>
                </tr>
              );
            })}
            {!rows.length ? (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-gray-500">
                  {pathways.length ? "No pathways match these filters." : "No training pathways have been assigned to you yet."}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
