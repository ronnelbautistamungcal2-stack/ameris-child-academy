import AddChargeDialog from "@/components/billing/AddChargeDialog";
import { Modal } from "@/components/training/trainingUi";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import Skeleton from "@/components/ui/Skeleton";
import useSyncedCenterId from "@/hooks/useSyncedCenterId";
import { apiJson } from "@/lib/api";
import { useCallback, useEffect, useState } from "react";

// Parent Fees (client mockup 09-03; once "Clothing Issued"): charges added
// for a family, with Add Charge, Edit and Delete.

const NAVY = "text-[#0b2a5b] dark:text-blue-100";
const control = "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800";
const money = (cents) => `$${((Number(cents) || 0) / 100).toFixed(2)}`;
const fmt = (key) => new Date(`${key}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
const DATE_RANGES = [
  { value: "", label: "All Dates" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
  { value: "MONTH", label: "This month" },
];

function ageYears(birthDate) {
  if (!birthDate) return "";
  const years = Math.floor((Date.now() - new Date(birthDate).getTime()) / (365.25 * 86400000));
  return `${years} yr${years === 1 ? "" : "s"}`;
}

function rangeParams(range) {
  const pad = (n) => String(n).padStart(2, "0");
  const key = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const now = new Date();
  if (range === "MONTH") return { from: key(new Date(now.getFullYear(), now.getMonth(), 1)) };
  if (range) {
    const from = new Date(now);
    from.setDate(from.getDate() - Number(range));
    return { from: key(from) };
  }
  return {};
}

export default function ParentFeesWorkspace() {
  const [centers, setCenters] = useState([]);
  const [centerId, setCenterId] = useState("");
  const [classes, setClasses] = useState([]);
  const [charges, setCharges] = useState(null);
  const [search, setSearch] = useState("");
  const [classRoomId, setClassRoomId] = useState("");
  const [range, setRange] = useState("");
  const [error, setError] = useState("");
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);

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

  useEffect(() => {
    if (!centerId) return;
    apiJson(`/api/v1/classes?centerId=${encodeURIComponent(centerId)}`)
      .then((rows) => setClasses(Array.isArray(rows) ? rows : []))
      .catch(() => setClasses([]));
  }, [centerId]);

  const load = useCallback(async () => {
    if (!centerId) return;
    try {
      const qs = new URLSearchParams({ centerId, ...rangeParams(range), ...(classRoomId ? { classRoomId } : {}), ...(search.trim() ? { q: search.trim() } : {}) });
      setCharges(await apiJson(`/api/v1/billing/charges?${qs}`));
      setError("");
    } catch (e) {
      setError(e.message || "Failed to load parent fees");
    }
  }, [centerId, range, classRoomId, search]);

  useEffect(() => {
    const timer = setTimeout(load, 250);
    return () => clearTimeout(timer);
  }, [load]);

  async function confirmDelete() {
    const charge = deleting;
    setDeleting(null);
    try {
      await apiJson(`/api/v1/billing/charges/${charge.id}`, { method: "DELETE" });
      await load();
    } catch (e) {
      setError(e.message || "Failed to delete the charge");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className={`text-3xl font-black ${NAVY}`}>Parent Fees</h1>
        <div className="flex flex-wrap items-end gap-3">
          {centers.length > 1 ? (
            <select value={centerId} onChange={(e) => setCenterId(e.target.value)} aria-label="Center" className={`${control} w-56`}>
              <option value="">Select a center...</option>
              {centers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          ) : null}
          <button type="button" onClick={() => setAdding(true)} disabled={!centerId} className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-60">+ Add Charge</button>
        </div>
      </div>
      {error ? <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}

      <div className="grid gap-3 sm:grid-cols-[2fr_1fr_1fr_auto]">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by student or parent name..." aria-label="Search" className={control} />
        <select value={classRoomId} onChange={(e) => setClassRoomId(e.target.value)} aria-label="Classroom" className={control}>
          <option value="">All Classrooms</option>
          {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={range} onChange={(e) => setRange(e.target.value)} aria-label="Dates" className={control}>
          {DATE_RANGES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
        <button type="button" onClick={() => { setSearch(""); setClassRoomId(""); setRange(""); }} className="rounded-lg border border-blue-300 px-4 py-2 text-sm font-bold text-blue-700">Reset Filters</button>
      </div>

      {!centerId ? (
        <p className="rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-600">Choose a center.</p>
      ) : !charges ? (
        <Skeleton count={6} />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
          <table className="min-w-full text-sm">
            <thead className="bg-blue-50 text-left text-[#0b2a5b] dark:bg-gray-800 dark:text-blue-100">
              <tr>{["Student Name", "Age", "Classroom", "Parent Name", "Date", "Item Issued", "Amount", "Actions"].map((h) => <th key={h} className="px-4 py-3 font-bold">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {charges.map((c) => (
                <tr key={c.id}>
                  <td className="px-4 py-2.5 font-semibold text-[#0b2a5b] dark:text-blue-100">{c.child?.name || "—"}</td>
                  <td className="px-4 py-2.5">{ageYears(c.child?.birthDate)}</td>
                  <td className="px-4 py-2.5">{c.child?.classroom || "—"}</td>
                  <td className="px-4 py-2.5">{c.parent?.name || "—"}</td>
                  <td className="whitespace-nowrap px-4 py-2.5">{fmt(c.date)}</td>
                  <td className="px-4 py-2.5">{c.description}</td>
                  <td className="px-4 py-2.5">{money(c.amountCents)}</td>
                  <td className="whitespace-nowrap px-4 py-2.5">
                    <button type="button" onClick={() => setEditing(c)} className="mr-2 rounded-lg border border-gray-300 px-3 py-1 text-sm font-semibold">✎ Edit</button>
                    <button type="button" onClick={() => setDeleting(c)} aria-label={`Delete ${c.description}`} className="rounded-lg border border-red-200 bg-red-50 px-3 py-1 text-sm text-red-600">🗑</button>
                  </td>
                </tr>
              ))}
              {!charges.length ? <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-500">No parent fees yet.</td></tr> : null}
            </tbody>
          </table>
        </div>
      )}

      {adding ? (
        <AddChargeDialog
          centerId={centerId}
          onClose={() => setAdding(false)}
          onSaved={async () => {
            setAdding(false);
            await load();
          }}
        />
      ) : null}
      {editing ? (
        <EditChargeDialog
          charge={editing}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            await load();
          }}
        />
      ) : null}
      <ConfirmDialog
        open={Boolean(deleting)}
        title="Delete charge?"
        message={`"${deleting?.description}" (${money(deleting?.amountCents)}) will be removed from the family's invoice.`}
        confirmLabel="Delete"
        variant="danger"
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}

