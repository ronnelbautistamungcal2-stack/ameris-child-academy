import TeacherLayout from "@/components/teacher/TeacherLayout";
import MonthlyCalendar from "@/components/calendar/MonthlyCalendar";
import { apiJson } from "@/lib/api";
import { useEffect, useState, useCallback } from "react";

const SOURCE_BADGE = {
  event: "bg-indigo-100 text-indigo-700",
  shift: "bg-blue-100 text-blue-700",
  timeoff: "bg-emerald-100 text-emerald-700",
};

const LEGEND = [
  { label: "Events", cls: "bg-indigo-100" },
  { label: "My Shifts", cls: "bg-blue-100" },
  { label: "PTO", cls: "bg-emerald-100" },
  { label: "Sick", cls: "bg-red-100" },
  { label: "Pending", cls: "bg-amber-200" },
];

export default function TeacherCalendarPage() {
  const [centers, setCenters] = useState([]);
  const [centerId, setCenterId] = useState("");
  const [calYear, setCalYear] = useState(new Date().getFullYear());
  const [calMonth, setCalMonth] = useState(new Date().getMonth());
  const [calData, setCalData] = useState({ events: [], shifts: [], timeOff: [] });
  const [filters, setFilters] = useState({ events: true, shifts: true, timeOff: true });
  const [selectedDay, setSelectedDay] = useState(null);
  const [loading, setLoading] = useState(true);

  const [error, setError] = useState("");

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
          label: `${s.startTime}–${s.endTime} (${s.position})`,
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
          label: `${t.type} (${t.status})`,
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

  const dayItems = getDayItems(selectedDay);

  return (
    <TeacherLayout title="Calendar">
      <div style={{ maxWidth: 1000, margin: "0 auto", padding: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "#111827" }}>My Calendar</h1>
          <select value={centerId} onChange={e => { setCenterId(e.target.value); setSelectedDay(null); }}
            style={{ padding: "6px 10px", border: "1px solid #e5e7eb", borderRadius: 8, fontSize: 13 }}>
            <option value="">Select center…</option>
            {centers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        {error && <div style={{ padding: 10, background: "#fef2f2", color: "#991b1b", borderRadius: 8, marginBottom: 12, fontSize: 13, border: "1px solid #fecaca" }}>{error}</div>}

        {/* Filter toggles */}
        <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
          {[
            { key: "events", label: "Events", color: "#e0e7ff" },
            { key: "shifts", label: "My Shifts", color: "#dbeafe" },
            { key: "timeOff", label: "My Time Off", color: "#d1fae5" },
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

        {centerId ? (
          <div style={{ display: "grid", gridTemplateColumns: selectedDay ? "1fr minmax(0, 300px)" : "1fr", gap: 16 }}>
            <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: 16 }}>
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
              <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: 16, alignSelf: "start" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>
                    {new Date(calYear, calMonth, selectedDay).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
                  </div>
                  <button type="button" onClick={() => setSelectedDay(null)} aria-label="Close day detail"
                    style={{ background: "none", border: "none", cursor: "pointer", fontSize: 16, color: "#9ca3af" }}>✕</button>
                </div>
                {dayItems.length === 0 && <div style={{ fontSize: 13, color: "#9ca3af" }}>No items this day</div>}
                {dayItems.map(item => (
                  <div key={item.id} style={{ padding: 8, borderRadius: 8, marginBottom: 8, border: "1px solid #f3f4f6", background: "#fafafa" }}>
                    <div>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 4, marginRight: 6 }}
                        className={SOURCE_BADGE[item._source] || "bg-gray-100 text-gray-600"}>
                        {item._source === "event" ? "Event" : item._source === "shift" ? "Shift" : "Time Off"}
                      </span>
                      <span style={{ fontSize: 13, fontWeight: 600 }}>{item.label}</span>
                    </div>
                    {item._raw?.description && (
                      <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>{item._raw.description}</div>
                    )}
                    {item._source === "shift" && (
                      <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>Position: {item._raw.position}{item._raw.notes ? ` • ${item._raw.notes}` : ""}</div>
                    )}
                    {item._source === "timeoff" && (
                      <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>Status: {item._raw.status}{item._raw.reason ? ` • ${item._raw.reason}` : ""}</div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div style={{ textAlign: "center", padding: 40, color: "#9ca3af", fontSize: 14 }}>
            Select a center to view your calendar
          </div>
        )}
      </div>
    </TeacherLayout>
  );
}
