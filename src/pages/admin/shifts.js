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
  const [selectedStaffIds, setSelectedStaffIds] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ userId: "", date: "", startTime: "08:00", endTime: "16:00", position: "Teacher", notes: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [staffQuery, setStaffQuery] = useState("");
  const [showOnlyScheduled, setShowOnlyScheduled] = useState(false);

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
        const users = await apiJson(`/api/v1/users?centerId=${centerId}&staffOnly=true`);
        setStaff(Array.isArray(users) ? users : []);
      } catch (err) { setError(err.message || "Failed to load staff"); }
    })();
  }, [centerId]);

  useEffect(() => {
    setSelectedStaffIds([]);
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

  const autoFillFromSchedules = useCallback(async () => {
    if (!centerId) return;
    try {
      await apiJson("/api/v1/shifts/generate", {
        method: "POST",
        body: JSON.stringify({ centerId, weekStart: toDateInput(weekStart) }),
      });
    } catch (err) {
      // non-fatal: staff may not have weekly schedules set up yet
    }
  }, [centerId, weekStart]);

  useEffect(() => {
    (async () => {
      await autoFillFromSchedules();
      await loadShifts();
    })();
  }, [autoFillFromSchedules, loadShifts]);

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

  const totalShifts = shifts.length;
  const weekLabel = `${fmtShortDate(weekStart)} - ${fmtShortDate(addDays(weekStart, 6))}, ${weekStart.getFullYear()}`;
  const filteredStaff = useMemo(() => {
    const q = staffQuery.trim().toLowerCase();
    return staff.filter((u) => {
      const name = (u.name || u.email || "").toLowerCase();
      if (q && !name.includes(q)) return false;
      if (!showOnlyScheduled) return true;
      return weekDays.some((d) => (shiftMap[`${u.id}_${dateKey(d)}`] || []).length > 0);
    });
  }, [staff, staffQuery, showOnlyScheduled, weekDays, shiftMap]);
  const selectedStaff = useMemo(
    () => staff.filter((user) => selectedStaffIds.includes(user.id)),
    [selectedStaffIds, staff],
  );

  const allFilteredSelected = filteredStaff.length > 0 && filteredStaff.every((user) => selectedStaffIds.includes(user.id));

  function toggleStaffSelection(userId) {
    setSelectedStaffIds((current) =>
      current.includes(userId)
        ? current.filter((id) => id !== userId)
        : [...current, userId],
    );
  }

  function toggleAllFilteredStaff() {
    setSelectedStaffIds((current) => {
      const filteredIds = filteredStaff.map((user) => user.id);
      if (filteredIds.every((id) => current.includes(id))) {
        return current.filter((id) => !filteredIds.includes(id));
      }
      return [...new Set([...current, ...filteredIds])];
    });
  }

  function clearSelectedStaff() {
    setSelectedStaffIds([]);
  }

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
      const targetStaffIds = selectedStaffIds.length ? new Set(selectedStaffIds) : null;
      const shiftsToCopy = Array.isArray(prevShifts)
        ? prevShifts.filter((shift) => !targetStaffIds || targetStaffIds.has(shift.userId))
        : [];

      if (shiftsToCopy.length === 0) {
        setError(targetStaffIds ? "No previous-week shifts were found for the selected staff" : "No shifts found in the previous week to copy"); return;
      }
      let count = 0;
      for (const s of shiftsToCopy) {
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
      setSuccess(`Copied ${count} shifts from the previous week${targetStaffIds ? " for the selected staff" : ""}`);
      await loadShifts();
    } catch (err) {
      setError(err.message || "Failed to copy shifts");
    }
  }

  function jumpToCurrentWeek() {
    setWeekStart(getMonday(new Date()));
  }

  async function applySchedulesNow() {
    setError(""); setSuccess("");
    try {
      const result = await apiJson("/api/v1/shifts/generate", {
        method: "POST",
        body: JSON.stringify({ centerId, weekStart: toDateInput(weekStart) }),
      });
      setSuccess(result?.generated ? `Added ${result.generated} shifts from weekly schedules` : "No new shifts to add from weekly schedules");
      await loadShifts();
    } catch (err) {
      setError(err.message || "Failed to apply weekly schedules");
    }
  }

  return (
    <AdminLayout title="Shift Schedules">
      <div style={{ maxWidth: 1240, margin: "0 auto", padding: 16 }}>
        <div
          style={{
            marginBottom: 16,
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
          <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
            <div>
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
                Admin Scheduling
              </div>
              <h1 style={{ fontSize: 26, fontWeight: 800, color: "var(--admin-text)", margin: "10px 0 0", lineHeight: 1.2 }}>
                Shift Schedules
              </h1>
              <p style={{ fontSize: 13, color: "var(--admin-text-muted)", marginTop: 6 }}>
                {centerId ? weekLabel : "Select a center to manage weekly schedules"}
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
                  {totalShifts} shifts this week
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
                  {staff.length} staff
                </span>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <select value={centerId} onChange={e => setCenterId(e.target.value)}
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
                }}>
                <option value="">Select center...</option>
                {centers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <button type="button" onClick={() => { resetForm(); setShowForm(!showForm); }}
                style={{
                  padding: "10px 16px",
                  background: "linear-gradient(90deg, #2563eb, #0ea5e9)",
                  color: "#fff",
                  border: "none",
                  borderRadius: 12,
                  fontWeight: 800,
                  fontSize: 13,
                  cursor: "pointer",
                  boxShadow: "0 10px 24px rgba(37,99,235,0.2)",
                }}>
                {showForm ? "Close form" : "+ Add Shift"}
              </button>
            </div>
          </div>
        </div>

        {error && <div style={{ padding: 10, background: "var(--admin-error-bg)", color: "var(--admin-error-text)", borderRadius: 10, marginBottom: 12, fontSize: 13, border: "1px solid var(--admin-error-border)" }}>{error}</div>}
        {success && <div style={{ padding: 10, background: "var(--admin-success-bg)", color: "var(--admin-success-text)", borderRadius: 10, marginBottom: 12, fontSize: 13, border: "1px solid var(--admin-success-border)" }}>{success}</div>}

        {/* Add/Edit form */}
        {showForm && (
          <div style={{ background: "var(--admin-bg)", border: "1px solid var(--admin-border)", borderRadius: 14, padding: 16, marginBottom: 16, boxShadow: "0 10px 20px rgba(15,23,42,0.06)" }}>
            <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 12, color: "var(--admin-text)" }}>{editingId ? "Edit Shift" : "Add Shift"}</div>
            <form onSubmit={saveShift}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12 }}>
                <label style={{ display: "block" }}>
                  <div style={{ fontSize: 12, color: "var(--admin-text-muted)", marginBottom: 4 }}>Staff Member *</div>
                  <select value={form.userId} onChange={e => setForm(f => ({ ...f, userId: e.target.value }))}
                    style={{ width: "100%", padding: 8, border: "1px solid var(--admin-border)", borderRadius: 8, boxSizing: "border-box", background: "var(--admin-bg)", color: "var(--admin-text)" }}>
                    <option value="">Select...</option>
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
                  style={{ padding: "8px 16px", background: "#2563eb", color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.6 : 1 }}>
                  {saving ? "Saving..." : editingId ? "Update Shift" : "Add Shift"}
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
            <div style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 16,
              flexWrap: "wrap",
              gap: 10,
              padding: "10px 12px",
              borderRadius: 14,
              border: "1px solid var(--admin-border)",
              background: "var(--admin-bg)",
            }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <button type="button" onClick={() => setWeekStart(addDays(weekStart, -7))}
                  style={{ padding: "8px 14px", border: "1px solid var(--admin-border)", borderRadius: 10, background: "var(--admin-bg)", fontWeight: 700, fontSize: 13, cursor: "pointer", color: "var(--admin-text)" }}>
                  Prev week
                </button>
                <button type="button" onClick={jumpToCurrentWeek}
                  style={{ padding: "8px 14px", border: "1px solid var(--admin-border)", borderRadius: 10, background: "var(--admin-bg-secondary)", fontWeight: 700, fontSize: 13, cursor: "pointer", color: "var(--admin-text)" }}>
                  This week
                </button>
                <button type="button" onClick={() => setWeekStart(addDays(weekStart, 7))}
                  style={{ padding: "8px 14px", border: "1px solid var(--admin-border)", borderRadius: 10, background: "var(--admin-bg)", fontWeight: 700, fontSize: 13, cursor: "pointer", color: "var(--admin-text)" }}>
                  Next week
                </button>
              </div>
              <div style={{ fontSize: 14, fontWeight: 800, color: "var(--admin-text-secondary)" }}>
                {weekLabel}
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <input
                  value={staffQuery}
                  onChange={(e) => setStaffQuery(e.target.value)}
                  placeholder="Search staff..."
                  style={{
                    padding: "8px 12px",
                    border: "1px solid var(--admin-border)",
                    borderRadius: 10,
                    fontSize: 13,
                    background: "var(--admin-bg)",
                    color: "var(--admin-text)",
                    minWidth: 180,
                  }}
                />
                <button type="button" onClick={() => setShowOnlyScheduled((v) => !v)}
                  style={{
                    padding: "8px 12px",
                    border: "1px solid var(--admin-border)",
                    borderRadius: 10,
                    background: showOnlyScheduled ? "var(--admin-accent-bg)" : "var(--admin-bg)",
                    color: "var(--admin-text-secondary)",
                    fontWeight: 700,
                    fontSize: 12,
                    cursor: "pointer",
                  }}>
                  {showOnlyScheduled ? "Showing scheduled" : "All staff"}
                </button>
                <button type="button" onClick={copyPreviousWeek}
                  style={{ padding: "8px 14px", border: "1px solid var(--admin-border)", borderRadius: 10, background: selectedStaffIds.length ? "var(--admin-accent-bg)" : "var(--admin-bg-secondary)", fontWeight: 700, fontSize: 13, cursor: "pointer", color: "var(--admin-text)" }}>
                  {selectedStaffIds.length ? `Copy selected staff (${selectedStaffIds.length})` : "Copy all from previous week"}
                </button>
                <button type="button" onClick={applySchedulesNow} title="Fill in any missing shifts from staff weekly schedules (set on the user's profile)"
                  style={{ padding: "8px 14px", border: "1px solid var(--admin-border)", borderRadius: 10, background: "var(--admin-bg-secondary)", fontWeight: 700, fontSize: 13, cursor: "pointer", color: "var(--admin-text)" }}>
                  Apply weekly schedules
                </button>
              </div>
            </div>

            {filteredStaff.length > 0 && (
              <div style={{
                marginBottom: 12,
                padding: 14,
                borderRadius: 16,
                border: "1px solid var(--admin-border)",
                background: "linear-gradient(180deg, var(--admin-bg-secondary), var(--admin-bg))",
                boxShadow: "0 8px 20px rgba(15,23,42,0.05)",
              }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                  <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 12, fontWeight: 700, color: "var(--admin-text-secondary)", cursor: "pointer" }}>
                    <input type="checkbox" checked={allFilteredSelected} onChange={toggleAllFilteredStaff} />
                    Select all visible staff
                  </label>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{
                      padding: "6px 10px",
                      borderRadius: 999,
                      background: selectedStaffIds.length ? "var(--admin-accent-bg)" : "var(--admin-bg)",
                      border: "1px solid var(--admin-border)",
                      fontSize: 12,
                      fontWeight: 700,
                      color: "var(--admin-text-secondary)",
                    }}>
                      {selectedStaffIds.length ? `${selectedStaffIds.length} staff selected for copy` : "All staff from the previous week will be copied"}
                    </span>
                    {selectedStaffIds.length ? (
                      <button
                        type="button"
                        onClick={clearSelectedStaff}
                        style={{ padding: "6px 10px", borderRadius: 999, border: "1px solid var(--admin-border)", background: "var(--admin-bg)", fontSize: 12, fontWeight: 700, cursor: "pointer", color: "var(--admin-text-secondary)" }}
                      >
                        Clear selection
                      </button>
                    ) : null}
                  </div>
                </div>

                <div style={{ marginTop: 10, fontSize: 12, color: "var(--admin-text-muted)" }}>
                  {selectedStaffIds.length
                    ? "Only the selected staff below will be copied from the previous week."
                    : "Leave everyone unchecked to copy the entire previous week's staffing pattern."}
                </div>

                {selectedStaff.length ? (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
                    {selectedStaff.map((user) => (
                      <button
                        key={user.id}
                        type="button"
                        onClick={() => toggleStaffSelection(user.id)}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                          padding: "6px 10px",
                          borderRadius: 999,
                          border: "1px solid #bfdbfe",
                          background: "#eff6ff",
                          color: "#1d4ed8",
                          fontSize: 12,
                          fontWeight: 700,
                          cursor: "pointer",
                        }}
                      >
                        <span>{user.name || user.email}</span>
                        <span style={{ color: "#60a5fa" }}>x</span>
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            )}

            {/* Weekly grid */}
            <div style={{ background: "var(--admin-bg)", border: "1px solid var(--admin-border)", borderRadius: 14, overflow: "auto", boxShadow: "0 10px 24px rgba(15,23,42,0.06)" }}>
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
                  {filteredStaff.length === 0 && (
                    <tr><td colSpan={8} style={{ textAlign: "center", padding: 24, color: "var(--admin-text-faint)" }}>No staff found</td></tr>
                  )}
                  {filteredStaff.map(user => (
                    <tr key={user.id} style={{ borderBottom: "1px solid var(--admin-border-light)" }}>
                      <td style={{ padding: "8px 12px", fontWeight: 600, verticalAlign: "top" }}>
                        <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                          <input
                            type="checkbox"
                            checked={selectedStaffIds.includes(user.id)}
                            onChange={() => toggleStaffSelection(user.id)}
                          />
                          <span>{user.name || user.email}</span>
                        </label>
                      </td>
                      {weekDays.map((d, i) => {
                        const dk = dateKey(d);
                        const cellShifts = shiftMap[`${user.id}_${dk}`] || [];
                        return (
                          <td key={i} style={{ padding: 4, verticalAlign: "top", textAlign: "center", borderLeft: "1px solid var(--admin-border-light)" }}>
                            {cellShifts.map(s => (
                              <div key={s.id} style={{
                                background: "#ede9fe", color: "#5b21b6", borderRadius: 8, padding: "4px 6px",
                                fontSize: 11, fontWeight: 700, marginBottom: 4, cursor: "pointer", position: "relative",
                              }}
                                title={`${s.position}${s.notes ? ` - ${s.notes}` : ""}`}
                              >
                                <span onClick={() => startEdit(s)}>{s.startTime}-{s.endTime}</span>
                                <button type="button" onClick={() => setDeleteTarget(s.id)} aria-label="Delete shift"
                                  style={{ position: "absolute", top: -2, right: 2, background: "none", border: "none", cursor: "pointer", fontSize: 10, color: "var(--admin-text-faint)" }}>
                                  x
                                </button>
                              </div>
                            ))}
                            <button type="button" onClick={() => openAddForCell(user.id, d)}
                              style={{ fontSize: 14, background: "none", border: "none", color: "#94a3b8", cursor: "pointer", marginTop: 2 }}
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
          <div style={{
            textAlign: "center",
            padding: 48,
            color: "var(--admin-text-faint)",
            fontSize: 14,
            background: "var(--admin-bg)",
            border: "1px solid var(--admin-border)",
            borderRadius: 14,
          }}>
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
