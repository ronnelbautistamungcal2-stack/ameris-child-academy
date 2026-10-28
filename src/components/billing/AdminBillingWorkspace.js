import AddChargeDialog from "@/components/billing/AddChargeDialog";
import InvoiceView from "@/components/billing/InvoiceView";
import { Modal } from "@/components/training/trainingUi";
import Skeleton from "@/components/ui/Skeleton";
import useSyncedCenterId from "@/hooks/useSyncedCenterId";
import { apiJson } from "@/lib/api";
import { Fragment, useCallback, useEffect, useState } from "react";

// Admin Billing (client mockups 09-05..07): parents with their balance and
// status, each opening to their invoices (click one to view and print it,
// tick Verified, record a payment), and Add Charge.

const NAVY = "text-[#0b2a5b] dark:text-blue-100";
const control = "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800";
const money = (cents) => `$${((Number(cents) || 0) / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmt = (key) => new Date(`${key}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
const STATUS = {
  PAID: ["Paid", "bg-emerald-100 text-emerald-800"],
  OPEN: ["Open", "bg-sky-100 text-sky-800"],
  DUE_SOON: ["Due Soon", "bg-amber-100 text-amber-800"],
  OVERDUE: ["Overdue", "bg-red-100 text-red-700"],
};
const thisMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};
const initials = (name) => String(name || "?").split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("");

function Pill({ status }) {
  const [label, cls] = STATUS[status] || STATUS.OPEN;
  return <span className={`inline-block min-w-[5.5rem] rounded-md px-2.5 py-1 text-center text-xs font-bold ${cls}`}>{label}</span>;
}

