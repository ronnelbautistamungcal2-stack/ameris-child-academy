import { useCallback, useEffect, useMemo, useState } from "react";
import GlobalLayout from "@/components/global/GlobalLayout";
import { apiJson } from "@/lib/api";
import { ACCOUNT_STATUS_LABELS, ADD_ONS, ADD_ON_LABELS } from "@/lib/addOns";
import CurriculumTypePicker from "@/components/curriculum/CurriculumTypePicker";
import { curriculumTypeLabels } from "@/lib/curriculumTypes";

const TABS = [
  { key: "ALL", label: "All" },
  { key: "ACTIVE", label: "Active" },
  { key: "PENDING", label: "Pending Approval" },
  { key: "ON_HOLD", label: "On Hold" },
  { key: "CANCELLED", label: "Cancelled" },
];

const STATUS_CLASS = {
  ACTIVE: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200",
  PENDING: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
  ON_HOLD: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200",
  CANCELLED: "bg-gray-200 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
};

const card = "rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900";
const input =
  "w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100";
const button =
  "rounded-xl border border-blue-700 px-4 py-2 text-sm font-bold text-blue-800 hover:bg-blue-50 disabled:opacity-50 dark:border-blue-400 dark:text-blue-200 dark:hover:bg-blue-900/30";
const primary = "rounded-xl bg-blue-800 px-4 py-2 text-sm font-bold text-white hover:bg-blue-900 disabled:opacity-50";

