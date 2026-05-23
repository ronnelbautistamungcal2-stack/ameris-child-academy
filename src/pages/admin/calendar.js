import AdminLayout from "@/components/admin/AdminLayout";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import MonthlyCalendar from "@/components/calendar/MonthlyCalendar";
import { apiJson } from "@/lib/api";
import { formatDateInputValue, toCalendarDay } from "@/lib/calendar";
import { getTimeOffTypeLabel } from "@/lib/time-off";
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

const EVENT_TYPE_ICONS = {
  HOLIDAY: "\ud83c\udf34",
  FIELD_TRIP: "\ud83d\ude8c",
  PARENT_MEETING: "\ud83e\uddd1\u200d\ud83e\udd1d\u200d\ud83e\uddd1",
  STAFF_MEETING: "\ud83d\udcbc",
  PROFESSIONAL_DEVELOPMENT: "\ud83c\udf93",
  SPECIAL_EVENT: "\u2b50",
  OTHER: "\ud83d\udcc5",
};

const SOURCE_BADGE = {
  event: { bg: "#eef2ff", text: "#4338ca", border: "#c7d2fe", label: "Event", icon: "\ud83d\udcc5" },
  shift: { bg: "#eff6ff", text: "#1d4ed8", border: "#bfdbfe", label: "Shift", icon: "\u23f0" },
  timeoff: { bg: "#ecfdf5", text: "#047857", border: "#a7f3d0", label: "Time Off", icon: "\ud83c\udfd6\ufe0f" },
};

const FILTER_ITEMS = [
  { key: "events", label: "Events", color: "#6366f1", lightBg: "#eef2ff", icon: "\ud83d\udcc5" },
  { key: "shifts", label: "Shifts", color: "#3b82f6", lightBg: "#eff6ff", icon: "\u23f0" },
  { key: "timeOff", label: "Time Off", color: "#10b981", lightBg: "#ecfdf5", icon: "\ud83c\udfd6\ufe0f" },
];

function toDateInput(value, options = {}) {
  return formatDateInputValue(value, options);
}

function formatDateTimeRange(start, end) {
  if (!start || !end) return "";
  const startDate = new Date(start);
  const endDate = new Date(end);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return "";

  const sameDay =
    startDate.getFullYear() === endDate.getFullYear() &&
    startDate.getMonth() === endDate.getMonth() &&
    startDate.getDate() === endDate.getDate();

  if (sameDay) {
    return `${startDate.toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    })} - ${endDate.toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    })}`;
  }

  const dateTimeOptions = {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  };

  return `${startDate.toLocaleString(undefined, dateTimeOptions)} - ${endDate.toLocaleString(undefined, dateTimeOptions)}`;
}

function toItemCalendarDay(item, fieldName) {
  return toCalendarDay(item?.[fieldName], { allDay: !!item?._raw?.allDay });
}

function hoursBetween(start, end) {
  if (!start || !end) return 0;
  const startDate = new Date(start);
  const endDate = new Date(end);
  const diff = (endDate - startDate) / (1000 * 60 * 60);
  return Number.isFinite(diff) && diff > 0 ? diff : 0;
}

const LEGEND = [
  { label: "Events", cls: "bg-indigo-100" },
  { label: "Shifts", cls: "bg-blue-100" },
  { label: "Paid", cls: "bg-emerald-100" },
  { label: "Unpaid", cls: "bg-gray-200" },
];

