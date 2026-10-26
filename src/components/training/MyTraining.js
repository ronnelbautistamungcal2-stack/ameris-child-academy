import RecordTrainingDialog from "@/components/training/RecordTrainingDialog";
import TrainingModule from "@/components/training/TrainingModule";
import { Modal, NAVY, StatusPill, card, control, fmtDate } from "@/components/training/trainingUi";
import Skeleton from "@/components/ui/Skeleton";
import { apiJson } from "@/lib/api";
import { PROGRESS_STATUSES } from "@/lib/training";
import { useSession } from "next-auth/react";
import { useCallback, useEffect, useMemo, useState } from "react";

// Performance - Training tab (client mockups 04 and 05): the trainings
// assigned to the staff member, and the trainings they recorded themselves
// with Add Training.

const fmtHours = (n) => (Number(n) || 0).toFixed(1);

export default function MyTraining({ centerId }) {
  const { data: session } = useSession();
  const userId = session?.user?.id;
  const [items, setItems] = useState(null);
  const [hours, setHours] = useState(null);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState({ search: "", category: "", status: "" });
  const [viewing, setViewing] = useState("");
  const [recording, setRecording] = useState(false);

  const load = useCallback(async () => {
    if (!userId) return;
    try {
      const qs = `centerId=${encodeURIComponent(centerId)}`;
      const [mine, logs] = await Promise.all([
        apiJson(`/api/v1/training/my?${qs}`),
        apiJson(`/api/v1/training/hours?${qs}&userId=${encodeURIComponent(userId)}`),
      ]);
      setItems(mine);
      setHours(logs);
    } catch (e) {
      setError(e.message || "Failed to load your training");
    }
  }, [centerId, userId]);

  useEffect(() => {
    setItems(null);
    load();
  }, [load]);

  const categories = useMemo(() => [...new Set((items || []).map((i) => i.category).filter(Boolean))].sort(), [items]);
  const rows = (items || []).filter((i) => {
    const q = filters.search.trim().toLowerCase();
    if (q && !i.title.toLowerCase().includes(q)) return false;
    if (filters.category && i.category !== filters.category) return false;
    if (filters.status && (i.myProgress?.status || "NOT_STARTED") !== filters.status) return false;
    return true;
  });
  const viewingItem = (items || []).find((i) => i.id === viewing);

  if (error) return <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>;
  if (!items || !hours) return <Skeleton count={5} />;

  return (
    <div className="space-y-5">
      <div className={`${card} p-4`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className={`text-2xl font-black ${NAVY}`}>My Training</h2>
          <div className="flex flex-wrap items-center gap-2">
            <input value={filters.search} onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))} placeholder="Search training..." aria-label="Search training" className={`${control} mt-0 w-56`} />
            <select value={filters.category} onChange={(e) => setFilters((f) => ({ ...f, category: e.target.value }))} aria-label="Category" className={`${control} mt-0 w-44`}>
              <option value="">All Categories</option>
              {categories.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <select value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))} aria-label="Status" className={`${control} mt-0 w-40`}>
              <option value="">All Statuses</option>
              {PROGRESS_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
            <button type="button" onClick={() => setRecording(true)} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700">+ Add Training</button>
          </div>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-blue-50 text-left text-[#0b2a5b] dark:bg-gray-800 dark:text-blue-100">
              <tr>
                {["Title", "Category", "Due Date", "Status", "# Hours", "Completion Date", "Action"].map((h) => <th key={h} className="px-4 py-3 font-bold">{h}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {rows.map((i) => (
                <tr key={i.id}>
                  <td className="px-4 py-3 font-semibold text-blue-700 dark:text-blue-300">{i.title}</td>
                  <td className="px-4 py-3">{i.category}</td>
                  <td className="px-4 py-3">{fmtDate(i.dueDate)}</td>
                  <td className="px-4 py-3"><StatusPill status={i.myProgress?.status} /></td>
                  <td className="px-4 py-3 text-center">{i.hours ?? "—"}</td>
                  <td className="px-4 py-3">{i.myProgress?.completedAt ? fmtDate(i.myProgress.completedAt) : "—"}</td>
                  <td className="px-4 py-3">
                    <button type="button" onClick={() => setViewing(i.id)} className="rounded-lg border border-blue-300 bg-blue-50 px-4 py-1.5 text-sm font-bold text-blue-700 hover:bg-blue-100">View</button>
                  </td>
                </tr>
              ))}
              {!rows.length ? (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-gray-500">{items.length ? "No trainings match these filters." : "No trainings have been assigned to you yet."}</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <div className={`${card} p-4`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className={`text-lg font-black ${NAVY}`}>Training Hours</h3>
          <div className="flex gap-4 text-sm">
            <span>Total <b>{fmtHours(hours.totals.hours)}</b></span>
            <span>Non-Interactive <b>{fmtHours(hours.totals.nonInteractiveHours)}</b></span>
            <span>Interactive <b>{fmtHours(hours.totals.interactiveHours)}</b></span>
          </div>
        </div>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-blue-50 text-left text-[#0b2a5b] dark:bg-gray-800 dark:text-blue-100">
              <tr>
                {["Topic", "Source of Training", "Trainer / Facilitator", "Date Completed", "Non-Interactive (Hours)", "Interactive (Hours)", "Attachment"].map((h) => <th key={h} className="px-4 py-3 font-bold">{h}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {[...hours.logs].reverse().map((l) => (
                <tr key={l.id}>
                  <td className="px-4 py-3 font-semibold">{l.topic}</td>
                  <td className="px-4 py-3">{l.source || "—"}</td>
                  <td className="px-4 py-3">{l.performedBy || "—"}</td>
                  <td className="px-4 py-3">{fmtDate(l.date)}</td>
                  <td className="px-4 py-3 text-center">{l.nonInteractiveHours != null ? fmtHours(l.nonInteractiveHours) : "—"}</td>
                  <td className="px-4 py-3 text-center">{l.interactiveHours != null ? fmtHours(l.interactiveHours) : "—"}</td>
                  <td className="px-4 py-3">
                    {l.certificateUrl ? <a href={l.certificateUrl} target="_blank" rel="noreferrer" className="text-blue-700 underline">{l.certificateFileName || "View"}</a> : "—"}
                  </td>
                </tr>
              ))}
              {!hours.logs.length ? (
                <tr><td colSpan={7} className="px-4 py-6 text-center text-gray-500">No training hours recorded yet.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      {viewingItem ? (
        <Modal title="Training" label={viewingItem.title} onClose={() => setViewing("")} wide>
          <TrainingModule item={viewingItem} progress={viewingItem.myProgress} onChanged={load} />
        </Modal>
      ) : null}
      {recording ? (
        <RecordTrainingDialog
          centerId={centerId}
          onClose={() => setRecording(false)}
          onSaved={async () => {
            setRecording(false);
            await load();
          }}
        />
      ) : null}
    </div>
  );
}
