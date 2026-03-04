import AdminLayout from "@/components/admin/AdminLayout";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import MonthlyCalendar from "@/components/calendar/MonthlyCalendar";
import { apiJson } from "@/lib/api";
import { useEffect, useState, useCallback } from "react";

const EVENT_TYPES = [
  "HOLIDAY", "FIELD_TRIP", "PARENT_MEETING", "STAFF_MEETING",
  "PROFESSIONAL_DEVELOPMENT", "SPECIAL_EVENT", "OTHER",
];

const EVENT_TYPE_LABELS = {
  HOLIDAY: "Holiday",
  FIELD_TRIP: "Field Trip",
  PARENT_MEETING: "Parent Meeting",
  STAFF_MEETING: "Staff Meeting",
  PROFESSIONAL_DEVELOPMENT: "Professional Development",
  SPECIAL_EVENT: "Special Event",
  OTHER: "Other",
};

const SOURCE_BADGE = {
  event: "bg-indigo-100 text-indigo-700",
  shift: "bg-violet-100 text-violet-700",
  timeoff: "bg-emerald-100 text-emerald-700",
};

function fmtDate(d) { return d ? new Date(d).toLocaleDateString() : ""; }
function toDateInput(d) { return d ? new Date(d).toISOString().split("T")[0] : ""; }

const LEGEND = [
  { label: "Events", cls: "bg-indigo-100" },
  { label: "Shifts", cls: "bg-violet-100" },
  { label: "PTO", cls: "bg-emerald-100" },
  { label: "Sick", cls: "bg-red-100" },
  { label: "Pending", cls: "bg-amber-200" },
];

