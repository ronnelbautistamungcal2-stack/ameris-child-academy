import TeacherLayout from "@/components/teacher/TeacherLayout";
import { SkeletonCard } from "@/components/ui/Skeleton";
import { apiJson } from "@/lib/api";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

function toDateKey(date = new Date()) {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "";
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function byString(a, b) {
  return String(a || "").localeCompare(String(b || ""));
}

function fullName(child) {
  if (!child) return "";
  return `${child.firstName || ""}${child.lastName ? ` ${child.lastName}` : ""}`.trim();
}

function nextBirthdayDate(birthDate, now = new Date()) {
  const d = new Date(birthDate);
  if (Number.isNaN(d.getTime())) return null;
  const out = new Date(now);
  out.setHours(0, 0, 0, 0);
  out.setMonth(d.getMonth(), d.getDate());
  if (out < new Date(now.getFullYear(), now.getMonth(), now.getDate())) {
    out.setFullYear(out.getFullYear() + 1);
  }
  return out;
}

export default function TeacherDashboard() {
  const [centers, setCenters] = useState([]);
  const [centerId, setCenterId] = useState("");

  const [children, setChildren] = useState([]);
  const [attendance, setAttendance] = useState(null);

  const [scheduleDraft, setScheduleDraft] = useState("");
  const [scheduleItems, setScheduleItems] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const dayKey = useMemo(() => toDateKey(new Date()), []);
  const scheduleStorageKey = useMemo(() => {
    if (!centerId) return "";
    return `aca:teacherSchedule:${centerId}:${dayKey}`;
  }, [centerId, dayKey]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError("");
      try {
        const c = await apiJson("/api/v1/centers");
        const arr = Array.isArray(c) ? c : [];
        setCenters(arr);
        if (arr.length === 1) setCenterId(arr[0].id);
      } catch (e) {
        setError(e.message || "Failed to load centers");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!centerId) {
      setChildren([]);
      setAttendance(null);
      return;
    }

    (async () => {
      setLoading(true);
      setError("");
      try {
        const [kids, att] = await Promise.all([
          apiJson(`/api/v1/children?centerId=${encodeURIComponent(centerId)}`),
          apiJson(`/api/v1/attendance/today?centerId=${encodeURIComponent(centerId)}`).catch(
            () => null,
          ),
        ]);
        setChildren(Array.isArray(kids) ? kids : []);
        setAttendance(att);
      } catch (e) {
        setError(e.message || "Failed to load dashboard data");
      } finally {
        setLoading(false);
      }
    })();
  }, [centerId]);

  useEffect(() => {
    if (!scheduleStorageKey) {
      setScheduleItems([]);
      return;
    }

    try {
      const raw = localStorage.getItem(scheduleStorageKey);
      const parsed = raw ? JSON.parse(raw) : [];
      setScheduleItems(Array.isArray(parsed) ? parsed.filter(Boolean) : []);
    } catch {
      setScheduleItems([]);
    }
  }, [scheduleStorageKey]);

  function persistSchedule(next) {
    setScheduleItems(next);
    if (!scheduleStorageKey) return;
    try {
      localStorage.setItem(scheduleStorageKey, JSON.stringify(next));
    } catch {
      // ignore storage errors
    }
  }

  function addScheduleItem() {
    const text = String(scheduleDraft || "").trim();
    if (!text) return;
    const id =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : String(Date.now());
    persistSchedule([...scheduleItems, { id, text }]);
    setScheduleDraft("");
  }

  function removeScheduleItem(id) {
    persistSchedule(scheduleItems.filter((i) => i?.id !== id));
  }

  const attendanceSummary = useMemo(() => {
    if (!attendance) return null;
    const total = Number(attendance.totalChildren || 0);
    const checkedIn = Number(attendance.checkedInCount || 0);
    return { total, checkedIn };
  }, [attendance]);

  const upcomingBirthdays = useMemo(() => {
    const now = new Date();
    return (children || [])
      .filter((c) => c?.birthDate)
      .map((c) => ({
        child: c,
        next: nextBirthdayDate(c.birthDate, now),
      }))
      .filter((row) => row.next)
      .sort((a, b) => a.next - b.next)
      .slice(0, 6);
  }, [children]);

  const redFlagChildren = useMemo(() => {
    const flags = [];
    for (const child of children || []) {
      const list = [];
      if (child?.allergies) list.push("Allergies");
      if (!child?.birthDate) list.push("Missing DOB");
      if (!child?.classRoomId) list.push("Missing classroom");
      if (!child?.emergencyContact) list.push("Missing emergency contact");
      if (list.length) flags.push({ child, tags: list });
    }
    return flags.sort((a, b) => byString(fullName(a.child), fullName(b.child)));
  }, [children]);

  return (
    <TeacherLayout title="Dashboard">
      <div className="space-y-4">
        <div className="rounded-2xl border border-gray-200 bg-white p-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-extrabold text-gray-900">Dashboard</h2>
              <p className="mt-1 text-sm text-gray-600">
                {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
                {" · "}Attendance, birthdays & schedule
              </p>
            </div>

            <label className="block">
              <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Center
              </div>
              <select
                value={centerId}
                onChange={(e) => setCenterId(e.target.value)}
                className="mt-1 w-72 max-w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
              >
                <option value="">Select a center…</option>
                {centers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {error ? (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              {error}
            </div>
          ) : null}

          {loading ? (
            <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2"><SkeletonCard /><SkeletonCard /><SkeletonCard /><SkeletonCard /></div>
          ) : !centerId ? (
            <div className="mt-4 text-sm text-gray-600">
              Choose a center to view your teacher dashboard.
            </div>
          ) : (
            <div className="mt-5 grid grid-cols-1 gap-3 lg:grid-cols-2">
              <Card
                title="Children clocked in"
                subtitle={
                  attendanceSummary
                    ? `${attendanceSummary.checkedIn} / ${attendanceSummary.total} checked in`
                    : "Attendance not available"
                }
                href="/teacher/classroom"
                hrefLabel="Open My Classroom"
                accent="sky"
              >
                {attendance?.checkedInChildren?.length ? (
                  <ul className="mt-3 space-y-1 text-sm text-gray-700">
                    {attendance.checkedInChildren.slice(0, 6).map((row) => (
                      <li key={row.child?.id} className="flex items-center justify-between gap-3">
                        <span className="truncate">{fullName(row.child) || row.child?.id}</span>
                        <span className="shrink-0 text-xs text-gray-500">
                          {row.checkedInAt ? new Date(row.checkedInAt).toLocaleTimeString() : "—"}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="mt-3 rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm text-gray-600">
                    No checked-in children detected yet.
                  </div>
                )}
              </Card>

              <Card
                title="Upcoming birthdays"
                subtitle={upcomingBirthdays.length ? "Next 6 birthdays" : "No birthdays on file"}
                href="/teacher/classroom"
                hrefLabel="View Roster"
                accent="pink"
              >
                {upcomingBirthdays.length ? (
                  <ul className="mt-3 space-y-1 text-sm text-gray-700">
                    {upcomingBirthdays.map((row) => (
                      <li key={row.child?.id} className="flex items-center justify-between gap-3">
                        <span className="truncate">{fullName(row.child)}</span>
                        <span className="shrink-0 text-xs text-gray-500">
                          {row.next.toLocaleDateString()}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="mt-3 rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm text-gray-600">
                    Add DOBs to children profiles to surface birthdays here.
                  </div>
                )}
              </Card>

              <Card
                title="Today’s daily schedule"
                subtitle={`${dayKey} · saved locally`}
                href="/teacher/checklists"
                hrefLabel="Open Checklists"
                accent="violet"
              >
                <div className="mt-3 flex gap-2">
                  <input
                    value={scheduleDraft}
                    onChange={(e) => setScheduleDraft(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addScheduleItem(); } }}
                    className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
                    placeholder="Add item and press Enter (e.g., Circle time 9:30)"
                  />
                  <button
                    type="button"
                    onClick={addScheduleItem}
                    disabled={!String(scheduleDraft || "").trim()}
                    className="shrink-0 rounded-xl bg-blue-600 px-4 py-2 text-sm font-extrabold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Add
                  </button>
                </div>
                {scheduleItems.length ? (
                  <ul className="mt-3 space-y-2">
                    {scheduleItems.map((it) => (
                      <li
                        key={it.id}
                        className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm"
                      >
                        <span className="min-w-0 truncate text-gray-800">{it.text}</span>
                        <button
                          type="button"
                          onClick={() => removeScheduleItem(it.id)}
                          className="shrink-0 rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                        >
                          Remove
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="mt-3 rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm text-gray-600">
                    Add a few anchor points for today’s classroom flow.
                  </div>
                )}
              </Card>

              <Card
                title="Red flag children"
                subtitle={redFlagChildren.length ? `${redFlagChildren.length} need attention` : "All clear"}
                href="/teacher/classroom"
                hrefLabel="Review in Classroom"
                accent={redFlagChildren.length > 0 ? "amber" : "emerald"}
              >
                {redFlagChildren.length ? (
                  <ul className="mt-3 space-y-2">
                    {redFlagChildren.slice(0, 6).map((row) => (
                      <li
                        key={row.child?.id}
                        className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2"
                      >
                        <div className="text-sm font-semibold text-amber-900">
                          {fullName(row.child)}
                        </div>
                        <div className="mt-1 flex flex-wrap gap-2 text-xs">
                          {row.tags.map((t) => (
                            <span
                              key={t}
                              className="rounded-full border border-amber-200 bg-white px-2 py-1 font-semibold text-amber-900"
                            >
                              {t}
                            </span>
                          ))}
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="mt-3 rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm text-gray-600">
                    Flags appear when allergies or key fields are missing.
                  </div>
                )}
              </Card>
            </div>
          )}
        </div>
      </div>
    </TeacherLayout>
  );
}

const CARD_ACCENTS = {
  sky: "border-l-sky-400",
  pink: "border-l-pink-400",
  violet: "border-l-violet-400",
  amber: "border-l-amber-400",
  emerald: "border-l-emerald-400",
};

function Card({ title, subtitle, href, hrefLabel, children, accent }) {
  const accentClass = accent ? CARD_ACCENTS[accent] : "";
  return (
    <div className={["rounded-2xl border border-gray-200 bg-white p-4", accentClass ? `border-l-4 ${accentClass}` : ""].join(" ")}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            {title}
          </div>
          <div className="mt-1.5 text-base font-extrabold text-gray-900">{subtitle}</div>
        </div>
        {href ? (
          <Link
            href={href}
            className="shrink-0 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-extrabold text-gray-700 transition hover:bg-gray-50 hover:border-gray-300"
          >
            {hrefLabel || "Open"}
          </Link>
        ) : null}
      </div>
      {children}
    </div>
  );
}
