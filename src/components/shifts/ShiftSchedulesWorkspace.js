import { NAVY } from "@/components/reports/reportUi";
import Skeleton from "@/components/ui/Skeleton";
import useSyncedCenterId from "@/hooks/useSyncedCenterId";
import { apiJson } from "@/lib/api";
import { shiftDayKey, todayKey } from "@/lib/checklistTime";
import { roleLabel } from "@/lib/roles";
import { useCallback, useEffect, useMemo, useState } from "react";

// Shift Schedules (client mockup 23-Shift-Schedules), for coaches and HR: one
// row per currently employed staff member, Monday to Sunday. Clicking a cell
// adds or edits that day's shift. Shift dates are "YYYY-MM-DD" keys.

const POSITIONS = ["Lead Teacher", "Teacher", "Assistant Teacher", "After School", "Floater", "Substitute", "Kitchen Staff", "Janitorial", "Office Staff", "Other"];
const control = "rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800";
const button = "rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200";

function mondayKey(key = todayKey()) {
  const [y, m, d] = key.split("-").map(Number);
  const day = new Date(y, m - 1, d).getDay();
  return shiftDayKey(key, day === 0 ? -6 : 1 - day);
}

function dayLabel(key, options) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", options);
}

function formatTime(hhmm) {
  const [h, m] = String(hhmm || "").split(":").map(Number);
  if (Number.isNaN(h)) return "";
  const d = new Date();
  d.setHours(h, m || 0, 0, 0);
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

export function ShiftIcon({ className = "h-12 w-12" }) {
  return (
    <span className={`flex shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white ${className}`} aria-hidden>
      <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5m-12-3h.008v.008H9v-.008zm3 0h.008v.008H12v-.008zm3 0h.008v.008H15v-.008z" />
      </svg>
    </span>
  );
}

export default function ShiftSchedulesWorkspace({ Layout, layoutProps = {} }) {
  const [centers, setCenters] = useState([]);
  const [centerId, setCenterId] = useState("");
  const [weekStart, setWeekStart] = useState(() => mondayKey());
  const [staff, setStaff] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [deptFilter, setDeptFilter] = useState("");
  const [editing, setEditing] = useState(null); // { userId, date, shift? }
  const [selectedIds, setSelectedIds] = useState([]); // copy only these staff
  const [busy, setBusy] = useState(false);

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
    apiJson(`/api/v1/users?centerId=${encodeURIComponent(centerId)}&roles=TEACHER,OTHER_STAFF,KITCHEN_STAFF,HR_STAFF,STUDENT_SUPPORT,COACH`)
      .then((rows) => setStaff(Array.isArray(rows) ? rows : []))
      .catch((e) => setError(e.message || "Failed to load staff"));
  }, [centerId]);

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => shiftDayKey(weekStart, i)), [weekStart]);

  const loadShifts = useCallback(async () => {
    if (!centerId) return;
    setLoading(true);
    try {
      const rows = await apiJson(`/api/v1/shifts?centerId=${encodeURIComponent(centerId)}&from=${days[0]}&to=${days[6]}`);
      setShifts(Array.isArray(rows) ? rows : []);
    } catch (e) {
      setError(e.message || "Failed to load shifts");
    } finally {
      setLoading(false);
    }
  }, [centerId, days]);

  useEffect(() => {
    loadShifts();
  }, [loadShifts]);

  const byCell = useMemo(() => {
    const map = {};
    for (const s of shifts) {
      const key = `${s.userId}|${new Date(s.date).toISOString().slice(0, 10)}`;
      (map[key] ||= []).push(s);
    }
    for (const list of Object.values(map)) list.sort((a, b) => a.startTime.localeCompare(b.startTime));
    return map;
  }, [shifts]);

  const roles = useMemo(() => [...new Set(staff.flatMap((u) => (u.roles?.length ? u.roles : [u.role])))].sort(), [staff]);
  const departments = useMemo(() => [...new Set(staff.map((u) => u.staffDepartment).filter(Boolean))].sort(), [staff]);
  const rows = staff.filter((u) => {
    const userRoles = u.roles?.length ? u.roles : [u.role];
    if (roleFilter && !userRoles.includes(roleFilter)) return false;
    if (deptFilter && u.staffDepartment !== deptFilter) return false;
    const q = search.trim().toLowerCase();
    return !q || (u.name || u.email || "").toLowerCase().includes(q);
  });

  const positionOf = (user) => {
    const latest = shifts.filter((s) => s.userId === user.id).map((s) => s.position).find(Boolean);
    return latest || user.staffDepartment || roleLabel(user.role);
  };

  async function run(action, message) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await action();
      setNotice(typeof message === "function" ? message(result) : message);
      await loadShifts();
    } catch (e) {
      setError(e.message || "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  const copyPreviousWeek = () =>
    run(async () => {
      const prevDays = days.map((d) => shiftDayKey(d, -7));
      const previous = (await apiJson(`/api/v1/shifts?centerId=${encodeURIComponent(centerId)}&from=${prevDays[0]}&to=${prevDays[6]}`)) || [];
      const only = selectedIds.length ? new Set(selectedIds) : null;
      const existing = new Set(shifts.map((s) => `${s.userId}|${new Date(s.date).toISOString().slice(0, 10)}|${s.startTime}`));
      let copied = 0;
      for (const s of previous.filter((p) => !only || only.has(p.userId))) {
        const date = shiftDayKey(new Date(s.date).toISOString().slice(0, 10), 7);
        if (existing.has(`${s.userId}|${date}|${s.startTime}`)) continue;
        await apiJson("/api/v1/shifts", {
          method: "POST",
          body: JSON.stringify({ centerId, userId: s.userId, date, startTime: s.startTime, endTime: s.endTime, position: s.position, notes: s.notes || "" }),
        });
        copied += 1;
      }
      return copied;
    }, (n) =>
      n
        ? `Copied ${n} shifts from the previous week${selectedIds.length ? " for the selected staff" : ""}`
        : "Nothing new to copy from the previous week.");

  const applyWeekly = () =>
    run(
      () => apiJson("/api/v1/shifts/generate", { method: "POST", body: JSON.stringify({ centerId, weekStart }) }),
      (r) => (r?.generated ? `Added ${r.generated} shifts from weekly schedules.` : "No new shifts to add from weekly schedules."),
    );

  return (
    <Layout title="Shift Schedules" {...layoutProps}>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <ShiftIcon />
            <h1 className={`text-3xl font-black ${NAVY}`}>Shift Schedules</h1>
          </div>
          <select value={centerId} onChange={(e) => setCenterId(e.target.value)} className={`${control} w-56`} aria-label="Center">
            <option value="">Select a center...</option>
            {centers.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        <div className="space-y-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex gap-2">
              <button type="button" className={button} onClick={() => setWeekStart(shiftDayKey(weekStart, -7))}>Prev week</button>
              <button
                type="button"
                className={`${button} ${weekStart === mondayKey() ? "border-blue-300 bg-blue-50 text-blue-800" : ""}`}
                onClick={() => setWeekStart(mondayKey())}
              >
                This week
              </button>
              <button type="button" className={button} onClick={() => setWeekStart(shiftDayKey(weekStart, 7))}>Next week</button>
            </div>
            <div className={`text-lg font-black ${NAVY}`}>
              {dayLabel(days[0], { month: "short", day: "numeric" })} – {dayLabel(days[6], { month: "short", day: "numeric", year: "numeric" })}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search staff..." className={`${control} w-48`} aria-label="Search staff" />
            <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className={control} aria-label="Role">
              <option value="">All staff</option>
              {roles.map((r) => (
                <option key={r} value={r}>{roleLabel(r)}</option>
              ))}
            </select>
            <select value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)} className={control} aria-label="Department">
              <option value="">All departments</option>
              {departments.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
            <button type="button" className={button} disabled={!centerId || busy} onClick={copyPreviousWeek}>
              {selectedIds.length ? `Copy selected staff (${selectedIds.length})` : "Copy all from previous week"}
            </button>
            <button type="button" className={button} disabled={!centerId || busy} onClick={applyWeekly} title="Fill in missing shifts from each person's weekly schedule (set on their profile)">
              Apply weekly schedules
            </button>
          </div>
        </div>

        {selectedIds.length ? (
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900">
            <strong>{selectedIds.length} staff selected for copy</strong>
            <span>Only the selected staff below will be copied from the previous week.</span>
            <button type="button" onClick={() => setSelectedIds([])} className="font-semibold underline">Clear</button>
          </div>
        ) : null}
        {error ? <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
        {notice ? <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{notice}</div> : null}

        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
          {!centerId ? (
            <p className="p-6 text-sm text-gray-500">Choose a center to see its shifts.</p>
          ) : loading && !shifts.length && !staff.length ? (
            <div className="p-6"><Skeleton count={6} /></div>
          ) : (
            <table className="w-full min-w-[1000px] table-fixed text-sm">
              <thead className="bg-gray-50 text-xs font-bold text-[#0b2a5b] dark:bg-gray-800 dark:text-blue-100">
                <tr>
                  <th className="w-48 px-4 py-3 text-left">STAFF</th>
                  {days.map((d) => (
                    <th key={d} className="px-2 py-3 text-center">
                      <div>{dayLabel(d, { weekday: "short" }).toUpperCase()}</div>
                      <div className="font-semibold text-gray-500">{dayLabel(d, { month: "short", day: "numeric" }).toUpperCase()}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {rows.map((user) => (
                  <tr key={user.id}>
                    <td className="px-4 py-2">
                      <label className="flex items-start gap-2">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(user.id)}
                          onChange={() => setSelectedIds((ids) => (ids.includes(user.id) ? ids.filter((x) => x !== user.id) : [...ids, user.id]))}
                          aria-label={`Select ${user.name || user.email} for copying`}
                          className="mt-1 h-4 w-4"
                        />
                        <span>
                          <span className="block font-bold text-blue-800 dark:text-blue-300">{user.name || user.email}</span>
                          <span className="block text-xs text-gray-500">{positionOf(user)}</span>
                        </span>
                      </label>
                    </td>
                    {days.map((d) => {
                      const list = byCell[`${user.id}|${d}`] || [];
                      return (
                        <td key={d} className="px-1.5 py-1.5">
                          <div className="flex flex-col gap-1">
                            {list.map((s) => (
                              <button
                                key={s.id}
                                type="button"
                                onClick={() => setEditing({ userId: user.id, date: d, shift: s })}
                                title={s.notes || s.position}
                                className="w-full rounded-lg border border-gray-200 px-2 py-2 text-center text-xs font-semibold text-gray-800 hover:border-blue-300 hover:bg-blue-50 dark:border-gray-700 dark:text-gray-200"
                              >
                                {formatTime(s.startTime)} - {formatTime(s.endTime)}
                              </button>
                            ))}
                            {!list.length ? (
                              <button
                                type="button"
                                onClick={() => setEditing({ userId: user.id, date: d })}
                                aria-label={`Add a shift for ${user.name || user.email} on ${d}`}
                                className="w-full rounded-lg border border-gray-200 px-2 py-2 text-center text-xs text-gray-400 hover:border-blue-300 hover:bg-blue-50 dark:border-gray-700"
                              >
                                —
                              </button>
                            ) : null}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
                {!rows.length ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-gray-500">No staff match these filters.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          )}
        </div>
      </div>
      {editing ? (
        <ShiftDialog
          editing={editing}
          staffName={staff.find((u) => u.id === editing.userId)?.name || ""}
          defaultPosition={positionOf(staff.find((u) => u.id === editing.userId) || {})}
          centerId={centerId}
          onClose={() => setEditing(null)}
          onSaved={async (message) => {
            setEditing(null);
            setNotice(message);
            await loadShifts();
          }}
        />
      ) : null}
    </Layout>
  );
}

function ShiftDialog({ editing, staffName, defaultPosition, centerId, onClose, onSaved }) {
  const existing = editing.shift;
  const [form, setForm] = useState({
    startTime: existing?.startTime || "08:00",
    endTime: existing?.endTime || "16:30",
    position: existing?.position || (POSITIONS.includes(defaultPosition) ? defaultPosition : "Teacher"),
    notes: existing?.notes || "",
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function save(event) {
    event.preventDefault();
    if (form.endTime <= form.startTime) {
      setError("The end time must be after the start time.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      if (existing) {
        await apiJson(`/api/v1/shifts/${existing.id}`, { method: "PUT", body: JSON.stringify(form) });
      } else {
        await apiJson("/api/v1/shifts", { method: "POST", body: JSON.stringify({ ...form, centerId, userId: editing.userId, date: editing.date }) });
      }
      await onSaved(existing ? "Shift updated." : "Shift added.");
    } catch (e) {
      setError(e.message || "Failed to save the shift");
      setSaving(false);
    }
  }

  async function remove() {
    if (!confirm("Delete this shift?")) return;
    setSaving(true);
    try {
      await apiJson(`/api/v1/shifts/${existing.id}`, { method: "DELETE" });
      await onSaved("Shift deleted.");
    } catch (e) {
      setError(e.message || "Failed to delete the shift");
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4" role="dialog" aria-modal="true" aria-label="Shift">
      <form onSubmit={save} className="w-full max-w-md space-y-3 rounded-2xl bg-white p-6 shadow-2xl dark:bg-gray-900">
        <div>
          <h2 className={`text-xl font-black ${NAVY}`}>{existing ? "Edit Shift" : "Add Shift"}</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {staffName} · {dayLabel(editing.date, { weekday: "long", month: "short", day: "numeric" })}
          </p>
        </div>
        {error ? <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm font-semibold">
            Start
            <input type="time" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} className={`${control} mt-1 w-full`} required />
          </label>
          <label className="block text-sm font-semibold">
            End
            <input type="time" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} className={`${control} mt-1 w-full`} required />
          </label>
        </div>
        <label className="block text-sm font-semibold">
          Position
          <select value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} className={`${control} mt-1 w-full`}>
            {[...new Set([form.position, ...POSITIONS])].map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-semibold">
          Notes
          <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className={`${control} mt-1 w-full`} />
        </label>
        <div className="flex items-center justify-between pt-2">
          {existing ? (
            <button type="button" onClick={remove} disabled={saving} className="text-sm font-semibold text-red-600 hover:underline">
              Delete shift
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className={button}>Cancel</button>
            <button type="submit" disabled={saving} className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-60">
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
