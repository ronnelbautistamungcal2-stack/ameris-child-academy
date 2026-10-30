import {
  BLUE,
  ChildPicker,
  CollapsibleCard,
  EventCard,
  NAVY,
  card,
  childNames,
  control,
  dateKey,
  label,
  shortDate,
  timeKey,
} from "@/components/involvement/InvolvementUi";
import useSyncedCenterId from "@/hooks/useSyncedCenterId";
import { apiJson } from "@/lib/api";
import { AUDIENCES, EVENT_STATUSES } from "@/lib/parentInvolvement";
import { useCallback, useEffect, useMemo, useState } from "react";

// Staff Parent Involvement (client mockup 16-05, sheet 16 B36-B39, B75):
// Upcoming / Past events (click one to edit it), the collapsible Create / Edit
// Event panel, and the collapsible Volunteer Tracking table with an export
// that carries each parent's e-signature. HR gets the page without Volunteer
// Tracking (showTracking false).

const STATUS_TONE = { ACTIVE: "bg-emerald-100 text-emerald-800", PLANNING: "bg-amber-100 text-amber-800" };
const blankEvent = () => ({
  id: "",
  title: "",
  description: "",
  date: "",
  startTime: "",
  endTime: "",
  location: "",
  status: "ACTIVE",
  audience: ["ALL"],
  classRoomIds: [],
  roles: [{ id: "", name: "", description: "", needed: 1 }],
  details: "",
});

function eventForm(ev) {
  return {
    id: ev.id,
    title: ev.title || "",
    description: ev.description || "",
    date: dateKey(ev.startsAt),
    startTime: timeKey(ev.startsAt),
    endTime: timeKey(ev.endsAt),
    location: ev.location || "",
    status: ev.status || "ACTIVE",
    audience: ev.audience?.length ? ev.audience : ["ALL"],
    classRoomIds: ev.classRoomIds || [],
    roles: (ev.roles?.length ? ev.roles : [{ name: "", description: "", needed: 1 }]).map((r) => ({ id: r.id || "", name: r.name, description: r.description || "", needed: r.needed || 0 })),
    details: ev.details || "",
  };
}

