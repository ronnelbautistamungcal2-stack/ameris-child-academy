import { NAVY } from "@/components/reports/reportUi";
import TimeSheetModal from "@/components/timesheets/TimeSheetModal";
import Skeleton from "@/components/ui/Skeleton";
import useSyncedCenterId from "@/hooks/useSyncedCenterId";
import { apiJson } from "@/lib/api";
import { formatDayKey, todayKey } from "@/lib/checklistTime";
import { payPeriodSettingsFor, RANGE_OPTIONS, rangeContaining, stepRange } from "@/lib/payPeriods";
import { roleLabel } from "@/lib/roles";
import { useCallback, useEffect, useMemo, useState } from "react";

// Staff Attendance Overview (client mockups 25-Staff-Attendance), for coaches
// and HR: hours worked per employee for the pay period (highest first), the
// day's sign in/out with the clock icon opening Employee Time.

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

  useSyncedCenterId(centerId, setCenterId, centers);

  // The center's pay schedule (Center Management) decides the pay periods.
  const payPeriod = useMemo(() => payPeriodSettingsFor(centers.find((c) => c.id === centerId)), [centers, centerId]);
  useEffect(() => {
    setRange(rangeContaining(rangeKind, todayKey(), payPeriod));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payPeriod]);

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
                <button type="button" onClick={() => setRange(stepRange(rangeKind, range, -1, payPeriod))} className="px-3 py-2 text-blue-700" aria-label="Previous period">‹</button>
                <span className={`min-w-[190px] text-center text-sm font-bold ${NAVY}`}>
                  {formatDayKey(range.from, { month: "short", day: "numeric", year: "numeric" })} - {formatDayKey(range.to, { month: "short", day: "numeric", year: "numeric" })}
                </span>
                <button type="button" onClick={() => setRange(stepRange(rangeKind, range, 1, payPeriod))} className="px-3 py-2 text-blue-700" aria-label="Next period">›</button>
              </div>
              <select
                value={rangeKind}
                onChange={(e) => {
                  setRangeKind(e.target.value);
                  setRange(rangeContaining(e.target.value, todayKey(), payPeriod));
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
                              {p.classRoomName || "—"}
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
    </Layout>
  );
}
