import AdminTaskChecklistManager from "@/components/checklists/AdminTaskChecklistManager";
import { NAVY } from "@/components/reports/reportUi";
import useSyncedCenterId from "@/hooks/useSyncedCenterId";
import { apiJson } from "@/lib/api";
import { useEffect, useState } from "react";

export function ChecklistIcon({ className = "h-12 w-12" }) {
  return (
    <span className={`flex shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white ${className}`} aria-hidden>
      <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 7h6m-6 4h6M8 12h.01M8 16h.01" />
      </svg>
    </span>
  );
}

// Checklist Manager for admins and coaches (client request 2026-10-02): the
// daily checklists only; the Weekly Planner and Task Checklists tabs are gone.
export default function ChecklistManagerPage({ Layout }) {
  const [centers, setCenters] = useState([]);
  const [centerId, setCenterId] = useState("");
  const [error, setError] = useState("");

  useSyncedCenterId(centerId, setCenterId, centers);

  useEffect(() => {
    apiJson("/api/v1/centers")
      .then((rows) => {
        const list = Array.isArray(rows) ? rows : [];
        setCenters(list);
        if (list.length === 1) setCenterId(list[0].id);
      })
      .catch((e) => setError(e.message || "Failed to load centers"));
  }, []);

  return (
    <Layout title="Checklist Manager">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <ChecklistIcon />
            <h1 className={`text-3xl font-black ${NAVY}`}>Checklist Manager</h1>
          </div>
          <label className="block min-w-[240px]">
            <span className={`text-sm font-bold ${NAVY}`}>Center</span>
            <select
              value={centerId}
              onChange={(e) => setCenterId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800"
            >
              <option value="">Select a center...</option>
              {centers.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </label>
        </div>
        {error ? <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
        {centerId ? (
          <AdminTaskChecklistManager centerId={centerId} />
        ) : (
          <div className="rounded-2xl border border-dashed border-gray-300 bg-white py-14 text-center text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-900">
            Choose a center to view and manage its checklists.
          </div>
        )}
      </div>
    </Layout>
  );
}
