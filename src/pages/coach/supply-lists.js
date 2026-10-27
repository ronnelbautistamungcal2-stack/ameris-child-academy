import CoachLayout, { SUPPLY_REQUESTS_CHANGED_EVENT } from "@/components/coach/CoachLayout";
import { Modal } from "@/components/training/trainingUi";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import Skeleton from "@/components/ui/Skeleton";
import useSyncedCenterId from "@/hooks/useSyncedCenterId";
import { apiJson } from "@/lib/api";
import { useCallback, useEffect, useMemo, useState } from "react";

// Coach - Supply Lists (client request 2026-10-02): supply requests from
// teachers (pending ones by default; fulfilled ones drop off), a note the
// teacher is told about, and the supplies the center's lessons need.

const NAVY = "text-[#0b2a5b] dark:text-blue-100";
const control = "mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800";
const card = "rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900";
const thead = "bg-blue-50 text-left text-[#0b2a5b] dark:bg-gray-800 dark:text-blue-100";
const STATUSES = [
  { value: "PENDING", label: "Pending", pill: "bg-amber-100 text-amber-800" },
  { value: "APPROVED", label: "Approved", pill: "bg-blue-100 text-blue-800" },
  { value: "DENIED", label: "Denied", pill: "bg-red-100 text-red-700" },
  { value: "FULFILLED", label: "Fulfilled", pill: "bg-emerald-100 text-emerald-800" },
];
const EMPTY_FORM = { item: "", quantity: 1, classRoomId: "", purpose: "", notes: "" };