export default function InvolvementWorkspace({ showTracking = true }) {
  const [centers, setCenters] = useState([]);
  const [centerId, setCenterId] = useState("");
  const [view, setView] = useState("upcoming");
  const [events, setEvents] = useState(null);
  const [classrooms, setClassrooms] = useState([]);
  const [form, setForm] = useState(blankEvent);
  const [formOpen, setFormOpen] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);

  useSyncedCenterId(centerId, setCenterId, centers);

  useEffect(() => {
    apiJson("/api/v1/centers")
      .then((list) => {
        const rows = Array.isArray(list) ? list : [];
        setCenters(rows);
        if (rows.length === 1) setCenterId(rows[0].id);
      })
      .catch(() => {});
  }, []);

  const loadEvents = useCallback(async () => {
    if (!centerId) return;
    try {
      setEvents(await apiJson(`/api/v1/parent-involvement/activities?centerId=${encodeURIComponent(centerId)}${view === "past" ? "&view=past" : ""}`));
    } catch (e) {
      setError(e.message || "Failed to load events");
    }
  }, [centerId, view]);

  useEffect(() => {
    setEvents(null);
    loadEvents();
  }, [loadEvents]);

  useEffect(() => {
    if (!centerId) return;
    setForm(blankEvent());
    apiJson(`/api/v1/classes?centerId=${encodeURIComponent(centerId)}`)
      .then((rows) => setClassrooms(Array.isArray(rows) ? rows : []))
      .catch(() => setClassrooms([]));
  }, [centerId]);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const setRole = (i, patch) => setForm((f) => ({ ...f, roles: f.roles.map((r, j) => (j === i ? { ...r, ...patch } : r)) }));
  function toggleAudience(value) {
    setForm((f) => {
      let next = f.audience.includes(value) ? f.audience.filter((a) => a !== value) : [...f.audience.filter((a) => (value === "ALL" ? false : a !== "ALL")), value];
      if (value === "ALL" && !f.audience.includes("ALL")) next = ["ALL"];
      return { ...f, audience: next };
    });
  }

  function editEvent(ev) {
    setForm(eventForm(ev));
    setFormOpen(true);
    setNotice("");
    setError("");
  }

  async function saveEvent(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const body = JSON.stringify(form);
      if (form.id) await apiJson(`/api/v1/parent-involvement/activities/${form.id}`, { method: "PUT", body });
      else await apiJson(`/api/v1/parent-involvement/activities?centerId=${encodeURIComponent(centerId)}`, { method: "POST", body });
      setNotice(form.id ? "Event updated." : "Event created.");
      setForm(blankEvent());
      loadEvents();
    } catch (err) {
      setError(err.message || "Failed to save the event");
    } finally {
      setSaving(false);
    }
  }

  async function deleteEvent() {
    if (!form.id || !window.confirm(`Remove "${form.title}"? Logged volunteer time is kept.`)) return;
    try {
      await apiJson(`/api/v1/parent-involvement/activities/${form.id}`, { method: "DELETE" });
      setForm(blankEvent());
      loadEvents();
    } catch (err) {
      setError(err.message || "Failed to remove the event");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className={`text-4xl font-black ${NAVY}`} style={{ fontFamily: "Georgia, serif" }}>Parent Involvement</h1>
        <select value={centerId} onChange={(e) => setCenterId(e.target.value)} aria-label="Center" className={`${control} w-56`}>
          <option value="">Select a center...</option>
          {centers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
      {error ? <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
      {notice ? <div role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{notice}</div> : null}
      {!centerId ? (
        <div className={`${card} text-sm text-gray-600`}>Choose a center to manage its volunteer events.</div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
          <div className="min-w-0 space-y-4">
            <section className={card}>
              <div className="flex items-center justify-between gap-3">
                <h2 className={`text-2xl font-black ${NAVY}`}>{view === "past" ? "Past Events" : "Upcoming Events"}</h2>
                <div className="inline-flex rounded-lg border border-gray-200 p-0.5 dark:border-gray-700" role="tablist">
                  {[
                    ["upcoming", "Upcoming"],
                    ["past", "Past"],
                  ].map(([key, text]) => (
                    <button key={key} type="button" role="tab" aria-selected={view === key} onClick={() => setView(key)} className={`rounded-md px-4 py-1 text-sm font-semibold ${view === key ? "bg-[#1d4ed8] text-white" : "text-gray-600 dark:text-gray-300"}`}>
                      {text}
                    </button>
                  ))}
                </div>
              </div>
              <div className="mt-3 space-y-2">
                {!events ? (
                  <div className="text-sm text-gray-500">Loading...</div>
                ) : events.length ? (
                  events.map((ev) => (
                    <EventCard
                      key={ev.id}
                      event={ev}
                      selected={form.id === ev.id}
                      onOpen={() => editEvent(ev)}
                      action={<span className={`shrink-0 rounded px-2 py-0.5 text-xs font-bold ${STATUS_TONE[ev.status] || STATUS_TONE.ACTIVE}`}>{EVENT_STATUSES.find((s) => s.value === ev.status)?.label || "Active"}</span>}
                    />
                  ))
                ) : (
                  <div className="rounded-lg bg-gray-50 px-3 py-6 text-center text-sm text-gray-500 dark:bg-gray-800">{view === "past" ? "No past events." : "No upcoming events. Create one on the right."}</div>
                )}
              </div>
            </section>
            {showTracking ? <VolunteerTracking centerId={centerId} /> : null}
          </div>

          <CollapsibleCard title={form.id ? "Edit Event" : "Create / Edit Event"} open={formOpen} onToggle={() => setFormOpen((o) => !o)} className="self-start">
            <form onSubmit={saveEvent} className="space-y-3">
              <label className={label}>Event Name <span className="text-red-600">*</span>
                <input value={form.title} onChange={(e) => set({ title: e.target.value })} placeholder="Enter event name" className={`${control} mt-1`} />
              </label>
              <label className={label}>Description <span className="text-red-600">*</span>
                <textarea value={form.description} onChange={(e) => set({ description: e.target.value })} rows={2} placeholder="Describe the event, purpose, and details..." className={`${control} mt-1`} />
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label className={label}>Date <span className="text-red-600">*</span>
                  <input type="date" value={form.date} onChange={(e) => set({ date: e.target.value })} className={`${control} mt-1`} />
                </label>
                <label className={label}>Status
                  <select value={form.status} onChange={(e) => set({ status: e.target.value })} className={`${control} mt-1`}>
                    {EVENT_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </label>
                <label className={label}>Start Time <span className="text-red-600">*</span>
                  <input type="time" value={form.startTime} onChange={(e) => set({ startTime: e.target.value })} className={`${control} mt-1`} />
                </label>
                <label className={label}>End Time <span className="text-red-600">*</span>
                  <input type="time" value={form.endTime} onChange={(e) => set({ endTime: e.target.value })} className={`${control} mt-1`} />
                </label>
              </div>
              <label className={label}>Location <span className="text-red-600">*</span>
                <input value={form.location} onChange={(e) => set({ location: e.target.value })} placeholder="Enter location (e.g., playground, classroom, etc.)" className={`${control} mt-1`} />
              </label>
              <fieldset>
                <legend className={label}>Target Audience <span className="text-red-600">*</span></legend>
                <div className="mt-1 grid grid-cols-2 gap-1 text-sm">
                  {AUDIENCES.map((a) => (
                    <label key={a.value} className="flex items-center gap-2">
                      <input type="checkbox" checked={form.audience.includes(a.value)} onChange={() => toggleAudience(a.value)} />
                      {a.label}
                    </label>
                  ))}
                </div>
                {form.audience.includes("CLASSROOMS") ? (
                  <div className="mt-2 grid grid-cols-2 gap-1 rounded-lg border border-gray-200 p-2 text-sm dark:border-gray-700">
                    {classrooms.map((c) => (
                      <label key={c.id} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={form.classRoomIds.includes(c.id)}
                          onChange={() => set({ classRoomIds: form.classRoomIds.includes(c.id) ? form.classRoomIds.filter((x) => x !== c.id) : [...form.classRoomIds, c.id] })}
                        />
                        {c.name}
                      </label>
                    ))}
                    {!classrooms.length ? <span className="text-gray-500">No classrooms at this center.</span> : null}
                  </div>
                ) : null}
              </fieldset>
              <fieldset>
                <legend className={label}>Volunteer Roles Needed <span className="text-red-600">*</span></legend>
                <table className="mt-1 w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs font-bold text-gray-600 dark:text-gray-300">
                      <th className="pb-1 pr-1">Role / Task</th>
                      <th className="pb-1 pr-1">Description (Optional)</th>
                      <th className="w-16 pb-1 pr-1">Needed</th>
                      <th className="w-8 pb-1"><span className="sr-only">Remove</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {form.roles.map((r, i) => (
                      <tr key={i}>
                        <td className="pb-1 pr-1"><input value={r.name} onChange={(e) => setRole(i, { name: e.target.value })} aria-label={`Role ${i + 1}`} className={control} /></td>
                        <td className="pb-1 pr-1"><input value={r.description} onChange={(e) => setRole(i, { description: e.target.value })} aria-label={`Role ${i + 1} description`} className={control} /></td>
                        <td className="pb-1 pr-1"><input type="number" min="0" value={r.needed} onChange={(e) => setRole(i, { needed: e.target.value })} aria-label={`Role ${i + 1} needed`} className={control} /></td>
                        <td className="pb-1 text-center">
                          <button type="button" onClick={() => set({ roles: form.roles.filter((_, j) => j !== i) })} disabled={form.roles.length === 1} aria-label={`Remove role ${i + 1}`} className="text-red-600 disabled:opacity-30">🗑</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <button type="button" onClick={() => set({ roles: [...form.roles, { id: "", name: "", description: "", needed: 1 }] })} className={`mt-1 rounded-lg border-2 border-[#1d4ed8] px-3 py-1 text-xs font-bold ${BLUE}`}>+ Add Role</button>
              </fieldset>
              <label className={label}>Additional Details (Optional)
                <textarea value={form.details} onChange={(e) => set({ details: e.target.value })} rows={2} placeholder="Add any other important information..." className={`${control} mt-1`} />
              </label>
              <div className="flex flex-wrap justify-end gap-2">
                {form.id ? <button type="button" onClick={deleteEvent} className="mr-auto rounded-lg px-3 py-2 text-sm font-semibold text-red-600">Remove Event</button> : null}
                <button type="button" onClick={() => setForm(blankEvent())} className="rounded-lg border-2 border-[#0b2a5b] px-5 py-2 text-sm font-bold text-[#0b2a5b] dark:text-blue-100">Cancel</button>
                <button type="submit" disabled={saving} className="rounded-lg bg-[#1d4ed8] px-5 py-2 text-sm font-bold text-white disabled:opacity-60">{saving ? "Saving..." : "Save Event"}</button>
              </div>
            </form>
          </CollapsibleCard>
        </div>
      )}
    </div>
  );
}

const csvCell = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;

function VolunteerTracking({ centerId }) {
  const [open, setOpen] = useState(true);
  const [rows, setRows] = useState(null);
  const [parents, setParents] = useState([]);
  const [activities, setActivities] = useState([]);
  const [filters, setFilters] = useState({ date: "", parentId: "", activityId: "" });
  const [draft, setDraft] = useState({ date: "", activityId: "", parentId: "", childIds: [], hours: "", notes: "" });
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const q = `centerId=${encodeURIComponent(centerId)}`;
    try {
      const [entries, people, upcoming, past] = await Promise.all([
        apiJson(`/api/v1/parent-involvement?${q}&kind=LOG`),
        apiJson(`/api/v1/billing/parents?${q}`).catch(() => []),
        apiJson(`/api/v1/parent-involvement/activities?${q}`).catch(() => []),
        apiJson(`/api/v1/parent-involvement/activities?${q}&view=past`).catch(() => []),
      ]);
      setRows(entries);
      setParents(people);
      setActivities([...past, ...upcoming]);
      setError("");
    } catch (e) {
      setError(e.message || "Failed to load volunteer tracking");
    }
  }, [centerId]);

  useEffect(() => {
    load();
  }, [load]);

  const shown = useMemo(
    () =>
      (rows || []).filter(
        (r) => (!filters.date || dateKey(r.occurredAt) === filters.date) && (!filters.parentId || r.parent?.id === filters.parentId) && (!filters.activityId || r.activity?.id === filters.activityId),
      ),
    [rows, filters],
  );
  const draftParent = parents.find((p) => p.id === draft.parentId);

  async function addRow() {
    try {
      await apiJson("/api/v1/parent-involvement", { method: "POST", body: JSON.stringify(draft) });
      setDraft({ date: "", activityId: "", parentId: "", childIds: [], hours: "", notes: "" });
      load();
    } catch (e) {
      setError(e.message || "Failed to add the row");
    }
  }

  async function remove(row) {
    if (!window.confirm(`Delete ${row.parent?.name || "this"} volunteer entry for ${row.activity?.title}?`)) return;
    try {
      await apiJson(`/api/v1/parent-involvement/${row.id}`, { method: "DELETE" });
      setRows((list) => list.filter((r) => r.id !== row.id));
    } catch (e) {
      setError(e.message || "Failed to delete");
    }
  }

  // Excel-friendly CSV with the parent's e-signature on every row (B39).
  function exportCsv() {
    const header = ["Date", "Activity", "Parent", "Child(ren)", "Hours", "Notes", "E-Signature", "Signed On", "Certification"];
    const lines = shown.map((r) =>
      [
        shortDate(r.occurredAt),
        r.activity?.title,
        r.parent?.name || r.parent?.email,
        childNames(r),
        r.hours != null ? r.hours.toFixed(2) : "",
        r.notes,
        r.signature?.signedName || (r.enteredById ? "Entered by staff" : ""),
        r.signature?.signedAt ? new Date(r.signature.signedAt).toLocaleString("en-US") : "",
        r.signature?.statement || "",
      ]
        .map(csvCell)
        .join(","),
    );
    const blob = new Blob([[header.map(csvCell).join(","), ...lines].join("\r\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `volunteer-tracking-${dateKey(new Date())}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const cell = "px-2 py-1.5";
  return (
    <CollapsibleCard title="Volunteer Tracking" open={open} onToggle={() => setOpen((o) => !o)}>
      <div className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end">
        <label className={label}>Date
          <input type="date" value={filters.date} onChange={(e) => setFilters((f) => ({ ...f, date: e.target.value }))} className={`${control} mt-1`} />
        </label>
        <label className={label}>Family
          <select value={filters.parentId} onChange={(e) => setFilters((f) => ({ ...f, parentId: e.target.value }))} className={`${control} mt-1`}>
            <option value="">All Families</option>
            {parents.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
        <label className={label}>Event
          <select value={filters.activityId} onChange={(e) => setFilters((f) => ({ ...f, activityId: e.target.value }))} className={`${control} mt-1`}>
            <option value="">All Events</option>
            {activities.map((a) => <option key={a.id} value={a.id}>{a.title}</option>)}
          </select>
        </label>
        <button type="button" onClick={exportCsv} disabled={!shown.length} className={`rounded-lg border-2 border-[#1d4ed8] px-4 py-2 text-sm font-bold disabled:opacity-40 ${BLUE}`}>⭳ Export</button>
      </div>
      {error ? <div role="alert" className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[820px] text-sm">
          <thead className="bg-blue-50 dark:bg-gray-800">
            <tr className={`text-left text-xs font-bold ${NAVY}`}>
              <th className={cell}>Date</th>
              <th className={cell}>Activity</th>
              <th className={cell}>Parent</th>
              <th className={cell}>Child(ren)</th>
              <th className={cell}>Hours</th>
              <th className={cell}>Notes</th>
              <th className={cell}>E-Signature</th>
              <th className={`${cell} text-center`}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {!rows ? (
              <tr><td colSpan={8} className="px-3 py-4 text-gray-500">Loading...</td></tr>
            ) : shown.length ? (
              shown.map((r) => (
                <tr key={r.id} className={`border-t border-gray-100 dark:border-gray-800 ${BLUE}`}>
                  <td className={cell}>{shortDate(r.occurredAt)}</td>
                  <td className={cell}>{r.activity?.title}</td>
                  <td className={cell}>{r.parent?.name || r.parent?.email}</td>
                  <td className={cell}>{childNames(r)}</td>
                  <td className={cell}>{r.hours != null ? r.hours.toFixed(1) : "—"}</td>
                  <td className={cell}>{r.notes || ""}</td>
                  <td className={`${cell} text-xs`}>{r.signature?.signedName ? `${r.signature.signedName} (${shortDate(r.signature.signedAt)})` : r.enteredById ? "Entered by staff" : "—"}</td>
                  <td className={`${cell} text-center`}>
                    <button type="button" onClick={() => remove(r)} aria-label={`Delete entry for ${r.activity?.title}`} className="text-red-600">🗑</button>
                  </td>
                </tr>
              ))
            ) : (
              <tr><td colSpan={8} className="px-3 py-4 text-center text-gray-500">No volunteer time logged{filters.date || filters.parentId || filters.activityId ? " for these filters" : " yet"}.</td></tr>
            )}
            <tr className="border-t border-gray-200 dark:border-gray-700">
              <td className={cell}><input type="date" value={draft.date} onChange={(e) => setDraft((d) => ({ ...d, date: e.target.value }))} aria-label="New entry date" className={control} /></td>
              <td className={cell}>
                <select value={draft.activityId} onChange={(e) => setDraft((d) => ({ ...d, activityId: e.target.value }))} aria-label="New entry activity" className={control}>
                  <option value="">Activity</option>
                  {activities.map((a) => <option key={a.id} value={a.id}>{a.title}</option>)}
                </select>
              </td>
              <td className={cell}>
                <select value={draft.parentId} onChange={(e) => setDraft((d) => ({ ...d, parentId: e.target.value, childIds: [] }))} aria-label="New entry parent" className={control}>
                  <option value="">Parent</option>
                  {parents.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </td>
              <td className={cell}>
                <ChildPicker
                  id="tracking-children"
                  options={(draftParent?.children || []).map((c) => ({ id: c.id, firstName: c.name.split(" ")[0], lastName: c.name.split(" ").slice(1).join(" ") }))}
                  value={draft.childIds}
                  onChange={(childIds) => setDraft((d) => ({ ...d, childIds }))}
                  placeholder="Child(ren)"
                />
              </td>
              <td className={cell}><input type="number" min="0" step="0.25" value={draft.hours} onChange={(e) => setDraft((d) => ({ ...d, hours: e.target.value }))} aria-label="New entry hours" className={`${control} w-20`} /></td>
              <td className={cell}><input value={draft.notes} onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))} aria-label="New entry notes" className={control} /></td>
              <td className={cell} />
              <td className={`${cell} text-center`}>
                <button type="button" onClick={addRow} className="rounded-lg bg-[#1d4ed8] px-3 py-1.5 text-xs font-bold text-white">Add</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </CollapsibleCard>
  );
}
