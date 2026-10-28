import AdminLayout from "@/components/admin/AdminLayout";
import { Modal } from "@/components/training/trainingUi";
import Skeleton from "@/components/ui/Skeleton";
import useSyncedCenterId from "@/hooks/useSyncedCenterId";
import { AGE_GROUPS } from "@/lib/ageUtils";
import { apiJson } from "@/lib/api";
import { COMPLIANCE_CATEGORIES, FREQUENCIES, STATUS_META } from "@/lib/complianceRequirements";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

// Admin Compliance Alerts (client mockups 37-01/02): requirements grouped by
// category with overdue / due-soon counts, a checkbox to mark one done (its
// next due date moves on by its frequency) and the Add Requirement popup.
// The teacher logging alerts that used to live here stay one tab over.

const NAVY = "text-[#0b2a5b] dark:text-blue-100";
const control = "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800";
const ROLES = [
  { value: "ADMIN", label: "Admins" },
  { value: "COACH", label: "Coaches / Directors" },
  { value: "TEACHER", label: "Teachers" },
  { value: "PARENT", label: "Parents" },
];
const RANGES = [
  { value: "", label: "All Dates" },
  { value: "PAST", label: "Past due" },
  { value: "30", label: "Next 30 days" },
  { value: "90", label: "Next 90 days" },
];
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const fmt = (key) => new Date(`${key}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
const daysUntil = (key) => {
  const today = new Date();
  return Math.round((new Date(`${key}T00:00:00`) - new Date(today.getFullYear(), today.getMonth(), today.getDate())) / 86400000);
};
const frequencyLabel = (v) => FREQUENCIES.find((f) => f.value === v)?.label || v;
const categoryIcon = (c) => COMPLIANCE_CATEGORIES.find((x) => x.value === c)?.icon || "📋";

export default function ComplianceAlertsPage() {
  const [centers, setCenters] = useState([]);
  const [centerId, setCenterId] = useState("");
  const [rows, setRows] = useState(null);
  const [status, setStatus] = useState("");
  const [range, setRange] = useState("");
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(null);
  const [collapsed, setCollapsed] = useState({});

  useSyncedCenterId(centerId, setCenterId, centers);

  useEffect(() => {
    apiJson("/api/v1/centers")
      .then((list) => setCenters(Array.isArray(list) ? list : []))
      .catch(() => {});
  }, []);

  const load = useCallback(async () => {
    try {
      setRows(await apiJson(`/api/v1/compliance/requirements${centerId ? `?centerId=${encodeURIComponent(centerId)}` : ""}`));
      setError("");
    } catch (e) {
      setError(e.message || "Failed to load compliance requirements");
    }
  }, [centerId]);

  useEffect(() => {
    load();
  }, [load]);

  const tiles = useMemo(() => {
    const count = (s) => (rows || []).filter((r) => r.status === s).length;
    return { OVERDUE: count("OVERDUE"), DUE_SOON: count("DUE_SOON"), UPCOMING: count("UPCOMING"), COMPLETED: count("COMPLETED") };
  }, [rows]);

  const groups = useMemo(() => {
    const filtered = (rows || []).filter((r) => {
      if (status && r.status !== status) return false;
      const days = daysUntil(r.nextDue);
      if (range === "PAST" && !(days < 0)) return false;
      if (range && range !== "PAST" && !(days >= 0 && days <= Number(range))) return false;
      return true;
    });
    const order = COMPLIANCE_CATEGORIES.map((c) => c.value);
    const byCategory = new Map();
    for (const r of filtered) byCategory.set(r.category, [...(byCategory.get(r.category) || []), r]);
    return [...byCategory.entries()].sort(([a], [b]) => {
      const ia = order.indexOf(a), ib = order.indexOf(b);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.localeCompare(b);
    });
  }, [rows, status, range]);

  async function act(row, body, method = "PUT") {
    try {
      if (method === "DELETE") {
        await apiJson(`/api/v1/compliance/requirements/${row.id}`, { method: "DELETE" });
        setRows((list) => list.filter((r) => r.id !== row.id));
      } else {
        const updated = await apiJson(`/api/v1/compliance/requirements/${row.id}`, { method, body: JSON.stringify(body) });
        setRows((list) => list.map((r) => (r.id === row.id ? updated : r)));
      }
      setError("");
    } catch (e) {
      setError(e.message || "Failed to update the requirement");
    }
  }

  function remove(row) {
    if (window.confirm(`Delete "${row.name}"?`)) act(row, null, "DELETE");
  }

  return (
    <AdminLayout title="Compliance Alerts">
      <div className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h1 className={`text-3xl font-black ${NAVY}`} style={{ fontFamily: "Georgia, serif" }}>Compliance Alerts</h1>
          <select value={centerId} onChange={(e) => setCenterId(e.target.value)} aria-label="Center" className={`${control} w-56`}>
            <option value="">All Centers</option>
            {centers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="flex gap-6 border-b border-gray-200 text-sm font-semibold dark:border-gray-700">
          <span className="border-b-2 border-[#0b2a5b] pb-2 text-[#0b2a5b] dark:border-blue-200 dark:text-blue-100">Requirements</span>
          <Link href="/admin/teacher-logging-alerts" className="pb-2 text-gray-500 hover:text-gray-800 dark:text-gray-400">Teacher Logging Alerts</Link>
        </div>
        {error ? <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            ["!", "OVERDUE", "Overdue", "bg-red-50", "bg-red-500"],
            ["🕒", "DUE_SOON", "Due Soon (within 30 days)", "bg-amber-50", "bg-amber-400"],
            ["📄", "UPCOMING", "Upcoming", "bg-blue-50", "bg-blue-500"],
            ["✓", "COMPLETED", "Completed", "bg-emerald-50", "bg-emerald-500"],
          ].map(([icon, key, label, tone, dot]) => (
            <button key={key} type="button" onClick={() => setStatus(status === key ? "" : key)} aria-pressed={status === key} className={`flex items-center gap-3 rounded-xl p-4 text-left ${tone} ${status === key ? "ring-2 ring-[#0b2a5b]" : ""} dark:bg-gray-800`}>
              <span className={`flex h-11 w-11 items-center justify-center rounded-full ${dot} text-xl font-black text-white`} aria-hidden="true">{icon}</span>
              <span className="flex-1">
                <span className={`block text-2xl font-black ${NAVY}`}>{rows ? tiles[key] : "—"}</span>
                <span className="text-sm text-[#0b2a5b] dark:text-blue-100">{label}</span>
              </span>
              <span className="text-xl text-[#0b2a5b]" aria-hidden="true">›</span>
            </button>
          ))}
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_auto_auto] lg:items-end">
          <label className="text-sm font-semibold text-gray-700 dark:text-gray-200">Status
            <select value={status} onChange={(e) => setStatus(e.target.value)} className={`${control} mt-1`}>
              <option value="">All Statuses</option>
              {Object.entries(STATUS_META).map(([k, m]) => <option key={k} value={k}>{m.label}</option>)}
            </select>
          </label>
          <label className="text-sm font-semibold text-gray-700 dark:text-gray-200">Due Date
            <select value={range} onChange={(e) => setRange(e.target.value)} className={`${control} mt-1`}>
              {RANGES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </label>
          <button type="button" onClick={() => { setStatus(""); setRange(""); }} className="rounded-lg border border-[#0b2a5b] px-5 py-2 text-sm font-semibold text-[#0b2a5b] dark:border-blue-200 dark:text-blue-100">Clear Filters</button>
          <button type="button" onClick={() => setEditing({})} className="rounded-lg bg-[#0b2a5b] px-5 py-2 text-sm font-bold text-white hover:bg-[#123a7a]">+ Add Requirement</button>
        </div>

        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
          {!rows ? (
            <div className="p-4"><Skeleton className="h-40 w-full" /></div>
          ) : (
            <table className="w-full min-w-[900px] text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-xs font-bold text-[#0b2a5b] dark:border-gray-700 dark:text-blue-100">
                  <th className="w-10 px-3 py-2"><span className="sr-only">Done</span></th>
                  <th className="px-2 py-2">Requirement</th>
                  <th className="px-2 py-2">Frequency</th>
                  <th className="px-2 py-2">Next Due</th>
                  <th className="px-2 py-2">Status</th>
                  <th className="px-2 py-2">Progress</th>
                  <th className="px-2 py-2">Notes</th>
                  <th className="px-3 py-2 text-right">Actions</th>
                </tr>
              </thead>
              {groups.length === 0 ? (
                <tbody><tr><td colSpan={8} className="px-4 py-8 text-center text-gray-500">{rows.length ? "No requirements match these filters." : "No compliance requirements yet. Use Add Requirement to start the list."}</td></tr></tbody>
              ) : (
                groups.map(([category, items]) => {
                  const overdue = items.filter((r) => r.status === "OVERDUE").length;
                  const soon = items.filter((r) => r.status === "DUE_SOON").length;
                  const open = !collapsed[category];
                  return (
                    <tbody key={category} className="border-b border-blue-200 dark:border-gray-700">
                      <tr>
                        <td colSpan={8} className="px-3 py-2">
                          <button type="button" onClick={() => setCollapsed((c) => ({ ...c, [category]: open }))} aria-expanded={open} className="flex w-full items-center gap-2 text-left">
                            <span aria-hidden="true">{categoryIcon(category)}</span>
                            <span className={`font-bold ${NAVY}`}>{category}</span>
                            {overdue ? <span className="rounded bg-red-100 px-2 py-0.5 text-xs text-red-700">{overdue} overdue</span> : null}
                            {soon ? <span className="rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-800">{soon} due soon</span> : null}
                            <span className="ml-auto text-gray-500" aria-hidden="true">{open ? "⌄" : "›"}</span>
                          </button>
                        </td>
                      </tr>
                      {open &&
                        items.map((r) => {
                          const meta = STATUS_META[r.status];
                          const done = r.status === "COMPLETED";
                          return (
                            <tr key={r.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                              <td className="px-3 py-1.5">
                                <input
                                  type="checkbox"
                                  checked={done}
                                  onChange={() => act(r, { action: done ? "undo" : "complete" })}
                                  aria-label={`Mark ${r.name} ${done ? "not done" : "complete"}`}
                                  className="h-4 w-4"
                                />
                              </td>
                              <td className="px-2 py-1.5 text-gray-800 dark:text-gray-100" title={r.description || undefined}>{r.name}</td>
                              <td className="px-2 py-1.5">{frequencyLabel(r.frequency)}</td>
                              <td className="px-2 py-1.5 text-[#0b2a5b] dark:text-blue-100">{fmt(r.nextDue)}</td>
                              <td className={`px-2 py-1.5 ${meta.text}`}><span className={`mr-1.5 inline-block h-2 w-2 rounded-full ${meta.dot}`} aria-hidden="true" />{meta.label}</td>
                              <td className="px-2 py-1.5">
                                <span className="mr-2">{r.progress.done}/{r.progress.total}</span>
                                <span className="inline-block h-1.5 w-24 rounded bg-gray-200 align-middle dark:bg-gray-700">
                                  <span className="block h-1.5 rounded bg-[#1d5fd1]" style={{ width: `${(r.progress.done / r.progress.total) * 100}%` }} />
                                </span>
                              </td>
                              <td className="max-w-[16rem] truncate px-2 py-1.5 text-gray-600 dark:text-gray-300" title={r.notes || undefined}>{r.notes || ""}</td>
                              <td className="whitespace-nowrap px-3 py-1.5 text-right">
                                <button type="button" onClick={() => setEditing(r)} aria-label={`Edit ${r.name}`} className="px-1 text-[#1d5fd1]">✎</button>
                                <button type="button" onClick={() => remove(r)} aria-label={`Delete ${r.name}`} className="px-1 text-red-600">🗑</button>
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  );
                })
              )}
            </table>
          )}
        </div>
      </div>
      {editing ? (
        <RequirementDialog
          requirement={editing}
          centerId={centerId}
          onClose={() => setEditing(null)}
          onSaved={(saved) => {
            setRows((list) => (list.some((r) => r.id === saved.id) ? list.map((r) => (r.id === saved.id ? saved : r)) : [...list, saved]));
            setEditing(null);
          }}
        />
      ) : null}
    </AdminLayout>
  );
}

function RequirementDialog({ requirement, centerId, onClose, onSaved }) {
  const isNew = !requirement.id;
  const [form, setForm] = useState(() => ({
    name: requirement.name || "",
    description: requirement.description || "",
    category: requirement.category || "",
    frequency: requirement.frequency || "MONTHLY",
    repeatOn: requirement.repeatOn ?? "",
    nextDue: requirement.nextDue || "",
    appliesToRoles: requirement.appliesToRoles || [],
    ageGroups: requirement.ageGroups || [],
    notes: requirement.notes || "",
  }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const weekly = form.frequency === "WEEKLY";
  const once = form.frequency === "ONCE";

  async function save() {
    setSaving(true);
    try {
      const body = JSON.stringify({ ...form, repeatOn: once ? null : form.repeatOn, ...(isNew ? { centerId: centerId || null } : {}) });
      const saved = isNew
        ? await apiJson("/api/v1/compliance/requirements", { method: "POST", body })
        : await apiJson(`/api/v1/compliance/requirements/${requirement.id}`, { method: "PUT", body });
      onSaved(saved);
    } catch (e) {
      setError(e.message || "Failed to save the requirement");
      setSaving(false);
    }
  }

  const label = "block text-sm font-semibold text-gray-800 dark:text-gray-100";
  return (
    <Modal
      title={isNew ? "Add Requirement" : "Edit Requirement"}
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} className="rounded-lg border border-[#0b2a5b] px-5 py-2 text-sm font-semibold text-[#0b2a5b] dark:text-blue-100">Cancel</button>
          <button type="button" onClick={save} disabled={saving} className="rounded-lg bg-[#1d5fd1] px-5 py-2 text-sm font-bold text-white disabled:opacity-60">{saving ? "Saving..." : "Save Requirement"}</button>
        </>
      }
    >
      <div className="space-y-3">
        {error ? <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
        <label className={label}>Requirement Name <span className="text-red-600">*</span>
          <input value={form.name} onChange={set("name")} placeholder="Enter requirement name..." className={`${control} mt-1`} />
        </label>
        <label className={label}>Description
          <textarea value={form.description} onChange={set("description")} rows={2} placeholder="Enter a description (optional)..." className={`${control} mt-1`} />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className={label}>Category <span className="text-red-600">*</span>
            <select value={form.category} onChange={set("category")} className={`${control} mt-1`}>
              <option value="">Select a category...</option>
              {COMPLIANCE_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.value}</option>)}
            </select>
          </label>
          <label className={label}>Next Due Date <span className="text-red-600">*</span>
            <input type="date" value={form.nextDue} onChange={set("nextDue")} className={`${control} mt-1`} />
          </label>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className={label}>Frequency <span className="text-red-600">*</span>
            <select value={form.frequency} onChange={(e) => setForm((f) => ({ ...f, frequency: e.target.value, repeatOn: "" }))} className={`${control} mt-1`}>
              {FREQUENCIES.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
            </select>
          </label>
          <label className={label}>Repeat On
            <select value={form.repeatOn} onChange={set("repeatOn")} disabled={once} className={`${control} mt-1 disabled:opacity-50`}>
              <option value="">{weekly ? "Same weekday" : "Same day of month"}</option>
              {weekly
                ? WEEKDAYS.map((d, i) => <option key={d} value={i}>{d}</option>)
                : Array.from({ length: 31 }, (_, i) => <option key={i + 1} value={i + 1}>Day {i + 1}{i === 30 ? " (or last day)" : ""}</option>)}
            </select>
          </label>
        </div>
        <p className="rounded-lg bg-blue-50 px-3 py-2 text-xs text-[#0b2a5b] dark:bg-gray-800 dark:text-blue-100">
          {once ? "A one-time requirement stays completed once it is checked off." : "After this requirement is marked as completed, the next due date will automatically be set based on this repeat schedule."}
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <ChecklistSelect label="Applies To (Roles)" all="All Roles" options={ROLES} value={form.appliesToRoles} onChange={(v) => setForm((f) => ({ ...f, appliesToRoles: v }))} />
          <ChecklistSelect label="Age Group(s)" all="All Age Groups" options={AGE_GROUPS.map((g) => ({ value: g.key, label: g.label }))} value={form.ageGroups} onChange={(v) => setForm((f) => ({ ...f, ageGroups: v }))} />
        </div>
        <label className={label}>Notes
          <textarea value={form.notes} onChange={set("notes")} rows={2} placeholder="Add any additional notes (optional)..." className={`${control} mt-1`} />
        </label>
      </div>
    </Modal>
  );
}

/** A dropdown of checkboxes; nothing ticked means "all". */
function ChecklistSelect({ label, all, options, value, onChange }) {
  const [open, setOpen] = useState(false);
  const box = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => box.current && !box.current.contains(e.target) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);
  const summary = value.length ? options.filter((o) => value.includes(o.value)).map((o) => o.label).join(", ") : all;
  const toggle = (v) => onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);
  return (
    <div ref={box} className="relative">
      <span className="block text-sm font-semibold text-gray-800 dark:text-gray-100">{label}</span>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label={label} className={`${control} mt-1 truncate text-left`}>{summary}</button>
      {open ? (
        <div className="absolute z-10 mt-1 w-full rounded-lg border border-gray-200 bg-white p-2 shadow-lg dark:border-gray-700 dark:bg-gray-800">
          <label className="flex items-center gap-2 px-1 py-1 text-sm">
            <input type="checkbox" checked={!value.length} onChange={() => onChange([])} /> {all}
          </label>
          {options.map((o) => (
            <label key={o.value} className="flex items-center gap-2 px-1 py-1 text-sm">
              <input type="checkbox" checked={value.includes(o.value)} onChange={() => toggle(o.value)} /> {o.label}
            </label>
          ))}
        </div>
      ) : null}
    </div>
  );
}