export default function AdminBillingWorkspace() {
  const [centers, setCenters] = useState([]);
  const [centerId, setCenterId] = useState("");
  const [classes, setClasses] = useState([]);
  const [month, setMonth] = useState(thisMonth);
  const [status, setStatus] = useState("");
  const [classRoomId, setClassRoomId] = useState("");
  const [search, setSearch] = useState("");
  const [data, setData] = useState(null);
  const [open, setOpen] = useState({});
  const [error, setError] = useState("");
  const [adding, setAdding] = useState(false);
  const [viewing, setViewing] = useState("");
  const [paying, setPaying] = useState(null);

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
      const qs = new URLSearchParams({ centerId, month, ...(status ? { status } : {}), ...(classRoomId ? { classRoomId } : {}), ...(search.trim() ? { q: search.trim() } : {}) });
      setData(await apiJson(`/api/v1/billing/invoices?${qs}`));
      setError("");
    } catch (e) {
      setError(e.message || "Failed to load billing");
    }
  }, [centerId, month, status, classRoomId, search]);

  useEffect(() => {
    const timer = setTimeout(load, 250);
    return () => clearTimeout(timer);
  }, [load]);

  async function setVerified(invoice, verified) {
    try {
      await apiJson(`/api/v1/billing/invoices/${invoice.id}`, { method: "PUT", body: JSON.stringify({ verified }) });
      await load();
    } catch (e) {
      setError(e.message || "Failed to update the invoice");
    }
  }

  const tiles = data?.tiles || {};
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className={`text-3xl font-black ${NAVY}`} style={{ fontFamily: "Georgia, serif" }}>Billing</h1>
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

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["📄", tiles.totalClients ?? "—", "Total Clients", "bg-blue-50"],
          ["$", tiles.paidThisMonth ?? "—", "Paid (This Month)", "bg-emerald-50"],
          ["🕒", tiles.dueSoon ?? "—", "Due Soon (within 7 days)", "bg-amber-50"],
          ["!", tiles.overdue ?? "—", "Overdue", "bg-red-50"],
        ].map(([icon, value, label, tone]) => (
          <div key={label} className={`flex items-center gap-3 rounded-xl p-4 ${tone} dark:bg-gray-800`}>
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-xl font-black text-[#0b2a5b] shadow-sm" aria-hidden="true">{icon}</span>
            <span>
              <span className={`block text-2xl font-black ${NAVY}`}>{value}</span>
              <span className="text-sm text-[#0b2a5b] dark:text-blue-100">{label}</span>
            </span>
          </div>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_1.4fr_auto] lg:items-end">
        <label className="text-sm font-bold">Month<input type="month" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} className={`${control} mt-1`} /></label>
        <label className="text-sm font-bold">
          Status
          <select value={status} onChange={(e) => setStatus(e.target.value)} className={`${control} mt-1`}>
            <option value="">All Statuses</option>
            {Object.entries(STATUS).map(([value, [label]]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label className="text-sm font-bold">
          Room/Class
          <select value={classRoomId} onChange={(e) => setClassRoomId(e.target.value)} className={`${control} mt-1`}>
            <option value="">All Rooms</option>
            {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search parent or client..." aria-label="Search parent or client" className={control} />
        <button type="button" onClick={() => { setStatus(""); setClassRoomId(""); setSearch(""); setMonth(thisMonth()); }} className="rounded-lg border border-blue-300 px-4 py-2 text-sm font-bold text-blue-700">Clear Filters</button>
      </div>

      {!centerId ? (
        <p className="rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-600">Choose a center.</p>
      ) : !data ? (
        <Skeleton count={6} />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
          <table className="min-w-full text-sm">
            <thead className="bg-blue-50 text-left text-[#0b2a5b] dark:bg-gray-800 dark:text-blue-100">
              <tr>{["", "Parent", "Clients", "Balance Due", "Status"].map((h) => <th key={h} className="px-4 py-3 font-bold">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {data.parents.map((p) => {
                const isOpen = Boolean(open[p.parent.id]);
                return (
                  <Fragment key={p.parent.id}>
                    <tr>
                      <td className="w-10 px-3 py-2">
                        <button type="button" onClick={() => setOpen((o) => ({ ...o, [p.parent.id]: !isOpen }))} aria-expanded={isOpen} aria-label={`Invoices for ${p.parent.name}`} className="text-lg text-[#0b2a5b] dark:text-blue-100">
                          {isOpen ? "▾" : "▸"}
                        </button>
                      </td>
                      <td className="px-4 py-2">
                        <span className="flex items-center gap-2 font-semibold text-[#0b2a5b] dark:text-blue-100">
                          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-800">{initials(p.parent.name)}</span>
                          {p.parent.name}
                        </span>
                      </td>
                      <td className="px-4 py-2">{p.clients.join(", ") || "—"}</td>
                      <td className="px-4 py-2 font-semibold">{money(p.balanceCents)}</td>
                      <td className="px-4 py-2"><Pill status={p.status} /></td>
                    </tr>
                    {isOpen ? (
                      <tr>
                        <td colSpan={5} className="bg-blue-50/40 px-6 py-3 dark:bg-gray-800">
                          <div className={`mb-2 font-bold ${NAVY}`}>Invoices for {p.parent.name}</div>
                          <table className="min-w-full text-xs">
                            <thead className="text-left text-[#0b2a5b] dark:text-blue-100">
                              <tr>{["Invoice #", "Invoice Date", "Due Date", "Description", "Client(s)", "Amount", "Balance", "Status", "Verified", ""].map((h) => <th key={h} className="px-2 py-1.5 font-bold">{h}</th>)}</tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                              {p.invoices.map((inv) => {
                                const names = [...new Set(inv.charges.map((c) => c.childName).filter(Boolean))];
                                const descriptions = [...new Set(inv.charges.map((c) => c.description))];
                                return (
                                  <tr key={inv.id}>
                                    <td className="px-2 py-1.5">
                                      <button type="button" onClick={() => setViewing(inv.id)} className="font-semibold text-blue-700 underline">{inv.number}</button>
                                    </td>
                                    <td className="px-2 py-1.5">{fmt(inv.invoiceDate)}</td>
                                    <td className="px-2 py-1.5">{fmt(inv.dueDate)}</td>
                                    <td className="px-2 py-1.5">{descriptions.length > 1 ? `${descriptions[0]} + ${descriptions.length - 1} more` : descriptions[0]}</td>
                                    <td className="px-2 py-1.5">{names.join(", ") || "All Children"}</td>
                                    <td className="px-2 py-1.5">{money(inv.totalCents)}</td>
                                    <td className="px-2 py-1.5">{money(inv.balanceCents)}</td>
                                    <td className="px-2 py-1.5"><Pill status={inv.status} /></td>
                                    <td className="px-2 py-1.5">
                                      <input type="checkbox" checked={inv.verified} disabled={!data.canVerify} onChange={(e) => setVerified(inv, e.target.checked)} aria-label={`Verified ${inv.number}`} className="h-4 w-4" />
                                    </td>
                                    <td className="px-2 py-1.5">
                                      {data.canVerify && inv.balanceCents > 0 ? (
                                        <button type="button" onClick={() => setPaying(inv)} className="rounded border border-blue-300 px-2 py-0.5 font-semibold text-blue-700">Record Payment</button>
                                      ) : null}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })}
              {!data.parents.length ? <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500">No invoices match these filters.</td></tr> : null}
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
      {viewing ? <InvoiceView invoiceId={viewing} onClose={() => setViewing("")} /> : null}
      {paying ? (
        <PaymentDialog
          invoice={paying}
          onClose={() => setPaying(null)}
          onSaved={async () => {
            setPaying(null);
            await load();
          }}
        />
      ) : null}
    </div>
  );
}

function PaymentDialog({ invoice, onClose, onSaved }) {
  const pad = (n) => String(n).padStart(2, "0");
  const now = new Date();
  const [form, setForm] = useState({ amount: (invoice.balanceCents / 100).toFixed(2), paidAt: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`, method: "", note: "" });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    setError("");
    try {
      await apiJson(`/api/v1/billing/invoices/${invoice.id}/payments`, { method: "POST", body: JSON.stringify({ ...form, paidAt: `${form.paidAt}T12:00:00` }) });
      await onSaved();
    } catch (e) {
      setError(e.message || "Failed to record the payment");
      setSaving(false);
    }
  }

  return (
    <Modal
      title="Record Payment"
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} className="rounded-lg border border-gray-300 px-5 py-2 text-sm font-bold">Cancel</button>
          <button type="button" onClick={save} disabled={saving} className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-bold text-white disabled:opacity-60">{saving ? "Saving..." : "Record Payment"}</button>
        </>
      }
    >
      <div className="space-y-3">
        {error ? <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
        <p className="text-sm text-gray-600">{invoice.number} · balance {money(invoice.balanceCents)}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm font-bold">Amount ($)<input type="number" min="0" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className={`${control} mt-1`} /></label>
          <label className="block text-sm font-bold">Date<input type="date" value={form.paidAt} onChange={(e) => setForm({ ...form, paidAt: e.target.value })} className={`${control} mt-1`} /></label>
          <label className="block text-sm font-bold">Method<input value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })} placeholder="e.g. Check, Card, Cash" className={`${control} mt-1`} /></label>
          <label className="block text-sm font-bold">Note<input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} className={`${control} mt-1`} /></label>
        </div>
      </div>
    </Modal>
  );
}