function EditChargeDialog({ charge, onClose, onSaved }) {
  const [form, setForm] = useState({ date: charge.date, description: charge.description, amount: (charge.amountCents / 100).toFixed(2) });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    setError("");
    try {
      await apiJson(`/api/v1/billing/charges/${charge.id}`, { method: "PUT", body: JSON.stringify(form) });
      await onSaved();
    } catch (e) {
      setError(e.message || "Failed to save");
      setSaving(false);
    }
  }

  return (
    <Modal
      title="Edit Charge"
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} className="rounded-lg border border-gray-300 px-5 py-2 text-sm font-bold">Cancel</button>
          <button type="button" onClick={save} disabled={saving} className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-bold text-white disabled:opacity-60">{saving ? "Saving..." : "Save"}</button>
        </>
      }
    >
      <div className="space-y-3">
        {error ? <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
        <p className="text-sm text-gray-600">{charge.child?.name} · {charge.parent?.name}</p>
        <label className="block text-sm font-bold">Date<input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className={`${control} mt-1`} /></label>
        <label className="block text-sm font-bold">Description<input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className={`${control} mt-1`} /></label>
        <label className="block text-sm font-bold">Amount ($)<input type="number" min="0" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className={`${control} mt-1`} /></label>
      </div>
    </Modal>
  );
}
