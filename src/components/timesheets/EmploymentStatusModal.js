import { apiJson } from "@/lib/api";
import { EMPLOYMENT_STATUSES, employmentStatusLabel } from "@/lib/employment";
import { useEffect, useState } from "react";

// Employment Status pop-up (client mockup 2026-10-02): the dated history and
// blank rows to add new entries. The latest entry becomes the status.

const BLANK_ROWS = 5;
const blank = () => Array.from({ length: BLANK_ROWS }, () => ({ date: "", status: "", notes: "" }));
const cell = "rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800";
const formatDate = (key) => {
  const [y, m, d] = key.split("-");
  return `${m}/${d}/${y}`;
};

export default function EmploymentStatusModal({ userId, onClose, onSaved }) {
  const [data, setData] = useState(null);
  const [rows, setRows] = useState(blank);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiJson(`/api/v1/users/${userId}/employment`)
      .then(setData)
      .catch((e) => setError(e.message || "Failed to load the employment status"));
  }, [userId]);

  const filled = rows.filter((r) => r.date || r.status || r.notes);

  async function save() {
    setError("");
    if (filled.some((r) => !r.date || !r.status)) {
      setError("Each new row needs a date and a status.");
      return;
    }
    if (!filled.length) return onClose();
    setSaving(true);
    try {
      const result = await apiJson(`/api/v1/users/${userId}/employment`, {
        method: "PUT",
        body: JSON.stringify({ entries: filled }),
      });
      onSaved?.(result.status);
      onClose();
    } catch (e) {
      setError(e.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  const update = (i, field, value) => setRows((list) => list.map((r, j) => (j === i ? { ...r, [field]: value } : r)));

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/50 px-4 py-10 print:static print:bg-white" role="dialog" aria-modal="true" aria-label="Employment Status">
      <div className="w-full max-w-3xl rounded-2xl bg-white shadow-2xl dark:bg-gray-900">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-700">
          <h2 className="text-xl font-black text-[#0b2a5b] dark:text-blue-100">💼 Employment Status</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="text-2xl leading-none text-gray-500 hover:text-gray-800 print:hidden">×</button>
        </div>
        <div className="px-6 py-4">
          <div className="mb-3 text-lg font-black text-[#0b2a5b] dark:text-blue-100">{data?.name || ""}</div>
          {error ? <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
          <table className="w-full text-sm">
            <thead className="bg-blue-50 text-left text-xs font-bold text-[#0b2a5b] dark:bg-gray-800 dark:text-blue-100">
              <tr>
                <th className="px-2 py-2">Date</th>
                <th className="px-2 py-2">Status</th>
                <th className="px-2 py-2">User</th>
                <th className="px-2 py-2">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {(data?.entries || []).map((entry) => (
                <tr key={entry.id}>
                  <td className="px-2 py-2">{formatDate(entry.date)}</td>
                  <td className="px-2 py-2">{employmentStatusLabel(entry.status)}</td>
                  <td className="px-2 py-2">{entry.recordedByName || "System"}</td>
                  <td className="px-2 py-2">{entry.notes || ""}</td>
                </tr>
              ))}
              {rows.map((row, i) => (
                <tr key={`new-${i}`} className="print:hidden">
                  <td className="px-2 py-1.5">
                    <input type="date" value={row.date} onChange={(e) => update(i, "date", e.target.value)} className={cell} aria-label={`New entry ${i + 1} date`} />
                  </td>
                  <td className="px-2 py-1.5">
                    <select value={row.status} onChange={(e) => update(i, "status", e.target.value)} className={cell} aria-label={`New entry ${i + 1} status`}>
                      <option value="">Select Status</option>
                      {EMPLOYMENT_STATUSES.map((s) => (
                        <option key={s.value} value={s.value}>{s.label}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-2 py-1.5 text-xs text-gray-400">{row.date || row.status ? "You" : ""}</td>
                  <td className="px-2 py-1.5">
                    <input value={row.notes} onChange={(e) => update(i, "notes", e.target.value)} className={`${cell} w-full`} aria-label={`New entry ${i + 1} notes`} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t border-gray-200 px-6 py-4 print:hidden dark:border-gray-700">
          <button type="button" onClick={() => window.print()} className="rounded-lg border border-blue-300 px-4 py-2 text-sm font-bold text-blue-700 hover:bg-blue-50">
            🖨 Print
          </button>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="rounded-lg border border-gray-300 px-5 py-2 text-sm font-bold text-gray-800 hover:bg-gray-50 dark:text-gray-200">
              Cancel
            </button>
            <button type="button" onClick={save} disabled={saving} className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-60">
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