export default function CalendarPage() {
  const [centers, setCenters] = useState([]);
  const [centerId, setCenterId] = useState("");
  const [staffUsers, setStaffUsers] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [staffSummaryFrom, setStaffSummaryFrom] = useState(toDateInput(new Date(new Date().getFullYear(), new Date().getMonth(), 1)));
  const [staffSummaryTo, setStaffSummaryTo] = useState(toDateInput(new Date()));
  const [staffSummary, setStaffSummary] = useState(null);
  const [calYear, setCalYear] = useState(new Date().getFullYear());
  const [calMonth, setCalMonth] = useState(new Date().getMonth());
  const [calData, setCalData] = useState({ events: [], shifts: [], timeOff: [], pendingTimeOff: [] });
  const [filters, setFilters] = useState({ events: true, shifts: true, timeOff: true });
  const [selectedDay, setSelectedDay] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [form, setForm] = useState({ title: "", description: "", startDate: "", endDate: "", allDay: true, type: "OTHER", color: "" });
  const [, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);

  // Auto-dismiss notifications
  useEffect(() => {
    if (success) { const t = setTimeout(() => setSuccess(""), 3000); return () => clearTimeout(t); }
  }, [success]);
  useEffect(() => {
    if (error) { const t = setTimeout(() => setError(""), 5000); return () => clearTimeout(t); }
  }, [error]);

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
      const to = new Date(calYear, calMonth + 1, 0, 23, 59, 59, 999).toISOString();
      const data = await apiJson(`/api/v1/calendar?centerId=${centerId}&from=${from}&to=${to}`);
      setCalData(data);
    } catch (err) { setError(err.message || "Failed to load calendar data"); }
  }, [centerId, calYear, calMonth]);

  useEffect(() => { loadCalendar(); }, [loadCalendar]);

  useEffect(() => {
    if (!centerId) {
      setStaffUsers([]);
      setSelectedUserId("");
      setStaffSummary(null);
      return;
    }
    (async () => {
      try {
        const users = await apiJson(`/api/v1/users?centerId=${centerId}&staffOnly=true`);
        setStaffUsers(Array.isArray(users) ? users : []);
      } catch {
        setStaffUsers([]);
      }
    })();
  }, [centerId]);

  const loadStaffSummary = useCallback(async () => {
    if (!centerId || !selectedUserId) {
      setStaffSummary(null);
      return;
    }
    try {
      const qs = new URLSearchParams({
        centerId,
        userId: selectedUserId,
        from: staffSummaryFrom,
        to: staffSummaryTo,
      });
      const [attendance, requests, balances] = await Promise.all([
        apiJson(`/api/v1/staff-attendance/summary?${qs.toString()}`),
        apiJson(`/api/v1/time-off?centerId=${centerId}&userId=${selectedUserId}`),
        apiJson(`/api/v1/time-off/balances?centerId=${centerId}&userId=${selectedUserId}`),
      ]);
      const filteredRequests = (Array.isArray(requests) ? requests : []).filter((request) => {
        const requestStart = toDateInput(request.startDate);
        const requestEnd = toDateInput(request.endDate);
        return (!staffSummaryFrom || requestEnd >= staffSummaryFrom) && (!staffSummaryTo || requestStart <= staffSummaryTo);
      });
      setStaffSummary({
        attendance,
        requests: filteredRequests,
        balanceSummary: balances?.summary || null,
      });
    } catch {
      setStaffSummary(null);
    }
  }, [centerId, selectedUserId, staffSummaryFrom, staffSummaryTo]);

  useEffect(() => { loadStaffSummary(); }, [loadStaffSummary]);

  const normalizedEvents = (() => {
    const items = [];
    if (filters.events && calData.events) {
      for (const evt of calData.events) {
        items.push({
          id: evt.id, _source: "event", type: evt.type, status: "ACTIVE",
          startDate: evt.startDate, endDate: evt.endDate,
          allDay: evt.allDay,
          user: evt.createdBy, label: evt.title, _raw: evt,
        });
      }
    }
    if (filters.shifts && calData.shifts) {
      for (const s of calData.shifts) {
        items.push({
          id: s.id, _source: "shift", type: "Shift", status: "ACTIVE",
          startDate: s.date, endDate: s.date,
          user: s.user, label: `${s.user?.name || "\u2014"} ${s.startTime}\u2013${s.endTime}`,
          _raw: s,
        });
      }
    }
    if (filters.timeOff && calData.timeOff) {
      for (const t of calData.timeOff) {
        items.push({
          id: t.id, _source: "timeoff", type: t.type, status: t.status,
          startDate: t.startDate, endDate: t.endDate,
          user: t.user,
          label: `${t.user?.name || "\u2014"} (${t.typeLabel || getTimeOffTypeLabel(t.type)})`,
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
      const s = toItemCalendarDay(evt, "startDate");
      const e = toItemCalendarDay(evt, "endDate");
      if (!s || !e) return false;
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
      title: evt.title, description: evt.description || "",
      startDate: toDateInput(evt.startDate, { allDay: evt.allDay }),
      endDate: toDateInput(evt.endDate, { allDay: evt.allDay }),
      allDay: evt.allDay, type: evt.type, color: evt.color || "",
    });
    setShowForm(true);
  }

  function openNewEvent() {
    resetForm();
    if (selectedDay) {
      const dateStr = formatDateInputValue(new Date(calYear, calMonth, selectedDay));
      setForm(f => ({ ...f, startDate: dateStr, endDate: dateStr }));
    }
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
        await apiJson(`/api/v1/events/${editingEvent.id}`, { method: "PUT", body: JSON.stringify(form) });
        setSuccess("Event updated successfully");
      } else {
        await apiJson("/api/v1/events", { method: "POST", body: JSON.stringify({ ...form, centerId }) });
        setSuccess("Event created successfully");
      }
      resetForm(); setShowForm(false);
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
  const selectedCenter = centers.find(c => c.id === centerId);
  const totalEventsThisMonth = normalizedEvents.length;
  const monthLabel = new Date(calYear, calMonth, 1).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
  const hasCenter = !!centerId;
  const selectedDayDate = selectedDay ? new Date(calYear, calMonth, selectedDay) : null;
  const counts = {
    events: (calData.events || []).length,
    shifts: (calData.shifts || []).length,
    timeOff: (calData.timeOff || []).length,
    pendingTimeOff: (calData.pendingTimeOff || []).length,
  };

  function jumpToToday() {
    const t = new Date();
    setCalYear(t.getFullYear());
    setCalMonth(t.getMonth());
    setSelectedDay(t.getDate());
  }

  return (
    <AdminLayout title="Calendar">
      <div style={{ maxWidth: 1240, margin: "0 auto", padding: "20px 16px" }}>

        {/* Toast notifications */}
        {(error || success) && (
          <div style={{
            position: "fixed", top: 16, right: 16, zIndex: 1000,
            maxWidth: 360, animation: "slideIn 0.25s ease-out",
          }}>
            {error && (
              <div style={{
                padding: "12px 16px", background: "var(--admin-error-bg)", color: "var(--admin-error-text)",
                borderRadius: 10, fontSize: 13, fontWeight: 600,
                border: "1px solid var(--admin-error-border)",
                boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                display: "flex", alignItems: "center", gap: 8,
              }}>
                <span style={{ fontSize: 16 }}>\u26a0\ufe0f</span>
                <span style={{ flex: 1 }}>{error}</span>
                <button onClick={() => setError("")} style={{ background: "none", border: "none", cursor: "pointer", color: "inherit", fontSize: 14 }}>\u2715</button>
              </div>
            )}
            {success && (
              <div style={{
                padding: "12px 16px", background: "var(--admin-success-bg)", color: "var(--admin-success-text)",
                borderRadius: 10, fontSize: 13, fontWeight: 600,
                border: "1px solid var(--admin-success-border)",
                boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                display: "flex", alignItems: "center", gap: 8,
              }}>
                <span style={{ fontSize: 16 }}>\u2705</span>
                <span style={{ flex: 1 }}>{success}</span>
              </div>
            )}
          </div>
        )}

        {/* Page header */}
        <div
          style={{
            marginBottom: 20,
            border: "1px solid var(--admin-border)",
            borderRadius: 18,
            padding: 18,
            background: "linear-gradient(120deg, var(--admin-accent-bg), var(--admin-info-bg))",
            position: "relative",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: -120,
              background: "radial-gradient(circle, rgba(59,130,246,0.18), transparent 60%)",
              opacity: 0.7,
              pointerEvents: "none",
            }}
          />
          <div
            style={{
              position: "relative",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: 16,
            }}
          >
            <div style={{ minWidth: 240 }}>
              <div style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "6px 12px",
                borderRadius: 999,
                border: "1px solid var(--admin-border)",
                background: "var(--admin-bg)",
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: "var(--admin-text-muted)",
              }}>
                Admin Calendar
              </div>
              <h1 style={{ fontSize: 28, fontWeight: 800, color: "var(--admin-text)", margin: "10px 0 0", lineHeight: 1.2 }}>
                {monthLabel}
              </h1>
              <p style={{ fontSize: 13, color: "var(--admin-text-muted)", marginTop: 6 }}>
                {selectedCenter ? `${selectedCenter.name} \u2014 ` : ""}
                {totalEventsThisMonth} item{totalEventsThisMonth !== 1 ? "s" : ""} scheduled
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
                <span style={{
                  padding: "6px 10px",
                  borderRadius: 999,
                  background: "var(--admin-bg)",
                  border: "1px solid var(--admin-border)",
                  fontSize: 12,
                  fontWeight: 700,
                  color: "var(--admin-text-secondary)",
                }}>
                  {counts.events} events
                </span>
                <span style={{
                  padding: "6px 10px",
                  borderRadius: 999,
                  background: "var(--admin-bg)",
                  border: "1px solid var(--admin-border)",
                  fontSize: 12,
                  fontWeight: 700,
                  color: "var(--admin-text-secondary)",
                }}>
                  {counts.shifts} shifts
                </span>
                <span style={{
                  padding: "6px 10px",
                  borderRadius: 999,
                  background: "var(--admin-bg)",
                  border: "1px solid var(--admin-border)",
                  fontSize: 12,
                  fontWeight: 700,
                  color: "var(--admin-text-secondary)",
                }}>
                  {counts.timeOff} time off
                </span>
                {counts.pendingTimeOff > 0 && (
                  <span style={{
                    padding: "6px 10px",
                    borderRadius: 999,
                    background: "var(--admin-warning-bg)",
                    border: "1px solid var(--admin-warning-text)",
                    fontSize: 12,
                    fontWeight: 800,
                    color: "var(--admin-warning-text)",
                  }}>
                    {counts.pendingTimeOff} pending
                  </span>
                )}
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              {(centers.length > 1 || (centers.length === 1 && !centerId)) && (
                <select
                  value={centerId}
                  onChange={e => { setCenterId(e.target.value); setSelectedDay(null); }}
                  style={{
                    padding: "10px 14px",
                    border: "1px solid var(--admin-border)",
                    borderRadius: 12,
                    fontSize: 13,
                    background: "var(--admin-bg)",
                    color: "var(--admin-text)",
                    fontWeight: 700,
                    cursor: "pointer",
                    minWidth: 180,
                    boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                  }}
                >
                  <option value="">Select center\u2026</option>
                  {centers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              )}
              <button
                type="button"
                onClick={jumpToToday}
                style={{
                  padding: "10px 14px",
                  background: "var(--admin-bg)",
                  color: "var(--admin-text-secondary)",
                  border: "1px solid var(--admin-border)",
                  borderRadius: 12,
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                Jump to today
              </button>
              <button
                type="button"
                onClick={openNewEvent}
                disabled={!hasCenter}
                style={{
                  padding: "10px 18px",
                  background: hasCenter ? "linear-gradient(90deg, #2563eb, #0ea5e9)" : "#94a3b8",
                  color: "#fff",
                  border: "none",
                  borderRadius: 12,
                  fontWeight: 800,
                  fontSize: 13,
                  cursor: hasCenter ? "pointer" : "not-allowed",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  boxShadow: hasCenter ? "0 10px 24px rgba(37,99,235,0.2)" : "none",
                  transition: "all 0.15s ease",
                }}
              >
                <span style={{ fontSize: 16, lineHeight: 1 }}>+</span>
                Add Event
              </button>
            </div>
          </div>
        </div>

        {/* Filter pills */}
        <div
          style={{
            display: "flex",
            gap: 10,
            marginBottom: 16,
            flexWrap: "wrap",
            alignItems: "center",
            padding: "10px 12px",
            borderRadius: 14,
            border: "1px solid var(--admin-border)",
            background: "var(--admin-bg)",
          }}
        >
          <span style={{ fontSize: 12, fontWeight: 700, color: "var(--admin-text-faint)", marginRight: 4 }}>
            Filters
          </span>
          {FILTER_ITEMS.map(f => {
            const active = filters[f.key];
            const count = f.key === "events" ? counts.events : f.key === "shifts" ? counts.shifts : counts.timeOff;
            return (
              <button
                key={f.key}
                type="button"
                onClick={() => setFilters(prev => ({ ...prev, [f.key]: !prev[f.key] }))}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "6px 12px",
                  borderRadius: 999,
                  fontSize: 12,
                  fontWeight: 800,
                  border: active ? `2px solid ${f.color}` : "2px solid var(--admin-border)",
                  background: active ? f.lightBg : "var(--admin-bg)",
                  color: active ? f.color : "var(--admin-text-faint)",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                  opacity: active ? 1 : 0.65,
                }}
              >
                <span style={{ fontSize: 12 }}>{f.icon}</span>
                {f.label}
                <span style={{
                  padding: "2px 6px",
                  borderRadius: 999,
                  background: active ? "#ffffff" : "var(--admin-bg-tertiary)",
                  color: active ? f.color : "var(--admin-text-faint)",
                  fontSize: 11,
                  fontWeight: 800,
                }}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {centerId && (
          <div
            style={{
              marginBottom: 16,
              padding: "14px 16px",
              borderRadius: 14,
              border: "1px solid var(--admin-border)",
              background: "var(--admin-bg)",
            }}
          >
            <div style={{ display: "flex", alignItems: "end", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 800, color: "var(--admin-text-faint)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  Employee Summary
                </div>
                <div style={{ marginTop: 4, fontSize: 13, color: "var(--admin-text-muted)" }}>
                  View time off, paid and unpaid hours available, lates, and absences for a specific staff member.
                </div>
              </div>
              <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", width: "min(720px, 100%)" }}>
                <label style={{ display: "block" }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "var(--admin-text-secondary)", marginBottom: 6 }}>Employee</div>
                  <select
                    value={selectedUserId}
                    onChange={(e) => setSelectedUserId(e.target.value)}
                    style={{
                      width: "100%", padding: "10px 12px", border: "1px solid var(--admin-border)",
                      borderRadius: 10, boxSizing: "border-box", fontSize: 13,
                      background: "var(--admin-bg)", color: "var(--admin-text)",
                    }}
                  >
                    <option value="">Select employee…</option>
                    {staffUsers.map((user) => <option key={user.id} value={user.id}>{user.name || user.email}</option>)}
                  </select>
                </label>
                <label style={{ display: "block" }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "var(--admin-text-secondary)", marginBottom: 6 }}>From</div>
                  <input type="date" value={staffSummaryFrom} onChange={(e) => setStaffSummaryFrom(e.target.value)} style={{
                    width: "100%", padding: "10px 12px", border: "1px solid var(--admin-border)",
                    borderRadius: 10, boxSizing: "border-box", fontSize: 13,
                    background: "var(--admin-bg)", color: "var(--admin-text)",
                  }} />
                </label>
                <label style={{ display: "block" }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "var(--admin-text-secondary)", marginBottom: 6 }}>To</div>
                  <input type="date" value={staffSummaryTo} onChange={(e) => setStaffSummaryTo(e.target.value)} style={{
                    width: "100%", padding: "10px 12px", border: "1px solid var(--admin-border)",
                    borderRadius: 10, boxSizing: "border-box", fontSize: 13,
                    background: "var(--admin-bg)", color: "var(--admin-text)",
                  }} />
                </label>
              </div>
            </div>

            {selectedUserId && staffSummary && (
              <div style={{ marginTop: 16, display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
                <div style={{ border: "1px solid var(--admin-border)", borderRadius: 12, padding: 14, background: "var(--admin-bg-secondary)" }}>
                  <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--admin-text-muted)" }}>Attendance Totals</div>
                  <div style={{ marginTop: 10, display: "grid", gap: 8, gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
                    <SummaryStat label="Present" value={staffSummary.attendance?.present ?? 0} />
                    <SummaryStat label="Late" value={staffSummary.attendance?.late ?? 0} />
                    <SummaryStat label="Absent" value={staffSummary.attendance?.absent ?? 0} />
                    <SummaryStat label="Late Mins" value={staffSummary.attendance?.totalLateMinutes ?? 0} />
                  </div>
                </div>

                <div style={{ border: "1px solid var(--admin-border)", borderRadius: 12, padding: 14, background: "var(--admin-bg-secondary)" }}>
                  <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--admin-text-muted)" }}>Time Off</div>
                  <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                    <SummaryStat label="Requests" value={staffSummary.requests.length} />
                    <SummaryStat label="Paid Available" value={staffSummary.balanceSummary?.paidAvailable ?? 0} />
                    <SummaryStat label="Unpaid Available" value={staffSummary.balanceSummary?.unpaidAvailable ?? 0} />
                  </div>
                </div>

                <div style={{ border: "1px solid var(--admin-border)", borderRadius: 12, padding: 14, background: "var(--admin-bg-secondary)" }}>
                  <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--admin-text-muted)" }}>Time Off History</div>
                  <div style={{ marginTop: 10, display: "grid", gap: 8, maxHeight: 220, overflow: "auto" }}>
                    {staffSummary.requests.length ? staffSummary.requests.map((request) => (
                      <div key={request.id} style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid var(--admin-border)", background: "var(--admin-bg)" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--admin-text)" }}>{request.type}</div>
                          <span style={{ fontSize: 11, fontWeight: 700, color: "var(--admin-text-muted)" }}>{request.status}</span>
                        </div>
                        <div style={{ marginTop: 4, fontSize: 12, color: "var(--admin-text-muted)" }}>
                          {fmtDateTime(request.startDate)} - {fmtDateTime(request.endDate)}
                        </div>
                      </div>
                    )) : (
                      <div style={{ fontSize: 12, color: "var(--admin-text-muted)" }}>No time-off requests in this range.</div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Event form modal overlay */}
        {showForm && (
          <div style={{
            position: "fixed", inset: 0, background: "var(--admin-modal-overlay, rgba(0,0,0,0.5))",
            zIndex: 900, display: "flex", alignItems: "center", justifyContent: "center",
            padding: 16, animation: "fadeIn 0.15s ease-out",
          }}
            onClick={e => { if (e.target === e.currentTarget) { resetForm(); setShowForm(false); } }}
          >
            <div style={{
              background: "var(--admin-bg)", borderRadius: 14, padding: 24,
              width: "100%", maxWidth: 520, maxHeight: "85vh", overflow: "auto",
              boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
              animation: "slideUp 0.2s ease-out",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 18, color: "var(--admin-text)" }}>
                    {editingEvent ? "Edit Event" : "New Event"}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--admin-text-muted)", marginTop: 2 }}>
                    {editingEvent ? "Update the event details below" : "Fill in the details to create a new event"}
                  </div>
                </div>
                <button type="button" onClick={() => { resetForm(); setShowForm(false); }}
                  style={{
                    width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center",
                    background: "var(--admin-bg-tertiary)", border: "none", borderRadius: 8,
                    cursor: "pointer", fontSize: 14, color: "var(--admin-text-muted)",
                  }}
                >\u2715</button>
              </div>

              <form onSubmit={saveEvent}>
                {/* Title */}
                <div style={{ marginBottom: 14 }}>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--admin-text-secondary)", marginBottom: 6 }}>
                    Event Title <span style={{ color: "#dc2626" }}>*</span>
                  </label>
                  <input
                    value={form.title}
                    onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                    placeholder="e.g. Spring Break, Staff Training..."
                    style={{
                      width: "100%", padding: "10px 12px", border: "1px solid var(--admin-border)",
                      borderRadius: 8, boxSizing: "border-box", fontSize: 14,
                      background: "var(--admin-bg)", color: "var(--admin-text)",
                      transition: "border-color 0.15s ease",
                    }}
                    onFocus={e => { e.target.style.borderColor = "#2563eb"; e.target.style.boxShadow = "0 0 0 3px rgba(37,99,235,0.1)"; }}
                    onBlur={e => { e.target.style.borderColor = "var(--admin-border)"; e.target.style.boxShadow = "none"; }}
                    autoFocus
                  />
                </div>

                {/* Date row */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--admin-text-secondary)", marginBottom: 6 }}>
                      Start Date <span style={{ color: "#dc2626" }}>*</span>
                    </label>
                    <input
                      type="date" value={form.startDate}
                      onChange={e => setForm(f => ({ ...f, startDate: e.target.value, endDate: f.endDate || e.target.value }))}
                      style={{
                        width: "100%", padding: "10px 12px", border: "1px solid var(--admin-border)",
                        borderRadius: 8, boxSizing: "border-box", fontSize: 13,
                        background: "var(--admin-bg)", color: "var(--admin-text)",
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--admin-text-secondary)", marginBottom: 6 }}>
                      End Date <span style={{ color: "#dc2626" }}>*</span>
                    </label>
                    <input
                      type="date" value={form.endDate}
                      onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))}
                      min={form.startDate || undefined}
                      style={{
                        width: "100%", padding: "10px 12px", border: "1px solid var(--admin-border)",
                        borderRadius: 8, boxSizing: "border-box", fontSize: 13,
                        background: "var(--admin-bg)", color: "var(--admin-text)",
                      }}
                    />
                  </div>
                </div>

                {/* Type + All Day row */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 12, marginBottom: 14, alignItems: "end" }}>
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--admin-text-secondary)", marginBottom: 6 }}>
                      Event Type
                    </label>
                    <select
                      value={form.type}
                      onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                      style={{
                        width: "100%", padding: "10px 12px", border: "1px solid var(--admin-border)",
                        borderRadius: 8, boxSizing: "border-box", fontSize: 13,
                        background: "var(--admin-bg)", color: "var(--admin-text)", cursor: "pointer",
                      }}
                    >
                      {EVENT_TYPES.map(t => (
                        <option key={t} value={t}>{EVENT_TYPE_ICONS[t]} {EVENT_TYPE_LABELS[t]}</option>
                      ))}
                    </select>
                  </div>
                  <label style={{
                    display: "flex", alignItems: "center", gap: 8, padding: "10px 14px",
                    background: form.allDay ? "var(--admin-accent-bg)" : "var(--admin-bg-tertiary)",
                    borderRadius: 8, cursor: "pointer",
                    border: form.allDay ? "1px solid var(--admin-accent-text)" : "1px solid var(--admin-border)",
                    transition: "all 0.15s ease",
                  }}>
                    <input
                      type="checkbox" checked={form.allDay}
                      onChange={e => setForm(f => ({ ...f, allDay: e.target.checked }))}
                      style={{ accentColor: "#2563eb" }}
                    />
                    <span style={{ fontSize: 13, fontWeight: 600, color: "var(--admin-text-secondary)", whiteSpace: "nowrap" }}>All Day</span>
                  </label>
                </div>

                {/* Description */}
                <div style={{ marginBottom: 20 }}>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--admin-text-secondary)", marginBottom: 6 }}>
                    Description <span style={{ fontSize: 11, fontWeight: 400, color: "var(--admin-text-faint)" }}>(optional)</span>
                  </label>
                  <textarea
                    value={form.description}
                    onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                    placeholder="Add any additional details..."
                    rows={3}
                    style={{
                      width: "100%", padding: "10px 12px", border: "1px solid var(--admin-border)",
                      borderRadius: 8, boxSizing: "border-box", resize: "vertical", fontSize: 13,
                      background: "var(--admin-bg)", color: "var(--admin-text)",
                      fontFamily: "inherit",
                    }}
                  />
                </div>

                {/* Actions */}
                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                  <button type="button" onClick={() => { resetForm(); setShowForm(false); }}
                    style={{
                      padding: "10px 20px", background: "var(--admin-bg-tertiary)",
                      color: "var(--admin-text-secondary)", border: "1px solid var(--admin-border)",
                      borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: "pointer",
                    }}>
                    Cancel
                  </button>
                  <button type="submit" disabled={saving}
                    style={{
                      padding: "10px 24px", background: "#2563eb", color: "#fff",
                      border: "none", borderRadius: 8, fontWeight: 700, fontSize: 13,
                      cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.6 : 1,
                      boxShadow: "0 2px 8px rgba(37,99,235,0.25)",
                      display: "flex", alignItems: "center", gap: 6,
                    }}>
                    {saving && <span style={{ display: "inline-block", width: 14, height: 14, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.6s linear infinite" }} />}
                    {saving ? "Saving\u2026" : editingEvent ? "Update Event" : "Create Event"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Calendar + Day detail */}
        {centerId ? (
          <div className="admin-calendar-grid" style={{ display: "grid", gridTemplateColumns: selectedDay ? "1fr 340px" : "1fr", gap: 20, alignItems: "start" }}>
            {/* Calendar card */}
            <div style={{
              background: "var(--admin-bg)", border: "1px solid var(--admin-border)",
              borderRadius: 18, padding: 20,
              boxShadow: "0 10px 24px rgba(15,23,42,0.06)",
            }}>
              <div style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 14,
                paddingBottom: 8,
                borderBottom: "1px solid var(--admin-border-light)",
              }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 800, color: "var(--admin-text-faint)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    Calendar view
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: "var(--admin-text)" }}>
                    {monthLabel}
                  </div>
                </div>
                {selectedDayDate && (
                  <div style={{
                    padding: "6px 10px",
                    borderRadius: 10,
                    background: "var(--admin-bg-secondary)",
                    border: "1px solid var(--admin-border)",
                    fontSize: 12,
                    fontWeight: 700,
                    color: "var(--admin-text-secondary)",
                  }}>
                    Selected: {selectedDayDate.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                  </div>
                )}
              </div>
              <MonthlyCalendar
                year={calYear}
                month={calMonth}
                events={normalizedEvents}
                onMonthChange={(y, m) => { setCalYear(y); setCalMonth(m); setSelectedDay(null); }}
                onDayClick={setSelectedDay}
                selectedDay={selectedDay}
                legendItems={LEGEND}
              />
            </div>

            {/* Day detail panel */}
            {selectedDay && (
              <div className="admin-calendar-daypanel" style={{
                background: "var(--admin-bg)", border: "1px solid var(--admin-border)",
                borderRadius: 16, overflow: "hidden",
                boxShadow: "0 10px 24px rgba(15,23,42,0.08)",
                animation: "slideIn 0.2s ease-out",
                position: "sticky", top: 16,
              }}>
                {/* Day header */}
                <div style={{
                  padding: "16px 20px", background: "var(--admin-bg-secondary)",
                  borderBottom: "1px solid var(--admin-border)",
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                }}>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 800, color: "var(--admin-text-faint)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                      {selectedDayDate.toLocaleDateString(undefined, { weekday: "long" })}
                    </div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: "var(--admin-text)", lineHeight: 1.2 }}>
                      {selectedDayDate.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                    </div>
                  </div>
                  <button type="button" onClick={() => setSelectedDay(null)} aria-label="Close day detail"
                    style={{
                      width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center",
                      background: "var(--admin-bg-tertiary)", border: "none", borderRadius: 8,
                      cursor: "pointer", fontSize: 12, color: "var(--admin-text-muted)",
                      transition: "all 0.15s ease",
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = "var(--admin-border)"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = "var(--admin-bg-tertiary)"; }}
                  >\u2715</button>
                </div>

                {/* Day items */}
                <div style={{ padding: "12px 16px" }}>
                  <div style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    marginBottom: 12, padding: "0 4px",
                  }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "var(--admin-text-muted)" }}>
                      {dayItems.length} item{dayItems.length !== 1 ? "s" : ""}
                    </span>
                    <button
                      type="button"
                      onClick={openNewEvent}
                      style={{
                        fontSize: 11, fontWeight: 800, padding: "6px 12px",
                        background: "linear-gradient(90deg, #2563eb, #0ea5e9)",
                        color: "#fff",
                        border: "none", borderRadius: 8, cursor: "pointer",
                      }}
                    >
                      + Add
                    </button>
                  </div>

                  {dayItems.length === 0 && (
                    <div style={{
                      textAlign: "center", padding: "28px 16px",
                      color: "var(--admin-text-faint)", fontSize: 13,
                    }}>
                      <div style={{ fontSize: 28, marginBottom: 8, opacity: 0.4 }}>\ud83d\udcc5</div>
                      <div style={{ fontWeight: 600 }}>No events this day</div>
                      <div style={{ fontSize: 12, marginTop: 4 }}>Click "+ Add" to create one</div>
                    </div>
                  )}

                  {dayItems.map(item => {
                    const badge = SOURCE_BADGE[item._source] || SOURCE_BADGE.event;
                    const timeRange = item._source === "timeoff"
                      ? formatDateTimeRange(item._raw?.startDate, item._raw?.endDate)
                      : "";
                    return (
                      <div key={item.id} style={{
                        padding: "12px 14px", borderRadius: 10, marginBottom: 8,
                        border: `1px solid ${badge.border}`,
                        background: badge.bg,
                        transition: "transform 0.1s ease",
                      }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 8 }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                              <span style={{ fontSize: 12 }}>{badge.icon}</span>
                              <span style={{
                                fontSize: 10, fontWeight: 800, padding: "2px 7px", borderRadius: 4,
                                background: badge.bg, color: badge.text, textTransform: "uppercase",
                                letterSpacing: "0.03em",
                                border: `1px solid ${badge.border}`,
                              }}>
                                {badge.label}
                              </span>
                              {item._source === "timeoff" && (
                                <span style={{
                                  fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 4,
                                  background: item._raw.status === "APPROVED" ? "var(--admin-success-bg)" : "var(--admin-warning-bg)",
                                  color: item._raw.status === "APPROVED" ? "var(--admin-success-text)" : "var(--admin-warning-text)",
                                }}>
                                  {item._raw.status}
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: 14, fontWeight: 700, color: "var(--admin-text)", lineHeight: 1.3 }}>
                              {item.label}
                            </div>
                          </div>
                          {item._source === "event" && (
                            <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                              <button type="button" onClick={() => startEdit(item._raw)}
                                style={{
                                  fontSize: 11, padding: "4px 10px",
                                  background: "var(--admin-bg)", color: "var(--admin-accent-text)",
                                  border: "1px solid var(--admin-border)", borderRadius: 6,
                                  cursor: "pointer", fontWeight: 700,
                                }}>
                                Edit
                              </button>
                              <button type="button" onClick={() => setDeleteTarget(item.id)}
                                style={{
                                  fontSize: 11, padding: "4px 10px",
                                  background: "var(--admin-bg)", color: "var(--admin-danger-accent-text)",
                                  border: "1px solid var(--admin-border)", borderRadius: 6,
                                  cursor: "pointer", fontWeight: 700,
                                }}>
                                Del
                              </button>
                            </div>
                          )}
                        </div>
                        {item._raw?.description && (
                          <div style={{ fontSize: 12, color: "var(--admin-text-muted)", marginTop: 6, lineHeight: 1.4 }}>
                            {item._raw.description}
                          </div>
                        )}
                        {item._source === "shift" && (
                          <div style={{ fontSize: 12, color: "var(--admin-text-muted)", marginTop: 6, display: "flex", alignItems: "center", gap: 4 }}>
                            <span style={{ fontWeight: 600 }}>Position:</span> {item._raw.position}{item._raw.notes ? ` \u2022 ${item._raw.notes}` : ""}
                          </div>
                        )}
                        {item._source === "timeoff" && timeRange && (
                          <div style={{ fontSize: 12, color: "var(--admin-text-muted)", marginTop: 6, display: "flex", alignItems: "center", gap: 4 }}>
                            <span style={{ fontWeight: 600 }}>Time:</span> {timeRange}
                          </div>
                        )}
                        {item._source === "timeoff" && item._raw.reason && (
                          <div style={{ fontSize: 12, color: "var(--admin-text-muted)", marginTop: 6, lineHeight: 1.4 }}>
                            {item._raw.reason}
                          </div>
                        )}
                        {item._source === "timeoff" && item._raw.coverageName && (
                          <div style={{ fontSize: 12, color: "var(--admin-text-muted)", marginTop: 6, display: "flex", alignItems: "center", gap: 4 }}>
                            <span style={{ fontWeight: 600 }}>Coverage:</span> {item._raw.coverageName}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div style={{
            textAlign: "center", padding: "60px 20px",
            background: "var(--admin-bg)", border: "1px solid var(--admin-border)",
            borderRadius: 14,
          }}>
            <div style={{ fontSize: 48, marginBottom: 12, opacity: 0.3 }}>\ud83d\udcc5</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "var(--admin-text-secondary)", marginBottom: 6 }}>
              Select a center to view the calendar
            </div>
            <div style={{ fontSize: 13, color: "var(--admin-text-faint)" }}>
              Choose a center from the dropdown above to get started
            </div>
          </div>
        )}
      </div>

      {/* CSS animations */}
      <style jsx global>{`
        @keyframes slideIn {
          from { opacity: 0; transform: translateX(8px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @media (max-width: 960px) {
          .admin-calendar-grid {
            grid-template-columns: 1fr !important;
          }
          .admin-calendar-daypanel {
            position: static !important;
          }
        }
      `}</style>

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

function SummaryStat({ label, value }) {
  return (
    <div style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid var(--admin-border)", background: "var(--admin-bg)" }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--admin-text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div>
      <div style={{ marginTop: 4, fontSize: 20, fontWeight: 800, color: "var(--admin-text)" }}>{value}</div>
    </div>
  );
}
