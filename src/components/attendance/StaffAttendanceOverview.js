import { NAVY } from "@/components/reports/reportUi";
import TimeSheetModal from "@/components/timesheets/TimeSheetModal";
import Skeleton from "@/components/ui/Skeleton";
import useSyncedCenterId from "@/hooks/useSyncedCenterId";
import { apiJson } from "@/lib/api";
import { formatDayKey, todayKey } from "@/lib/checklistTime";
import { RANGE_OPTIONS, rangeContaining, stepRange } from "@/lib/payPeriods";
import { roleLabel } from "@/lib/roles";
import { useCallback, useEffect, useMemo, useState } from "react";

// Staff Attendance Overview (client mockups 25-Staff-Attendance), for coaches
// and HR: hours worked per employee for the pay period (highest first), the
// day's sign in/out with the clock icon opening Employee Time, and "Move
// Today" to put a staff member in another classroom for the day.

const AVATAR_TONES = ["bg-pink-100 text-pink-700", "bg-sky-100 text-sky-700", "bg-violet-100 text-violet-700", "bg-emerald-100 text-emerald-700", "bg-amber-100 text-amber-700", "bg-indigo-100 text-indigo-700"];
const control = "rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800";
const card = "rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900";
const ATTENDANCE_FILTERS = [
  { value: "IN", label: "Signed In" },
  { value: "OUT", label: "Signed Out" },
  { value: "NONE", label: "Not Signed In" },
  { value: "ABSENT", label: "Absent" },
];

const time = (v) => (v ? new Date(v).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : "—");
const hhmm = (v) => {
  const [h, m] = String(v || "").split(":").map(Number);
  const d = new Date();
  d.setHours(h, m || 0, 0, 0);
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
};

function Avatar({ person, size = "h-9 w-9 text-xs" }) {
  const tone = AVATAR_TONES[[...String(person.id)].reduce((s, c) => s + c.charCodeAt(0), 0) % AVATAR_TONES.length];
  const initials = String(person.name || "?").split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join("");
  return person.pictureUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={person.pictureUrl} alt="" className={`${size} shrink-0 rounded-full object-cover`} />
  ) : (
    <span className={`flex ${size} shrink-0 items-center justify-center rounded-full font-bold ${tone}`}>{initials}</span>
  );
}

function attendanceState(p) {
  if (p.status === "ABSENT") return "ABSENT";
  if (p.clockIn && !p.clockOut) return "IN";
  if (p.clockOut) return "OUT";
  return "NONE";
}