function StatusPill({ status }) {
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${STATUS_CLASS[status] || STATUS_CLASS.CANCELLED}`}>
      {ACCOUNT_STATUS_LABELS[status] || status}
    </span>
  );
}

function day(value) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function dateInput(value) {
  return value ? new Date(value).toISOString().slice(0, 10) : "";
}

function Row({ label, children }) {
  return (
    <div className="flex justify-between gap-4 py-1 text-sm">
      <span className="text-gray-500 dark:text-gray-400">{label}</span>
      <span className="text-right font-semibold text-gray-900 dark:text-gray-100">{children}</span>
    </div>
  );
}

function AddOnChecks({ value, onChange }) {
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {ADD_ONS.map((key) => (
        <label key={key} className="flex items-center gap-2 text-sm text-gray-800 dark:text-gray-200">
          <input
            type="checkbox"
            checked={value.includes(key)}
            onChange={(e) => onChange(e.target.checked ? [...value, key] : value.filter((k) => k !== key))}
          />
          {ADD_ON_LABELS[key]}
        </label>
      ))}
    </div>
  );
}

function SubscriptionEditor({ detail, onSave, onCancel, saving }) {
  const [form, setForm] = useState(() => ({
    addOns: detail.addOns || [],
    curriculumTypes: detail.curriculumTypes || [],
    maxCenters: detail.maxCenters,
    maxChildren: detail.maxChildren ?? "",
    startDate: dateInput(detail.startDate),
    renewalDate: dateInput(detail.renewalDate),
    autoRenew: detail.autoRenew,
  }));
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  return (
    <div className="space-y-4">
      <div>
        <div className="mb-2 text-sm font-bold text-gray-700 dark:text-gray-200">Add-ons</div>
        <AddOnChecks value={form.addOns} onChange={(addOns) => set({ addOns })} />
      </div>
      <div>
        <div className="mb-2 text-sm font-bold text-gray-700 dark:text-gray-200">Curriculum Types</div>
        <CurriculumTypePicker value={form.curriculumTypes} onChange={(curriculumTypes) => set({ curriculumTypes })} idPrefix="edit-account-type" />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="text-sm">
          <span className="mb-1 block font-semibold text-gray-700 dark:text-gray-200"># of Centers allowed</span>
          <input className={input} type="number" min="1" value={form.maxCenters} onChange={(e) => set({ maxCenters: e.target.value })} />
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-semibold text-gray-700 dark:text-gray-200"># of Children allowed per center (blank = no limit)</span>
          <input className={input} type="number" min="1" value={form.maxChildren} onChange={(e) => set({ maxChildren: e.target.value })} />
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-semibold text-gray-700 dark:text-gray-200">Start Date</span>
          <input className={input} type="date" value={form.startDate} onChange={(e) => set({ startDate: e.target.value })} />
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-semibold text-gray-700 dark:text-gray-200">Renewal Date</span>
          <input className={input} type="date" value={form.renewalDate} onChange={(e) => set({ renewalDate: e.target.value })} />
        </label>
      </div>
      <label className="flex items-center gap-2 text-sm text-gray-800 dark:text-gray-200">
        <input type="checkbox" checked={form.autoRenew} onChange={(e) => set({ autoRenew: e.target.checked })} />
        Auto-Renew
      </label>
      <div className="flex justify-end gap-2">
        <button type="button" className={button} onClick={onCancel} disabled={saving}>
          Cancel
        </button>
        <button type="button" className={primary} onClick={() => onSave(form)} disabled={saving}>
          {saving ? "Saving..." : "Save"}
        </button>
      </div>
    </div>
  );
}

function AddSubscriberDialog({ onClose, onCreated }) {
  const [form, setForm] = useState({
    name: "",
    centerName: "",
    address: "",
    phone: "",
    adminName: "",
    adminEmail: "",
    adminPassword: "",
    addOns: [],
    curriculumTypes: [],
    maxCenters: 1,
    maxChildren: "",
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const created = await apiJson("/api/v1/global/subscribers", { method: "POST", body: JSON.stringify(form) });
      onCreated(created);
    } catch (err) {
      setError(err.message || "Could not add the subscriber");
    } finally {
      setSaving(false);
    }
  }

  const field = (key, label, props = {}) => (
    <label className="text-sm">
      <span className="mb-1 block font-semibold text-gray-700 dark:text-gray-200">{label}</span>
      <input className={input} value={form[key]} onChange={(e) => set({ [key]: e.target.value })} {...props} />
    </label>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label="Add Subscriber">
      <form onSubmit={submit} className="max-h-[90vh] w-full max-w-2xl space-y-4 overflow-y-auto rounded-2xl bg-white p-6 shadow-xl dark:bg-gray-900">
        <h2 className="text-xl font-extrabold text-gray-900 dark:text-gray-100">Add Subscriber</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {field("name", "Business / Account Name", { required: true })}
          {field("centerName", "First Center Name (blank = same as account)")}
          {field("address", "Address")}
          {field("phone", "Phone")}
        </div>
        <div>
          <div className="mb-2 text-sm font-bold text-gray-700 dark:text-gray-200">Initial Administrator</div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {field("adminName", "Name", { required: true })}
            {field("adminEmail", "Email", { type: "email", required: true })}
            {field("adminPassword", "Temporary Password", { type: "password", minLength: 8, required: true, autoComplete: "new-password" })}
          </div>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">They'll be asked to choose their own password the first time they sign in.</p>
        </div>
        <div>
          <div className="mb-2 text-sm font-bold text-gray-700 dark:text-gray-200">Add-ons</div>
          <AddOnChecks value={form.addOns} onChange={(addOns) => set({ addOns })} />
        </div>
        <div>
          <div className="mb-2 text-sm font-bold text-gray-700 dark:text-gray-200">Curriculum Types</div>
          <CurriculumTypePicker value={form.curriculumTypes} onChange={(curriculumTypes) => set({ curriculumTypes })} idPrefix="new-account-type" />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {field("maxCenters", "# of Centers allowed", { type: "number", min: 1, required: true })}
          {field("maxChildren", "# of Children allowed per center (blank = no limit)", { type: "number", min: 1 })}
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400">New subscribers start as Pending Approval until you activate them.</p>
        {error ? <div className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-200">{error}</div> : null}
        <div className="flex justify-end gap-2">
          <button type="button" className={button} onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="submit" className={primary} disabled={saving}>
            {saving ? "Adding..." : "Add Subscriber"}
          </button>
        </div>
      </form>
    </div>
  );
}

function Detail({ id, onChanged }) {
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState("");

  useEffect(() => {
    let cancelled = false;
    setDetail(null);
    setEditing(false);
    setError("");
    apiJson(`/api/v1/global/subscribers/${id}`)
      .then((d) => !cancelled && setDetail(d))
      .catch((err) => !cancelled && setError(err.message || "Could not load the subscriber"));
    return () => {
      cancelled = true;
    };
  }, [id]);

  const patch = useCallback(
    async (body) => {
      setSaving(true);
      setError("");
      try {
        const next = await apiJson(`/api/v1/global/subscribers/${id}`, { method: "PATCH", body: JSON.stringify(body) });
        setDetail(next);
        setEditing(false);
        onChanged();
        return true;
      } catch (err) {
        setError(err.message || "Could not save");
        return false;
      } finally {
        setSaving(false);
      }
    },
    [id, onChanged],
  );

  if (error && !detail) return <div className={card}>{error}</div>;
  if (!detail) return <div className={card}>Loading...</div>;

  return (
    <div className="space-y-4">
      <div className={card}>
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-2xl font-extrabold text-gray-900 dark:text-gray-100">{detail.name}</h2>
          <StatusPill status={detail.status} />
        </div>
        <div className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          Account #: {detail.accountNumber}
          {detail.address ? ` | ${detail.address}` : ""}
          {detail.phone ? ` | ${detail.phone}` : ""}
        </div>
        {error ? <div className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-200">{error}</div> : null}
      </div>

      <div className={card}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-extrabold text-gray-900 dark:text-gray-100">Subscription</h3>
          {!editing ? (
            <button type="button" className={button} onClick={() => setEditing(true)}>
              Edit
            </button>
          ) : null}
        </div>
        {editing ? (
          <SubscriptionEditor detail={detail} saving={saving} onCancel={() => setEditing(false)} onSave={(form) => patch(form)} />
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div>
              <Row label="Plan">Base Program</Row>
              <Row label="# of Children (per center)">
                {detail.centers.length
                  ? detail.centers.map((c) => `${c.name}: ${c.childCount}`).join(", ")
                  : "0"}{" "}
                of {detail.maxChildren ?? "no limit"} each
              </Row>
              <Row label="# of Centers">
                {detail.centers.length} of {detail.maxCenters}
              </Row>
              <Row label="Start Date">{day(detail.startDate)}</Row>
              <Row label="Renewal Date">{day(detail.renewalDate)}</Row>
              <Row label="Auto-Renew">{detail.autoRenew ? "Enabled" : "Off"}</Row>
              <Row label="Curriculum Types">{curriculumTypeLabels(detail.curriculumTypes) || "None"}</Row>
            </div>
            <div>
              <div className="mb-1 text-sm font-bold text-gray-700 dark:text-gray-200">Purchased Add-Ons</div>
              {ADD_ONS.map((key) => (
                <div key={key} className="flex justify-between py-1 text-sm">
                  <span className="text-gray-800 dark:text-gray-200">{ADD_ON_LABELS[key]}</span>
                  {detail.addOns.includes(key) ? (
                    <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-bold text-green-800 dark:bg-green-900/40 dark:text-green-200">Active</span>
                  ) : (
                    <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-bold text-gray-500 dark:bg-gray-800 dark:text-gray-400">Locked</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className={card}>
        <h3 className="mb-2 text-lg font-extrabold text-gray-900 dark:text-gray-100">Centers</h3>
        {detail.centers.length ? (
          detail.centers.map((c) => (
            <Row key={c.id} label={c.name}>
              {c.childCount} children
            </Row>
          ))
        ) : (
          <p className="text-sm text-gray-500">No centers yet.</p>
        )}
      </div>

      <div className={card}>
        <h3 className="mb-2 text-lg font-extrabold text-gray-900 dark:text-gray-100">Administrator Account</h3>
        {detail.users.length ? (
          detail.users.map((u, i) => (
            <div key={u.id} className="py-1">
              {i === 0 ? <div className="text-sm font-bold text-gray-700 dark:text-gray-200">Initial Administrator</div> : null}
              <Row label="Name">{u.name || "—"}</Row>
              <Row label="Email">{u.email}</Row>
            </div>
          ))
        ) : (
          <p className="text-sm text-gray-500">No administrator yet.</p>
        )}
      </div>

      <div className={card}>
        <h3 className="mb-2 text-lg font-extrabold text-gray-900 dark:text-gray-100">Notes</h3>
        <div className="mb-3 flex gap-2">
          <input className={input} placeholder="Add a note..." value={note} onChange={(e) => setNote(e.target.value)} />
          <button
            type="button"
            className={button}
            disabled={!note.trim() || saving}
            onClick={async () => {
              if (await patch({ note })) setNote("");
            }}
          >
            Add
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-gray-500 dark:text-gray-400">
              <tr>
                <th className="py-1 pr-4">Date</th>
                <th className="py-1 pr-4">Staff</th>
                <th className="py-1">Description</th>
              </tr>
            </thead>
            <tbody>
              {detail.notes.map((n) => (
                <tr key={n.id} className="border-t border-gray-100 dark:border-gray-800">
                  <td className="whitespace-nowrap py-1.5 pr-4">
                    {new Date(n.createdAt).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}
                  </td>
                  <td className="whitespace-nowrap py-1.5 pr-4">{n.author?.name || n.author?.email || "System"}</td>
                  <td className="py-1.5">{n.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className={card}>
        <h3 className="mb-3 text-lg font-extrabold text-gray-900 dark:text-gray-100">Approval Actions</h3>
        <div className="flex flex-wrap gap-2">
          {detail.status !== "ACTIVE" ? (
            <button type="button" className={primary} disabled={saving} onClick={() => patch({ status: "ACTIVE" })}>
              Activate Subscriber
            </button>
          ) : null}
          {detail.status !== "ON_HOLD" ? (
            <button type="button" className={button} disabled={saving} onClick={() => patch({ status: "ON_HOLD" })}>
              Hold for Review
            </button>
          ) : null}
          {detail.status !== "CANCELLED" ? (
            <button type="button" className={button} disabled={saving} onClick={() => patch({ status: "CANCELLED" })}>
              Cancel Subscription
            </button>
          ) : null}
        </div>
        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
          Turning an add-on off or cancelling keeps all of the subscriber's data. It's locked, and comes back when they re-subscribe.
        </p>
      </div>
    </div>
  );
}

export default function GlobalSubscribersPage() {
  const [tab, setTab] = useState("ALL");
  const [q, setQ] = useState("");
  const [data, setData] = useState({ subscribers: [], counts: {} });
  const [selected, setSelected] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams({ status: tab, q });
      const next = await apiJson(`/api/v1/global/subscribers?${params}`);
      setData(next);
      setError("");
    } catch (err) {
      setError(err.message || "Could not load subscribers");
    }
  }, [tab, q]);

  useEffect(() => {
    const t = setTimeout(load, 200);
    return () => clearTimeout(t);
  }, [load]);

  useEffect(() => {
    if (!selected && data.subscribers.length) setSelected(data.subscribers[0].id);
  }, [data.subscribers, selected]);

  const counts = data.counts || {};
  const stats = useMemo(
    () => [
      { label: "Total Subscribers", value: counts.ALL || 0 },
      { label: "Active", value: counts.ACTIVE || 0 },
      { label: "Pending Approval", value: counts.PENDING || 0, tab: "PENDING" },
      { label: "On Hold", value: counts.ON_HOLD || 0, tab: "ON_HOLD" },
    ],
    [counts],
  );

  return (
    <GlobalLayout title="Subscribers">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-extrabold text-gray-900 dark:text-gray-100">Subscribers</h1>
        <button type="button" className={button} onClick={() => setAdding(true)}>
          + Add Subscriber
        </button>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s) => (
          <button
            key={s.label}
            type="button"
            onClick={() => s.tab && setTab(s.tab)}
            className={`${card} text-left ${s.tab ? "hover:border-blue-400" : "cursor-default"}`}
          >
            <div className="text-sm font-semibold text-gray-600 dark:text-gray-400">{s.label}</div>
            <div className="text-3xl font-extrabold text-gray-900 dark:text-gray-100">{s.value}</div>
          </button>
        ))}
      </div>

      {error ? <div className="mb-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,380px)_1fr]">
        <div className={card}>
          <input className={input} placeholder="Search by account number or name..." value={q} onChange={(e) => setQ(e.target.value)} />
          <div className="my-3 flex flex-wrap gap-1.5">
            {TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={[
                  "rounded-full border px-3 py-1 text-xs font-bold",
                  tab === t.key
                    ? "border-blue-700 bg-blue-50 text-blue-900 dark:border-blue-400 dark:bg-blue-900/40 dark:text-blue-100"
                    : "border-gray-300 text-gray-600 dark:border-gray-600 dark:text-gray-300",
                ].join(" ")}
              >
                {t.label} ({counts[t.key] || 0})
              </button>
            ))}
          </div>
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {data.subscribers.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setSelected(s.id)}
                className={[
                  "flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left",
                  selected === s.id ? "bg-blue-50 dark:bg-blue-900/30" : s.status === "PENDING" ? "bg-amber-50/60 dark:bg-amber-900/10" : "",
                ].join(" ")}
              >
                <span className="w-16 shrink-0 text-sm font-semibold text-gray-600 dark:text-gray-400">{s.accountNumber}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold text-gray-900 dark:text-gray-100">{s.name}</span>
                  {s.status !== "ACTIVE" ? <StatusPill status={s.status} /> : null}
                </span>
                <span className="text-gray-400">›</span>
              </button>
            ))}
            {!data.subscribers.length ? <p className="py-6 text-center text-sm text-gray-500">No subscribers match.</p> : null}
          </div>
        </div>

        <div>{selected ? <Detail id={selected} onChanged={load} /> : null}</div>
      </div>

      {adding ? (
        <AddSubscriberDialog
          onClose={() => setAdding(false)}
          onCreated={(created) => {
            setAdding(false);
            setTab("ALL");
            setSelected(created.id);
            load();
          }}
        />
      ) : null}
    </GlobalLayout>
  );
}
