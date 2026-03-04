import AdminLayout from "@/components/admin/AdminLayout";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { apiJson } from "@/lib/api";
import { useEffect, useState, useCallback, useMemo } from "react";

const POSITIONS = ["Teacher", "Assistant Teacher", "Lead Teacher", "Substitute", "Admin Staff", "Other"];
const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function getMonday(d) {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(date.getFullYear(), date.getMonth(), diff);
}

function addDays(d, n) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function toDateInput(d) { return d.toISOString().split("T")[0]; }
function fmtShortDate(d) { return d.toLocaleDateString(undefined, { month: "short", day: "numeric" }); }
function dateKey(d) { return d.toISOString().split("T")[0]; }

export default function ShiftsPage() {
  const [centers, setCenters] = useState([]);
  const [centerId, setCenterId] = useState("");
  const [weekStart, setWeekStart] = useState(getMonday(new Date()));
  const [staff, setStaff] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ userId: "", date: "", startTime: "08:00", endTime: "16:00", position: "Teacher", notes: "" });
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

  useEffect(() => {
    if (!centerId) { setStaff([]); return; }
    (async () => {
      try {
        const users = await apiJson(`/api/v1/users?centerId=${centerId}`);
        setStaff(Array.isArray(users) ? users.filter(u => u.role === "TEACHER" || u.role === "ADMIN") : []);
      } catch (err) { setError(err.message || "Failed to load staff"); }
    })();
  }, [centerId]);

  const loadShifts = useCallback(async () => {
    if (!centerId) return;
    const from = toDateInput(weekStart);
    const to = toDateInput(addDays(weekStart, 6));
    try {
      const data = await apiJson(`/api/v1/shifts?centerId=${centerId}&from=${from}&to=${to}`);
      setShifts(Array.isArray(data) ? data : []);
    } catch (err) { setError(err.message || "Failed to load shifts"); }
  }, [centerId, weekStart]);

  useEffect(() => { loadShifts(); }, [loadShifts]);

  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  }, [weekStart]);

  const shiftMap = useMemo(() => {
    const map = {};
    for (const s of shifts) {
      const dk = dateKey(new Date(s.date));
      const uk = s.userId;
      const key = `${uk}_${dk}`;
      if (!map[key]) map[key] = [];
      map[key].push(s);
    }
    return map;
  }, [shifts]);

  function resetForm() {
    setForm({ userId: "", date: "", startTime: "08:00", endTime: "16:00", position: "Teacher", notes: "" });
    setEditingId(null);
  }

  function startEdit(shift) {
    setEditingId(shift.id);
    setForm({
      userId: shift.userId,
      date: toDateInput(new Date(shift.date)),
      startTime: shift.startTime,
      endTime: shift.endTime,
      position: shift.position,
      notes: shift.notes || "",
    });
    setShowForm(true);
  }

  function openAddForCell(userId, day) {
    resetForm();
    setForm(f => ({ ...f, userId, date: toDateInput(day) }));
    setShowForm(true);
  }

  async function saveShift(e) {
    e.preventDefault();
    setError(""); setSuccess("");
    if (!form.userId || !form.date || !form.startTime || !form.endTime) {
      setError("Staff, date, start time, and end time are required"); return;
    }
    setSaving(true);
    try {
      if (editingId) {
        await apiJson(`/api/v1/shifts/${editingId}`, {
          method: "PUT",
          body: JSON.stringify(form),
        });
        setSuccess("Shift updated");
      } else {
        await apiJson("/api/v1/shifts", {
          method: "POST",
          body: JSON.stringify({ ...form, centerId }),
        });
        setSuccess("Shift created");
      }
      resetForm();
      setShowForm(false);
      await loadShifts();
    } catch (err) {
      setError(err.message || "Failed to save shift");
    } finally { setSaving(false); }
  }

  async function deleteShift(id) {
    try {
      await apiJson(`/api/v1/shifts/${id}`, { method: "DELETE" });
      setSuccess("Shift deleted");
      setDeleteTarget(null);
      await loadShifts();
    } catch (err) {
      setError(err.message || "Failed to delete shift");
      setDeleteTarget(null);
    }
  }

  async function copyPreviousWeek() {
    const prevStart = addDays(weekStart, -7);
    const from = toDateInput(prevStart);
    const to = toDateInput(addDays(prevStart, 6));
    setError(""); setSuccess("");
    try {
      const prevShifts = await apiJson(`/api/v1/shifts?centerId=${centerId}&from=${from}&to=${to}`);
      if (!Array.isArray(prevShifts) || prevShifts.length === 0) {
        setError("No shifts found in the previous week to copy"); return;
      }
      let count = 0;
      for (const s of prevShifts) {
        const newDate = addDays(new Date(s.date), 7);
        try {
          await apiJson("/api/v1/shifts", {
            method: "POST",
            body: JSON.stringify({
              centerId, userId: s.userId, date: toDateInput(newDate),
              startTime: s.startTime, endTime: s.endTime, position: s.position, notes: s.notes || "",
            }),
          });
          count++;
        } catch {}
      }
      setSuccess(`Copied ${count} shifts from previous week`);
      await loadShifts();
    } catch (err) {
      setError(err.message || "Failed to copy shifts");
    }
  }

  return (
    <AdminLayout title="Shift Schedules">
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--admin-text)" }}>Shift Schedules</h1>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <select value={centerId} onChange={e => setCenterId(e.target.value)}
              style={{ padding: "6px 10px", border: "1px solid var(--admin-border)", borderRadius: 8, fontSize: 13, background: "var(--admin-bg)", color: "var(--admin-text)" }}>
              <option value="">Select center…</option>
              {centers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <button type="button" onClick={() => { resetForm(); setShowForm(!showForm); }}
              style={{ padding: "6px 14px", background: "#2563eb", color: "#fff", border: "none", borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
              {showForm ? "Cancel" : "+ Add Shift"}
            </button>
          </div>
        </div>

        {error && <div style={{ padding: 10, background: "var(--admin-error-bg)", color: "var(--admin-error-text)", borderRadius: 8, marginBottom: 12, fontSize: 13 }}>{error}</div>}
        {success && <div style={{ padding: 10, background: "var(--admin-success-bg)", color: "var(--admin-success-text)", borderRadius: 8, marginBottom: 12, fontSize: 13 }}>{success}</div>}

        {/* Add/Edit form */}
        {showForm && (
          <div style={{ background: "var(--admin-bg)", border: "1px solid var(--admin-border)", borderRadius: 10, padding: 16, marginBottom: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12 }}>{editingId ? "Edit Shift" : "Add Shift"}</div>
            <form onSubmit={saveShift}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                <label style={{ display: "block" }}>
                  <div style={{ fontSize: 12, color: "var(--admin-text-muted)", marginBottom: 4 }}>Staff Member *</div>
                  <select value={form.userId} onChange={e => setForm(f => ({ ...f, userId: e.target.value }))}
                    style={{ width: "100%", padding: 8, border: "1px solid var(--admin-border)", borderRadius: 8, boxSizing: "border-box", background: "var(--admin-bg)", color: "var(--admin-text)" }}>
                    <option value="">Select…</option>
                    {staff.map(u => <option key={u.id} value={u.id}>{u.name || u.email}</option>)}
                  </select>
                </label>
                <label style={{ display: "block" }}>
                  <div style={{ fontSize: 12, color: "var(--admin-text-muted)", marginBottom: 4 }}>Date *</div>
                  <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                    style={{ width: "100%", padding: 8, border: "1px solid var(--admin-border)", borderRadius: 8, boxSizing: "border-box", background: "var(--admin-bg)", color: "var(--admin-text)" }} />
                </label>
                <label style={{ display: "block" }}>
                  <div style={{ fontSize: 12, color: "var(--admin-text-muted)", marginBottom: 4 }}>Position</div>
                  <select value={form.position} onChange={e => setForm(f => ({ ...f, position: e.target.value }))}
                    style={{ width: "100%", padding: 8, border: "1px solid var(--admin-border)", borderRadius: 8, boxSizing: "border-box", background: "var(--admin-bg)", color: "var(--admin-text)" }}>
                    {POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </label>
                <label style={{ display: "block" }}>
                  <div style={{ fontSize: 12, color: "var(--admin-text-muted)", marginBottom: 4 }}>Start Time *</div>
                  <input type="time" value={form.startTime} onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))}
                    style={{ width: "100%", padding: 8, border: "1px solid var(--admin-border)", borderRadius: 8, boxSizing: "border-box", background: "var(--admin-bg)", color: "var(--admin-text)" }} />
                </label>
                <label style={{ display: "block" }}>
                  <div style={{ fontSize: 12, color: "var(--admin-text-muted)", marginBottom: 4 }}>End Time *</div>
                  <input type="time" value={form.endTime} onChange={e => setForm(f => ({ ...f, endTime: e.target.value }))}
                    style={{ width: "100%", padding: 8, border: "1px solid var(--admin-border)", borderRadius: 8, boxSizing: "border-box", background: "var(--admin-bg)", color: "var(--admin-text)" }} />
                </label>
                <label style={{ display: "block" }}>
                  <div style={{ fontSize: 12, color: "var(--admin-text-muted)", marginBottom: 4 }}>Notes</div>
                  <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                    style={{ width: "100%", padding: 8, border: "1px solid var(--admin-border)", borderRadius: 8, boxSizing: "border-box", background: "var(--admin-bg)", color: "var(--admin-text)" }} />
                </label>
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                <button type="submit" disabled={saving}
                  style={{ padding: "8px 16px", background: "#2563eb", color: "#fff", border: "none", borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.6 : 1 }}>
                  {saving ? "Saving…" : editingId ? "Update Shift" : "Add Shift"}
                </button>
                <button type="button" onClick={() => { resetForm(); setShowForm(false); }}
                  style={{ padding: "8px 16px", background: "var(--admin-bg-tertiary)", color: "var(--admin-text-secondary)", border: "1px solid var(--admin-border)", borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {centerId ? (
          <>
            {/* Week navigation */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
              <button type="button" onClick={() => setWeekStart(addDays(weekStart, -7))}
                style={{ padding: "6px 14px", border: "1px solid var(--admin-border)", borderRadius: 8, background: "var(--admin-bg)", fontWeight: 600, fontSize: 13, cursor: "pointer", color: "var(--admin-text)" }}>
                &larr; Prev Week
              </button>
              <div style={{ fontSize: 14, fontWeight: 700, color: "var(--admin-text-secondary)" }}>
                {fmtShortDate(weekStart)} – {fmtShortDate(addDays(weekStart, 6))}, {weekStart.getFullYear()}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button type="button" onClick={copyPreviousWeek}
                  style={{ padding: "6px 14px", border: "1px solid var(--admin-border)", borderRadius: 8, background: "var(--admin-bg-secondary)", fontWeight: 600, fontSize: 13, cursor: "pointer", color: "var(--admin-text)" }}>
                  Copy Prev Week
                </button>
                <button type="button" onClick={() => setWeekStart(addDays(weekStart, 7))}
                  style={{ padding: "6px 14px", border: "1px solid var(--admin-border)", borderRadius: 8, background: "var(--admin-bg)", fontWeight: 600, fontSize: 13, cursor: "pointer", color: "var(--admin-text)" }}>
                  Next Week &rarr;
                </button>
              </div>
            </div>

            {/* Weekly grid */}
            <div style={{ background: "var(--admin-bg)", border: "1px solid var(--admin-border)", borderRadius: 10, overflow: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: "var(--admin-bg-secondary)" }}>
                    <th style={{ padding: "10px 12px", textAlign: "left", borderBottom: "1px solid var(--admin-border)", fontWeight: 700, fontSize: 12, color: "var(--admin-text-muted)", minWidth: 140 }}>
                      Staff
                    </th>
                    {weekDays.map((d, i) => {
                      const isToday = d.toDateString() === new Date().toDateString();
                      return (
                        <th key={i} style={{
                          padding: "10px 8px", textAlign: "center", borderBottom: "1px solid var(--admin-border)", fontWeight: 600, fontSize: 12,
                          color: isToday ? "#2563eb" : "var(--admin-text-muted)",
                          background: isToday ? "var(--admin-accent-bg)" : undefined,
                          minWidth: 100,
                        }}>
                          {DAY_LABELS[i]}<br />{fmtShortDate(d)}
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {staff.length === 0 && (
                    <tr><td colSpan={8} style={{ textAlign: "center", padding: 24, color: "var(--admin-text-faint)" }}>No staff found</td></tr>
                  )}
                  {staff.map(user => (
                    <tr key={user.id} style={{ borderBottom: "1px solid var(--admin-border-light)" }}>
                      <td style={{ padding: "8px 12px", fontWeight: 600, verticalAlign: "top" }}>{user.name || user.email}</td>
                      {weekDays.map((d, i) => {
                        const dk = dateKey(d);
                        const cellShifts = shiftMap[`${user.id}_${dk}`] || [];
                        return (
                          <td key={i} style={{ padding: 4, verticalAlign: "top", textAlign: "center", borderLeft: "1px solid var(--admin-border-light)" }}>
                            {cellShifts.map(s => (
                              <div key={s.id} style={{
                                background: "#ede9fe", color: "#5b21b6", borderRadius: 6, padding: "3px 6px",
                                fontSize: 11, fontWeight: 600, marginBottom: 2, cursor: "pointer", position: "relative",
                              }}
                                title={`${s.position}${s.notes ? ` - ${s.notes}` : ""}`}
                              >
                                <span onClick={() => startEdit(s)}>{s.startTime}–{s.endTime}</span>
                                <button type="button" onClick={() => setDeleteTarget(s.id)} aria-label="Delete shift"
                                  style={{ position: "absolute", top: -2, right: 2, background: "none", border: "none", cursor: "pointer", fontSize: 10, color: "var(--admin-text-faint)" }}>
                                  ✕
                                </button>
                              </div>
                            ))}
                            <button type="button" onClick={() => openAddForCell(user.id, d)}
                              style={{ fontSize: 14, background: "none", border: "none", color: "#d1d5db", cursor: "pointer", marginTop: 2 }}
                              title="Add shift">
                              +
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <div style={{ textAlign: "center", padding: 40, color: "var(--admin-text-faint)", fontSize: 14 }}>
            Select a center to manage shift schedules
          </div>
        )}
      </div>
      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Shift"
        message="Are you sure you want to delete this shift? This action cannot be undone."
        confirmLabel="Delete"
        variant="danger"
        onConfirm={() => deleteShift(deleteTarget)}
        onCancel={() => setDeleteTarget(null)}
      />
    </AdminLayout>
  );
}
