import { Modal } from "@/components/training/trainingUi";
import { apiJson } from "@/lib/api";
import { useEffect, useState } from "react";

// Add Charge (client mockup 09-04), on the coach's Parent Fees and the admin
// Billing page. The charge goes on the parent's invoice and they are notified.

const control = "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800";
const todayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const blankRow = () => ({ childId: "", description: "", amount: "" });

export default function AddChargeDialog({ centerId, onClose, onSaved }) {
  const [parents, setParents] = useState(null);
  const [parentId, setParentId] = useState("");
  const [date, setDate] = useState(todayKey);
  const [rows, setRows] = useState([blankRow()]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiJson(`/api/v1/billing/parents?centerId=${encodeURIComponent(centerId)}`)
      .then(setParents)
      .catch((e) => setError(e.message || "Failed to load parents"));
  }, [centerId]);

  const parent = (parents || []).find((p) => p.id === parentId);
  const setRow = (i, patch) => setRows((r) => r.map((row, j) => (j === i ? { ...row, ...patch } : row)));

  async function save() {
    setSaving(true);
    setError("");
    try {
      await apiJson("/api/v1/billing/charges", { method: "POST", body: JSON.stringify({ centerId, parentId, date, rows }) });
      await onSaved();
    } catch (e) {
      setError(e.message || "Failed to add the charge");
      setSaving(false);
    }
  }

  return (
    <Modal
      title="Add Charge"
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} className="rounded-lg border border-blue-300 px-6 py-2 text-sm font-bold text-[#0b2a5b] dark:text-blue-100">Cancel</button>
          <button type="button" onClick={save} disabled={saving || !parentId} className="rounded-lg bg-blue-600 px-6 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-60">
            {saving ? "Adding..." : "Add Charge"}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        {error ? <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
        <label className="grid items-center gap-2 text-sm font-semibold text-[#0b2a5b] sm:grid-cols-[10rem_1fr] dark:text-blue-100">
          <span>Parent Name <span className="text-red-500">*</span></span>
          <select value={parentId} onChange={(e) => { setParentId(e.target.value); setRows([blankRow()]); }} className={control}>
            <option value="">{parents ? "Select parent name..." : "Loading..."}</option>
            {(parents || []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
        <label className="grid items-center gap-2 text-sm font-semibold text-[#0b2a5b] sm:grid-cols-[10rem_1fr] dark:text-blue-100">
          <span>Date <span className="text-red-500">*</span></span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={control} />
        </label>
        <table className="w-full text-sm">
          <thead className="bg-blue-50 text-left text-[#0b2a5b] dark:bg-gray-800 dark:text-blue-100">
            <tr>
              <th className="px-2 py-2 font-bold">Child Name <span className="text-red-500">*</span></th>
              <th className="px-2 py-2 font-bold">Description <span className="text-red-500">*</span></th>
              <th className="px-2 py-2 font-bold">Amount <span className="text-red-500">*</span></th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i}>
                <td className="px-2 py-1.5">
                  <select value={row.childId} onChange={(e) => setRow(i, { childId: e.target.value })} disabled={!parent} aria-label={`Child for charge ${i + 1}`} className={control}>
                    <option value="">Select child name...</option>
                    {(parent?.children || []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </td>
                <td className="px-2 py-1.5">
                  <input value={row.description} onChange={(e) => setRow(i, { description: e.target.value })} placeholder="Enter description..." aria-label={`Description for charge ${i + 1}`} className={control} />
                </td>
                <td className="px-2 py-1.5">
                  <div className="flex items-center rounded-lg border border-gray-300 bg-white dark:border-gray-600 dark:bg-gray-800">
                    <span className="px-2 text-gray-500">$</span>
                    <input type="number" min="0" step="0.01" value={row.amount} onChange={(e) => setRow(i, { amount: e.target.value })} placeholder="0.00" aria-label={`Amount for charge ${i + 1}`} className="w-24 rounded-r-lg border-0 bg-transparent px-2 py-2 text-sm" />
                  </div>
                </td>
                <td className="px-1">
                  {rows.length > 1 ? (
                    <button type="button" onClick={() => setRows((r) => r.filter((_, j) => j !== i))} aria-label={`Remove charge ${i + 1}`} className="text-red-600">🗑</button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <button type="button" onClick={() => setRows((r) => [...r, blankRow()])} className="rounded-lg border border-blue-300 px-4 py-2 text-sm font-bold text-blue-700">+ Add Row</button>
      </div>
    </Modal>
  );
}