export default function CalendarPage() {
  const [centers, setCenters] = useState([]);
  const [centerId, setCenterId] = useState("");
  const [calYear, setCalYear] = useState(new Date().getFullYear());
  const [calMonth, setCalMonth] = useState(new Date().getMonth());
  const [calData, setCalData] = useState({ events: [], shifts: [], timeOff: [] });
  const [filters, setFilters] = useState({ events: true, shifts: true, timeOff: true });
  const [selectedDay, setSelectedDay] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [form, setForm] = useState({ title: "", description: "", startDate: "", endDate: "", allDay: true, type: "OTHER", color: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const c = await apiJson("/api/v1/centers");
        const arr = Array.isArray(c) ? c : [];
        setCenters(arr);
        if (arr.length === 1) setCenterId(arr[0].id);
      } catch (err) { setError(err.message || "Failed to load centers"); } finally { setLoading(false); }
    })();
  }, []);

  const loadCalendar = useCallback(async () => {
    if (!centerId) return;
    try {
      const from = new Date(calYear, calMonth, 1).toISOString();
      const to = new Date(calYear, calMonth + 1, 0).toISOString();
      const data = await apiJson(`/api/v1/calendar?centerId=${centerId}&from=${from}&to=${to}`);
      setCalData(data);
    } catch (err) { setError(err.message || "Failed to load calendar data"); }
  }, [centerId, calYear, calMonth]);

  useEffect(() => { loadCalendar(); }, [loadCalendar]);

  const normalizedEvents = (() => {
    const items = [];
    if (filters.events && calData.events) {
      for (const evt of calData.events) {
        items.push({
          id: evt.id,
          _source: "event",
          type: evt.type,
          status: "ACTIVE",
          startDate: evt.startDate,
          endDate: evt.endDate,
          user: evt.createdBy,
          label: evt.title,
          _raw: evt,
        });
      }
    }
    if (filters.shifts && calData.shifts) {
      for (const s of calData.shifts) {
        items.push({
          id: s.id,
          _source: "shift",
          type: "Shift",
          status: "ACTIVE",
          startDate: s.date,
          endDate: s.date,
          user: s.user,
          label: `${s.user?.name || "—"} ${s.startTime}–${s.endTime}`,
          _raw: s,
        });
      }
    }
    if (filters.timeOff && calData.timeOff) {
      for (const t of calData.timeOff) {
        items.push({
          id: t.id,
          _source: "timeoff",
          type: t.type,
          status: t.status,
          startDate: t.startDate,
          endDate: t.endDate,
          user: t.user,
          label: `${t.user?.name || "—"} (${t.type})`,
          _raw: t,
        });
      }
    }
    return items;
  })();

  function getDayItems(day) {
    if (!day) return [];
    const d = new Date(calYear, calMonth, day);
    return normalizedEvents.filter(evt => {
      const s = new Date(new Date(evt.startDate).toDateString());
      const e = new Date(new Date(evt.endDate).toDateString());
      return d >= s && d <= e;
    });
  }

  function resetForm() {
    setForm({ title: "", description: "", startDate: "", endDate: "", allDay: true, type: "OTHER", color: "" });
    setEditingEvent(null);
  }

  function startEdit(evt) {
    setEditingEvent(evt);
    setForm({
      title: evt.title,
      description: evt.description || "",
      startDate: toDateInput(evt.startDate),
      endDate: toDateInput(evt.endDate),
      allDay: evt.allDay,
      type: evt.type,
      color: evt.color || "",
    });
    setShowForm(true);
  }

  async function saveEvent(e) {
    e.preventDefault();
    setError(""); setSuccess("");
    if (!form.title || !form.startDate || !form.endDate) {
      setError("Title, start date, and end date are required"); return;
    }
    setSaving(true);
    try {
      if (editingEvent) {
        await apiJson(`/api/v1/events/${editingEvent.id}`, {
          method: "PUT",
          body: JSON.stringify(form),
        });
        setSuccess("Event updated");
      } else {
        await apiJson("/api/v1/events", {
          method: "POST",
          body: JSON.stringify({ ...form, centerId }),
        });
        setSuccess("Event created");
      }
      resetForm();
      setShowForm(false);
      await loadCalendar();
    } catch (err) {
      setError(err.message || "Failed to save event");
    } finally { setSaving(false); }
  }

  async function deleteEvent(id) {
    try {
      await apiJson(`/api/v1/events/${id}`, { method: "DELETE" });
      setSuccess("Event deleted");
      setDeleteTarget(null);
      await loadCalendar();
    } catch (err) {
      setError(err.message || "Failed to delete event");
      setDeleteTarget(null);
    }
  }

  const dayItems = getDayItems(selectedDay);

  return (
    <AdminLayout title="Calendar">
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--admin-text)" }}>Center Calendar</h1>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <select
              value={centerId}
              onChange={e => { setCenterId(e.target.value); setSelectedDay(null); }}
              style={{ padding: "6px 10px", border: "1px solid var(--admin-border)", borderRadius: 8, fontSize: 13, background: "var(--admin-bg)", color: "var(--admin-text)" }}
            >
              <option value="">Select center…</option>
              {centers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <button
              type="button"
              onClick={() => { resetForm(); setShowForm(!showForm); }}
              style={{ padding: "6px 14px", background: "#2563eb", color: "#fff", border: "none", borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: "pointer" }}
            >
              {showForm ? "Cancel" : "+ Add Event"}
            </button>
          </div>
        </div>

        {error && <div style={{ padding: 10, background: "var(--admin-error-bg)", color: "var(--admin-error-text)", borderRadius: 8, marginBottom: 12, fontSize: 13 }}>{error}</div>}
        {success && <div style={{ padding: 10, background: "var(--admin-success-bg)", color: "var(--admin-success-text)", borderRadius: 8, marginBottom: 12, fontSize: 13 }}>{success}</div>}

        {/* Filter toggles */}
        <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
          {[
            { key: "events", label: "Events", color: "#e0e7ff" },
            { key: "shifts", label: "Shifts", color: "#ede9fe" },
            { key: "timeOff", label: "Time Off", color: "#d1fae5" },
          ].map(f => (
            <label key={f.key} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={filters[f.key]}
                onChange={() => setFilters(prev => ({ ...prev, [f.key]: !prev[f.key] }))}
              />
              <span style={{ background: f.color, padding: "2px 8px", borderRadius: 6, fontWeight: 600, fontSize: 12 }}>{f.label}</span>
            </label>
          ))}
        </div>

        {/* Event form */}
        {showForm && (
          <div style={{ background: "var(--admin-bg)", border: "1px solid var(--admin-border)", borderRadius: 10, padding: 16, marginBottom: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12 }}>{editingEvent ? "Edit Event" : "Create Event"}</div>
            <form onSubmit={saveEvent}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <label style={{ display: "block", gridColumn: "1 / -1" }}>
                  <div style={{ fontSize: 12, color: "var(--admin-text-muted)", marginBottom: 4 }}>Title *</div>
                  <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                    style={{ width: "100%", padding: 8, border: "1px solid var(--admin-border)", borderRadius: 8, boxSizing: "border-box", background: "var(--admin-bg)", color: "var(--admin-text)" }} />
                </label>
                <label style={{ display: "block" }}>
                  <div style={{ fontSize: 12, color: "var(--admin-text-muted)", marginBottom: 4 }}>Start Date *</div>
                  <input type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))}
                    style={{ width: "100%", padding: 8, border: "1px solid var(--admin-border)", borderRadius: 8, boxSizing: "border-box", background: "var(--admin-bg)", color: "var(--admin-text)" }} />
                </label>
                <label style={{ display: "block" }}>
                  <div style={{ fontSize: 12, color: "var(--admin-text-muted)", marginBottom: 4 }}>End Date *</div>
                  <input type="date" value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))}
                    style={{ width: "100%", padding: 8, border: "1px solid var(--admin-border)", borderRadius: 8, boxSizing: "border-box", background: "var(--admin-bg)", color: "var(--admin-text)" }} />
                </label>
                <label style={{ display: "block" }}>
                  <div style={{ fontSize: 12, color: "var(--admin-text-muted)", marginBottom: 4 }}>Type</div>
                  <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                    style={{ width: "100%", padding: 8, border: "1px solid var(--admin-border)", borderRadius: 8, boxSizing: "border-box", background: "var(--admin-bg)", color: "var(--admin-text)" }}>
                    {EVENT_TYPES.map(t => <option key={t} value={t}>{EVENT_TYPE_LABELS[t]}</option>)}
                  </select>
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: 8, paddingTop: 20 }}>
                  <input type="checkbox" checked={form.allDay} onChange={e => setForm(f => ({ ...f, allDay: e.target.checked }))} />
                  <span style={{ fontSize: 13 }}>All Day</span>
                </label>
                <label style={{ display: "block", gridColumn: "1 / -1" }}>
                  <div style={{ fontSize: 12, color: "var(--admin-text-muted)", marginBottom: 4 }}>Description</div>
                  <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2}
                    style={{ width: "100%", padding: 8, border: "1px solid var(--admin-border)", borderRadius: 8, boxSizing: "border-box", resize: "vertical", background: "var(--admin-bg)", color: "var(--admin-text)" }} />
                </label>
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                <button type="submit" disabled={saving}
                  style={{ padding: "8px 16px", background: "#2563eb", color: "#fff", border: "none", borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.6 : 1 }}>
                  {saving ? "Saving…" : editingEvent ? "Update Event" : "Create Event"}
                </button>
                <button type="button" onClick={() => { resetForm(); setShowForm(false); }}
                  style={{ padding: "8px 16px", background: "var(--admin-bg-tertiary)", color: "var(--admin-text-secondary)", border: "1px solid var(--admin-border)", borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Calendar */}
        {centerId ? (
          <div style={{ display: "grid", gridTemplateColumns: selectedDay ? "1fr minmax(0, 320px)" : "1fr", gap: 16 }}>
            <div style={{ background: "var(--admin-bg)", border: "1px solid var(--admin-border)", borderRadius: 10, padding: 16 }}>
              <MonthlyCalendar
                year={calYear}
                month={calMonth}
                events={normalizedEvents}
                onMonthChange={(y, m) => { setCalYear(y); setCalMonth(m); setSelectedDay(null); }}
                onDayClick={setSelectedDay}
                legendItems={LEGEND}
              />
            </div>

            {/* Day detail panel */}
            {selectedDay && (
              <div style={{ background: "var(--admin-bg)", border: "1px solid var(--admin-border)", borderRadius: 10, padding: 16, alignSelf: "start" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>
                    {new Date(calYear, calMonth, selectedDay).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
                  </div>
                  <button type="button" onClick={() => setSelectedDay(null)} aria-label="Close day detail"
                    style={{ background: "none", border: "none", cursor: "pointer", fontSize: 16, color: "var(--admin-text-faint)" }}>✕</button>
                </div>
                {dayItems.length === 0 && <div style={{ fontSize: 13, color: "var(--admin-text-faint)" }}>No items this day</div>}
                {dayItems.map(item => (
                  <div key={item.id} style={{ padding: 8, borderRadius: 8, marginBottom: 8, border: "1px solid var(--admin-border-light)", background: "var(--admin-card-bg)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 8 }}>
                      <div>
                        <span style={{ fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 4, marginRight: 6 }}
                          className={SOURCE_BADGE[item._source] || "bg-gray-100 text-gray-600"}>
                          {item._source === "event" ? "Event" : item._source === "shift" ? "Shift" : "Time Off"}
                        </span>
                        <span style={{ fontSize: 13, fontWeight: 600 }}>{item.label}</span>
                      </div>
                      {item._source === "event" && (
                        <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                          <button type="button" onClick={() => startEdit(item._raw)}
                            style={{ fontSize: 11, padding: "2px 8px", background: "var(--admin-accent-bg)", color: "var(--admin-accent-text)", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600 }}>
                            Edit
                          </button>
                          <button type="button" onClick={() => setDeleteTarget(item.id)}
                            style={{ fontSize: 11, padding: "2px 8px", background: "var(--admin-danger-accent-bg)", color: "var(--admin-danger-accent-text)", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600 }}>
                            Del
                          </button>
                        </div>
                      )}
                    </div>
                    {item._raw?.description && (
                      <div style={{ fontSize: 12, color: "var(--admin-text-muted)", marginTop: 4 }}>{item._raw.description}</div>
                    )}
                    {item._source === "shift" && (
                      <div style={{ fontSize: 12, color: "var(--admin-text-muted)", marginTop: 4 }}>Position: {item._raw.position}{item._raw.notes ? ` • ${item._raw.notes}` : ""}</div>
                    )}
                    {item._source === "timeoff" && (
                      <div style={{ fontSize: 12, color: "var(--admin-text-muted)", marginTop: 4 }}>Status: {item._raw.status}{item._raw.reason ? ` • ${item._raw.reason}` : ""}</div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div style={{ textAlign: "center", padding: 40, color: "var(--admin-text-faint)", fontSize: 14 }}>
            Select a center to view the calendar
          </div>
        )}
      </div>
      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Event"
        message="Are you sure you want to delete this event? This action cannot be undone."
        confirmLabel="Delete"
        variant="danger"
        onConfirm={() => deleteEvent(deleteTarget)}
        onCancel={() => setDeleteTarget(null)}
      />
    </AdminLayout>
  );
}