export default function StaffAttendanceOverview({ Layout, layoutProps = {} }) {
  const [centers, setCenters] = useState([]);
  const [centerId, setCenterId] = useState("");
  const [rangeKind, setRangeKind] = useState("PAY_PERIOD");
  const [range, setRange] = useState(() => rangeContaining("PAY_PERIOD"));
  const [date, setDate] = useState(todayKey());
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [deptFilter, setDeptFilter] = useState("");
  const [dayOpen, setDayOpen] = useState(true);
  const [daySearch, setDaySearch] = useState("");
  const [roomFilter, setRoomFilter] = useState("");
  const [stateFilter, setStateFilter] = useState("");
  const [timeSheetId, setTimeSheetId] = useState(null);
  const [moveOpen, setMoveOpen] = useState(false);

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

  const load = useCallback(async () => {
    if (!centerId) return;
    setError("");
    try {
      const params = new URLSearchParams({ centerId, from: range.from, to: range.to, date });
      setData(await apiJson(`/api/v1/staff-attendance/overview?${params}`));
    } catch (e) {
      setError(e.message || "Failed to load staff attendance");
    }
  }, [centerId, range, date]);

  useEffect(() => {
    load();
  }, [load]);

  const staff = data?.staff || [];
  const roles = useMemo(() => [...new Set(staff.map((p) => p.role))].sort(), [staff]);
  const departments = useMemo(() => [...new Set(staff.map((p) => p.department).filter(Boolean))].sort(), [staff]);
  const filtered = staff.filter((p) => {
    if (roleFilter && p.role !== roleFilter) return false;
    if (deptFilter && p.department !== deptFilter) return false;
    const q = search.trim().toLowerCase();
    return !q || p.name.toLowerCase().includes(q);
  });
  const dayRows = filtered
    .filter((p) => {
      if (roomFilter && p.classRoomId !== roomFilter) return false;
      if (stateFilter && attendanceState(p) !== stateFilter) return false;
      const q = daySearch.trim().toLowerCase();
      return !q || p.name.toLowerCase().includes(q);
    })
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <Layout title="Staff Attendance" {...layoutProps}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <aside className={`${card} w-full p-4 lg:w-64 lg:shrink-0`}>
          <h2 className={`text-xl font-black ${NAVY}`}>Employees</h2>
          <div className="mt-3 space-y-2">
            <select value={centerId} onChange={(e) => setCenterId(e.target.value)} className={`${control} w-full`} aria-label="Center">
              <option value="">Select a center...</option>
              {centers.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search staff..." className={`${control} w-full`} aria-label="Search staff" />
            <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className={`${control} w-full`} aria-label="Role">
              <option value="">All Roles</option>
              {roles.map((r) => (
                <option key={r} value={r}>{roleLabel(r)}</option>
              ))}
            </select>
            <select value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)} className={`${control} w-full`} aria-label="Department">
              <option value="">All Departments</option>
              {departments.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
          <ul className="mt-3 max-h-[640px] divide-y divide-gray-100 overflow-y-auto dark:divide-gray-800">
            {filtered
              .slice()
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((p) => (
                <li key={p.id}>
                  <button type="button" onClick={() => setTimeSheetId(p.id)} className="flex w-full items-center gap-3 px-1 py-2 text-left hover:bg-blue-50 dark:hover:bg-gray-800" title="Open Employee Time">
                    <Avatar person={p} />
                    <span className="min-w-0">
                      <span className={`block truncate text-sm font-semibold ${NAVY}`}>{p.name}</span>
                      <span className="block truncate text-xs text-gray-500">{p.position}</span>
                    </span>
                  </button>
                </li>
              ))}
          </ul>
        </aside>

        <div className="min-w-0 flex-1 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="text-5xl text-blue-600" aria-hidden>👥</span>
              <div>
                <h1 className={`text-3xl font-black ${NAVY}`}>Staff Attendance</h1>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Total hours worked by each employee ({RANGE_OPTIONS.find((o) => o.value === rangeKind)?.label.toLowerCase()}).
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center rounded-lg border border-gray-300 bg-white dark:border-gray-600 dark:bg-gray-800">
                <button type="button" onClick={() => setRange(stepRange(rangeKind, range, -1))} className="px-3 py-2 text-blue-700" aria-label="Previous period">‹</button>
                <span className={`min-w-[190px] text-center text-sm font-bold ${NAVY}`}>
                  {formatDayKey(range.from, { month: "short", day: "numeric", year: "numeric" })} - {formatDayKey(range.to, { month: "short", day: "numeric", year: "numeric" })}
                </span>
                <button type="button" onClick={() => setRange(stepRange(rangeKind, range, 1))} className="px-3 py-2 text-blue-700" aria-label="Next period">›</button>
              </div>
              <select
                value={rangeKind}
                onChange={(e) => {
                  setRangeKind(e.target.value);
                  setRange(rangeContaining(e.target.value));
                }}
                className={`${control} text-blue-700`}
                aria-label="Period"
              >
                {RANGE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>

          {error ? <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}

          <div className={`${card} overflow-hidden`}>
            {!centerId ? (
              <p className="p-6 text-sm text-gray-500">Choose a center to see staff attendance.</p>
            ) : !data ? (
              <div className="p-6"><Skeleton count={6} /></div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-blue-50/60 text-left font-bold text-[#0b2a5b] dark:bg-gray-800 dark:text-blue-100">
                  <tr>
                    <th className="px-6 py-3">Staff Member</th>
                    <th className="px-6 py-3 text-right">Total Hours ↓</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {filtered.map((p) => (
                    <tr key={p.id}>
                      <td className="px-6 py-3">
                        <button type="button" onClick={() => setTimeSheetId(p.id)} className="text-base text-blue-800 hover:underline dark:text-blue-300">
                          {p.name}
                        </button>
                      </td>
                      <td className={`px-6 py-3 text-right text-base font-bold ${NAVY}`}>{p.totalHours.toFixed(2)}</td>
                    </tr>
                  ))}
                  {!filtered.length ? (
                    <tr>
                      <td colSpan={2} className="px-6 py-8 text-center text-gray-500">No staff match these filters.</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            )}
          </div>

          {centerId && data ? (
            <div className={`${card} p-4`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <button type="button" onClick={() => setDayOpen((v) => !v)} aria-expanded={dayOpen} className="flex items-center gap-2">
                  <span className="text-gray-500">{dayOpen ? "▼" : "▶"}</span>
                  <h2 className={`text-xl font-black ${NAVY}`}>Staff Attendance</h2>
                </button>
                <div className="flex flex-wrap items-center gap-2">
                  <button type="button" onClick={() => setMoveOpen(true)} className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-bold text-blue-700 hover:bg-blue-100">
                    ⇄ Move Today
                  </button>
                  <label className="flex items-center gap-2 text-sm font-semibold">
                    <span className="sr-only">Date</span>
                    <input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} className={control} aria-label="Attendance date" />
                  </label>
                  {date !== todayKey() ? (
                    <button type="button" onClick={() => setDate(todayKey())} className="text-sm font-semibold text-blue-700 hover:underline">Today</button>
                  ) : null}
                </div>
              </div>
              {dayOpen ? (
                <>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                    <input value={daySearch} onChange={(e) => setDaySearch(e.target.value)} placeholder="Search staff name..." className={`${control} w-64`} aria-label="Search staff name" />
                    <div className="flex gap-2">
                      <select value={roomFilter} onChange={(e) => setRoomFilter(e.target.value)} className={control} aria-label="Classroom">
                        <option value="">All Classrooms</option>
                        {data.classrooms.map((c) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                      <select value={stateFilter} onChange={(e) => setStateFilter(e.target.value)} className={control} aria-label="Status">
                        <option value="">All Statuses</option>
                        {ATTENDANCE_FILTERS.map((f) => (
                          <option key={f.value} value={f.value}>{f.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="mt-3 overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
                    <table className="w-full min-w-[640px] text-sm">
                      <thead className="bg-blue-50/60 text-xs font-bold text-[#0b2a5b] dark:bg-gray-800 dark:text-blue-100">
                        <tr>
                          <th className="px-4 py-2 text-left">Staff Name</th>
                          <th className="px-3 py-2 text-left">Classroom</th>
                          <th className="px-3 py-2 text-center">Sign In Time</th>
                          <th className="px-3 py-2 text-center">Sign Out Time</th>
                          <th className="px-3 py-2 text-center">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                        {dayRows.map((p) => (
                          <tr key={p.id}>
                            <td className="px-4 py-2">
                              <div className="flex items-center gap-2">
                                <Avatar person={p} size="h-7 w-7 text-[10px]" />
                                <span className={`font-semibold ${NAVY}`}>{p.name}</span>
                              </div>
                            </td>
                            <td className="px-3 py-2 text-gray-700 dark:text-gray-300">
                              {p.classRoomName || (p.moved ? "Not Assigned" : "—")}
                              {p.moved ? <span className="ml-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">Moved today</span> : null}
                            </td>
                            <td className="px-3 py-2 text-center">{p.status === "ABSENT" ? <span className="font-semibold text-red-600">Absent</span> : time(p.clockIn)}</td>
                            <td className="px-3 py-2 text-center">{time(p.clockOut)}</td>
                            <td className="px-3 py-2 text-center">
                              <button
                                type="button"
                                onClick={() => setTimeSheetId(p.id)}
                                aria-label={`Employee time for ${p.name}`}
                                title="Employee Time"
                                className="rounded-lg border border-blue-300 px-2 py-1 text-blue-700 hover:bg-blue-50"
                              >
                                🕒
                              </button>
                            </td>
                          </tr>
                        ))}
                        {!dayRows.length ? (
                          <tr>
                            <td colSpan={5} className="px-4 py-6 text-center text-gray-500">No staff match these filters.</td>
                          </tr>
                        ) : null}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
      {timeSheetId ? (
        <TimeSheetModal
          kind="staff"
          subjectId={timeSheetId}
          subjects={staff.map(({ id, name }) => ({ id, name }))}
          onClose={() => {
            setTimeSheetId(null);
            load();
          }}
        />
      ) : null}
      {moveOpen && data ? (
        <MoveStaffDialog
          staff={staff}
          classrooms={data.classrooms}
          centerId={centerId}
          date={date}
          onClose={() => setMoveOpen(false)}
          onSaved={() => {
            setMoveOpen(false);
            load();
          }}
        />
      ) : null}
    </Layout>
  );
}

const ROOM_DOTS = ["bg-pink-400", "bg-yellow-400", "bg-green-500", "bg-blue-500", "bg-violet-500", "bg-orange-500", "bg-teal-500"];

function MoveStaffDialog({ staff, classrooms, centerId, date, onClose, onSaved }) {
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [toRoom, setToRoom] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const people = staff.filter((p) => p.name.toLowerCase().includes(search.trim().toLowerCase())).sort((a, b) => a.name.localeCompare(b.name));
  const selected = staff.find((p) => p.id === selectedId);
  const homeName = selected?.homeClassRoomId ? classrooms.find((c) => c.id === selected.homeClassRoomId)?.name : "";

  async function save() {
    if (!selected || toRoom === "") return;
    setSaving(true);
    setError("");
    try {
      await apiJson("/api/v1/staff-day-moves", {
        method: "PUT",
        body: JSON.stringify({ centerId, userId: selected.id, date, toClassRoomId: toRoom === "FLOAT" ? null : toRoom }),
      });
      onSaved();
    } catch (e) {
      setError(e.message || "Failed to move the staff member");
      setSaving(false);
    }
  }

  async function undo() {
    setSaving(true);
    try {
      await apiJson("/api/v1/staff-day-moves", { method: "DELETE", body: JSON.stringify({ centerId, userId: selected.id, date }) });
      onSaved();
    } catch (e) {
      setError(e.message || "Failed to undo the move");
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/50 px-4 py-10" role="dialog" aria-modal="true" aria-label="Move Staff for Today">
      <div className="w-full max-w-3xl rounded-2xl bg-white shadow-2xl dark:bg-gray-900">
        <div className="flex items-start justify-between px-6 pt-5">
          <div>
            <h2 className={`text-2xl font-black ${NAVY}`}>⇄ Move Staff for Today</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Select a staff member to move to a different classroom for {date === todayKey() ? "today" : formatDayKey(date)}.
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="text-2xl leading-none text-gray-500 hover:text-gray-800">×</button>
        </div>
        {error ? <div className="mx-6 mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
        <div className="grid gap-4 px-6 py-4 md:grid-cols-2">
          <div className="rounded-xl border border-gray-200 p-2 dark:border-gray-700">
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search staff..." className={`${control} w-full`} aria-label="Search staff to move" />
            <ul className="mt-2 max-h-80 space-y-1 overflow-y-auto">
              {people.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedId(p.id);
                      setToRoom("");
                    }}
                    className={`flex w-full items-center gap-2 rounded-lg border px-2 py-1.5 text-left ${selectedId === p.id ? "border-blue-300 bg-blue-50 dark:bg-blue-950" : "border-transparent hover:bg-gray-50 dark:hover:bg-gray-800"}`}
                  >
                    <Avatar person={p} size="h-8 w-8 text-[10px]" />
                    <span className="min-w-0 flex-1">
                      <span className={`block truncate text-sm font-semibold ${NAVY}`}>{p.name}</span>
                      <span className="block truncate text-xs text-gray-500">{p.position}</span>
                    </span>
                    <span className="text-xs text-gray-500">{p.classRoomName || "Not Assigned"}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-xl border border-gray-200 p-4 dark:border-gray-700">
            {!selected ? (
              <p className="text-sm text-gray-500">Pick a staff member on the left.</p>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <Avatar person={selected} size="h-12 w-12 text-base" />
                  <div>
                    <div className={`text-lg font-black ${NAVY}`}>{selected.name}</div>
                    <div className="text-sm text-gray-500">{selected.position}</div>
                  </div>
                </div>
                <div>
                  <div className={`text-sm font-bold ${NAVY}`}>Current Assignment for Today</div>
                  <div className="mt-1 flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-800">
                    <div>
                      <div className="font-semibold">{selected.classRoomName || "Not Assigned"}</div>
                      {selected.moved ? <div className="text-xs text-amber-700">Moved for the day (usually {homeName || "Not Assigned"})</div> : null}
                    </div>
                    <div className="text-sm text-gray-600">{selected.shift ? `${hhmm(selected.shift.startTime)} – ${hhmm(selected.shift.endTime)}` : "No shift"}</div>
                  </div>
                </div>
                <div>
                  <div className={`text-sm font-bold ${NAVY}`}>New Classroom for Today</div>
                  <div className="mt-1 max-h-56 space-y-1 overflow-y-auto rounded-lg border border-gray-200 p-1 dark:border-gray-700" role="listbox" aria-label="New classroom">
                    {[...classrooms.map((c, i) => ({ id: c.id, name: c.name, dot: ROOM_DOTS[i % ROOM_DOTS.length] })), { id: "FLOAT", name: "Not Assigned (Float)", dot: "bg-gray-400" }].map((room) => (
                      <button
                        key={room.id}
                        type="button"
                        role="option"
                        aria-selected={toRoom === room.id}
                        onClick={() => setToRoom(room.id)}
                        className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm ${toRoom === room.id ? "bg-blue-50 font-semibold dark:bg-blue-950" : "hover:bg-gray-50 dark:hover:bg-gray-800"}`}
                      >
                        <span className={`h-3 w-3 rounded-full ${room.dot}`} />
                        {room.name}
                      </button>
                    ))}
                  </div>
                </div>
                {selected.moved ? (
                  <button type="button" onClick={undo} disabled={saving} className="text-sm font-semibold text-red-600 hover:underline">
                    Undo today&apos;s move
                  </button>
                ) : null}
              </div>
            )}
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-gray-200 px-6 py-4 dark:border-gray-700">
          <button type="button" onClick={onClose} className="rounded-lg border border-blue-300 px-5 py-2 text-sm font-bold text-blue-700 hover:bg-blue-50">Cancel</button>
          <button type="button" onClick={save} disabled={!selected || toRoom === "" || saving} className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50">
            ⇄ Save for Today
          </button>
        </div>
      </div>
    </div>
  );
}