function csvEscape(value) {
  const s = String(value ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const announce = () => window.dispatchEvent(new Event(SUPPLY_REQUESTS_CHANGED_EVENT));

export default function CoachSupplyLists() {
  const [centers, setCenters] = useState([]);
  const [centerId, setCenterId] = useState("");
  const [classrooms, setClassrooms] = useState([]);
  const [requests, setRequests] = useState(null);
  const [supplies, setSupplies] = useState([]);
  const [status, setStatus] = useState("PENDING");
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [dialog, setDialog] = useState(null); // {} new, or a request to edit
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

  const load = useCallback(async () => {
    if (!centerId) return;
    setError("");
    const qs = `centerId=${encodeURIComponent(centerId)}`;
    try {
      const [rooms, reqs, list] = await Promise.all([
        apiJson(`/api/v1/classes?${qs}`),
        apiJson(`/api/v1/supply-requests?${qs}`),
        apiJson(`/api/v1/lessons/supply-list?${qs}`),
      ]);
      setClassrooms(Array.isArray(rooms) ? rooms : []);
      setRequests(Array.isArray(reqs) ? reqs : []);
      setSupplies(Array.isArray(list) ? list : []);
    } catch (e) {
      setError(e.message || "Failed to load supplies");
    }
  }, [centerId]);

  useEffect(() => {
    setRequests(null);
    load();
  }, [load]);

  const shown = useMemo(() => (requests || []).filter((r) => !status || r.status === status), [requests, status]);
  const pending = (requests || []).filter((r) => r.status === "PENDING").length;
  const filteredSupplies = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return supplies;
    return supplies.filter((s) => s.name.toLowerCase().includes(q) || (s.lessons || []).some((l) => l.title.toLowerCase().includes(q)));
  }, [supplies, search]);

  async function update(id, body, message) {
    setError("");
    setNotice("");
    try {
      const updated = await apiJson(`/api/v1/supply-requests/${id}`, { method: "PUT", body: JSON.stringify(body) });
      setRequests((rows) => rows.map((r) => (r.id === id ? updated : r)));
      if (message) setNotice(message);
      announce();
    } catch (e) {
      setError(e.message || "Failed to update the request");
    }
  }

  async function confirmDelete() {
    const r = deleting;
    setDeleting(null);
    try {
      await apiJson(`/api/v1/supply-requests/${r.id}`, { method: "DELETE" });
      setRequests((rows) => rows.filter((x) => x.id !== r.id));
      announce();
    } catch (e) {
      setError(e.message || "Failed to delete the request");
    }
  }

  function exportCsv() {
    const lines = ["Name,Quantity,Type,Unit,Estimated Cost,Category,Lessons"];
    for (const s of supplies) {
      lines.push(
        [
          csvEscape(s.name),
          s.totalQuantity,
          s.quantityType === "per_student" ? "Per Student" : "Total",
          csvEscape(s.unit || ""),
          (s.estimatedCost || 0).toFixed(2),
          csvEscape(s.category || ""),
          csvEscape((s.lessons || []).map((l) => l.title).join("; ")),
        ].join(","),
      );
    }
    const url = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "supply-list.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <CoachLayout title="Supply Lists">
      <div className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h1 className={`text-3xl font-black ${NAVY}`}>Supply Lists</h1>
          <label className="block text-sm font-bold">
            Center
            <select value={centerId} onChange={(e) => setCenterId(e.target.value)} className={`${control} w-60`}>
              <option value="">Select a center...</option>
              {centers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
        </div>
        {error ? <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
        {notice ? <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{notice}</div> : null}

        {!centerId ? (
          <p className={`${card} text-sm text-gray-600`}>Choose a center to see its supply requests.</p>
        ) : !requests ? (
          <Skeleton count={5} />
        ) : (
          <>
            <div className={card}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className={`text-xl font-black ${NAVY}`}>
                  Supply Requests
                  {pending ? <span className="ml-2 rounded-full bg-red-600 px-2 py-0.5 align-middle text-xs font-bold text-white">{pending} pending</span> : null}
                </h2>
                <div className="flex flex-wrap items-center gap-2">
                  <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status" className={`${control} mt-0 w-40`}>
                    {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                    <option value="">All statuses</option>
                  </select>
                  <button type="button" onClick={() => setDialog({})} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700">+ Add Supply Request</button>
                </div>
              </div>
              <div className="mt-3 overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className={thead}>
                    <tr>
                      {["Date", "Item", "Qty", "Classroom", "Requested By", "Purpose / Notes", "Status", "Note to Teacher", ""].map((h) => (
                        <th key={h} className="px-3 py-2 font-bold">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {shown.map((r) => (
                      <RequestRow
                        key={r.id}
                        request={r}
                        onStatus={(value) => update(r.id, { status: value }, value === "FULFILLED" ? `${r.item} marked fulfilled.` : "")}
                        onNote={(note) => update(r.id, { reviewNote: note }, `Note saved. ${r.requestedBy?.name || "The teacher"} was notified.`)}
                        onEdit={() => setDialog(r)}
                        onDelete={() => setDeleting(r)}
                      />
                    ))}
                    {!shown.length ? (
                      <tr>
                        <td colSpan={9} className="px-3 py-6 text-center text-gray-500">
                          {status === "PENDING" ? "No pending supply requests." : "No supply requests."}
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>

            {supplies.length ? (
              <div className={card}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className={`text-xl font-black ${NAVY}`}>Lesson Supplies</h2>
                  <div className="flex flex-wrap items-center gap-2">
                    <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search supplies..." aria-label="Search supplies" className={`${control} mt-0 w-56`} />
                    <button type="button" onClick={exportCsv} className="rounded-lg border border-blue-300 px-4 py-2 text-sm font-bold text-blue-700 hover:bg-blue-50">Export CSV</button>
                  </div>
                </div>
                <div className="mt-3 overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className={thead}>
                      <tr>{["Supply", "Qty", "Type", "Unit", "Est. Cost", "Category", "Used In Lessons"].map((h) => <th key={h} className="px-3 py-2 font-bold">{h}</th>)}</tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                      {filteredSupplies.map((s, i) => (
                        <tr key={`${s.name}-${i}`}>
                          <td className="px-3 py-2 font-semibold">{s.name}</td>
                          <td className="px-3 py-2">{s.totalQuantity}</td>
                          <td className="px-3 py-2">{s.quantityType === "per_student" ? "Per Student" : "Total"}</td>
                          <td className="px-3 py-2">{s.unit || "—"}</td>
                          <td className="px-3 py-2">{s.estimatedCost ? `$${s.estimatedCost.toFixed(2)}` : "—"}</td>
                          <td className="px-3 py-2">{s.category || "General"}</td>
                          <td className="px-3 py-2 text-gray-600 dark:text-gray-400">{(s.lessons || []).map((l) => l.title).join(", ") || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}
          </>
        )}
      </div>

      {dialog ? (
        <RequestDialog
          centerId={centerId}
          classrooms={classrooms}
          request={dialog.id ? dialog : null}
          onClose={() => setDialog(null)}
          onSaved={async () => {
            setDialog(null);
            await load();
            announce();
          }}
        />
      ) : null}
      <ConfirmDialog
        open={Boolean(deleting)}
        title="Delete supply request?"
        message={`"${deleting?.item}" will be removed.`}
        confirmLabel="Delete"
        variant="danger"
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />
    </CoachLayout>
  );
}

function RequestRow({ request: r, onStatus, onNote, onEdit, onDelete }) {
  const [note, setNote] = useState(r.reviewNote || "");
  const meta = STATUSES.find((s) => s.value === r.status) || STATUSES[0];
  const dirty = note.trim() !== (r.reviewNote || "");
  return (
    <tr className="align-top">
      <td className="whitespace-nowrap px-3 py-2 text-gray-600">{new Date(r.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</td>
      <td className="px-3 py-2 font-semibold">{r.item}</td>
      <td className="px-3 py-2">{r.quantity}</td>
      <td className="px-3 py-2">{r.classRoom?.name || "—"}</td>
      <td className="px-3 py-2">{r.requestedBy?.name || r.requestedBy?.email || "—"}</td>
      <td className="max-w-xs px-3 py-2 text-gray-600 dark:text-gray-400">
        {r.purpose || "—"}
        {r.notes ? <div className="text-xs italic">{r.notes}</div> : null}
      </td>
      <td className="px-3 py-2">
        <select value={r.status} onChange={(e) => onStatus(e.target.value)} aria-label={`Status of ${r.item}`} className={`rounded-md border-0 px-2 py-1 text-xs font-bold ${meta.pill}`}>
          {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </td>
      <td className="min-w-[14rem] px-3 py-2">
        <div className="flex items-start gap-1">
          <textarea
            rows={1}
            value={note}
            onChange={(e) => setNote(e.target.value.slice(0, 1000))}
            placeholder="Add a note for the teacher..."
            aria-label={`Note to teacher about ${r.item}`}
            className="w-full rounded-md border border-gray-300 px-2 py-1 text-xs dark:border-gray-600 dark:bg-gray-800"
          />
          {dirty ? (
            <button type="button" onClick={() => onNote(note)} className="rounded-md bg-blue-600 px-2 py-1 text-xs font-bold text-white hover:bg-blue-700">Save</button>
          ) : null}
        </div>
      </td>
      <td className="whitespace-nowrap px-3 py-2 text-right">
        <button type="button" onClick={onEdit} className="mr-2 text-xs font-semibold text-blue-700 hover:underline">Edit</button>
        <button type="button" onClick={onDelete} className="text-xs font-semibold text-red-600 hover:underline">Delete</button>
      </td>
    </tr>
  );
}

function RequestDialog({ centerId, classrooms, request, onClose, onSaved }) {
  const [form, setForm] = useState(() =>
    request
      ? { item: request.item, quantity: request.quantity, classRoomId: request.classRoomId || "", purpose: request.purpose || "", notes: request.notes || "" }
      : EMPTY_FORM,
  );
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  async function save() {
    if (!form.item.trim()) return setError("Enter the item");
    setSaving(true);
    setError("");
    const body = { centerId, item: form.item.trim(), quantity: Number(form.quantity) || 1, classRoomId: form.classRoomId || null, purpose: form.purpose || null, notes: form.notes || null };
    try {
      if (request) await apiJson(`/api/v1/supply-requests/${request.id}`, { method: "PUT", body: JSON.stringify(body) });
      else await apiJson("/api/v1/supply-requests", { method: "POST", body: JSON.stringify(body) });
      await onSaved();
    } catch (e) {
      setError(e.message || "Failed to save the request");
      setSaving(false);
    }
  }

  return (
    <Modal
      title={request ? "Edit Supply Request" : "Add Supply Request"}
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} className="rounded-lg border border-gray-300 px-5 py-2 text-sm font-bold">Cancel</button>
          <button type="button" onClick={save} disabled={saving} className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-60">
            {saving ? "Saving..." : "Save"}
          </button>
        </>
      }
    >
      <div className="space-y-3">
        {error ? <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
        <div className="grid gap-3 sm:grid-cols-[1fr_6rem]">
          <label className="block text-sm font-bold">
            Item
            <input value={form.item} onChange={(e) => set({ item: e.target.value })} className={control} />
          </label>
          <label className="block text-sm font-bold">
            Quantity
            <input type="number" min="1" value={form.quantity} onChange={(e) => set({ quantity: e.target.value })} className={control} />
          </label>
        </div>
        <label className="block text-sm font-bold">
          Classroom
          <select value={form.classRoomId} onChange={(e) => set({ classRoomId: e.target.value })} className={control}>
            <option value="">No classroom</option>
            {classrooms.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <label className="block text-sm font-bold">
          Purpose
          <input value={form.purpose} onChange={(e) => set({ purpose: e.target.value })} className={control} />
        </label>
        <label className="block text-sm font-bold">
          Notes
          <input value={form.notes} onChange={(e) => set({ notes: e.target.value })} className={control} />
        </label>
      </div>
    </Modal>
  );
}
