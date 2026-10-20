import AdminLayout from "@/components/admin/AdminLayout";
import CurriculumTabs from "@/components/curriculum/CurriculumTabs";
import useCurriculumClassroom, { ClassroomPicker } from "@/components/curriculum/useCurriculumClassroom";
import { apiJson } from "@/lib/api";
import { findDateForDay, isSchoolDay, parseDateKey, toDateKey } from "@/lib/lessonCalendar";
import { useCallback, useEffect, useMemo, useState } from "react";

// Lesson Calendar (client mockup 2026-10-02): a month of school days numbered
// Day 1, Day 2, ... for one classroom. "Set Start Day" restarts the count and
// marks closed days, which apply to every classroom and push the numbers on.

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const NAVY = "text-[#0b2a5b] dark:text-blue-100";
const button =
  "rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-[#0b2a5b] hover:bg-blue-50 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-blue-100";

function monthGrid(monthStart) {
  const first = new Date(monthStart.getFullYear(), monthStart.getMonth(), 1);
  const start = new Date(first);
  start.setDate(1 - first.getDay());
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return toDateKey(d);
  });
}

function formatLong(key) {
  return parseDateKey(key).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
}

export default function LessonCalendarPage() {
  const picker = useCurriculumClassroom();
  const { centerId, classRoomId } = picker;
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [showStartDay, setShowStartDay] = useState(false);
  const [jumpDay, setJumpDay] = useState("1");
  const [highlight, setHighlight] = useState("");

  const grid = useMemo(() => monthGrid(month), [month]);
  const monthIndex = month.getMonth();

  const load = useCallback(async () => {
    if (!centerId || !classRoomId) {
      setData(null);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const q = new URLSearchParams({ centerId, classRoomId, from: grid[0], to: grid[grid.length - 1] });
      setData(await apiJson(`/api/v1/lesson-calendar?${q}`));
    } catch (e) {
      setError(e.message || "Could not load the lesson calendar");
    } finally {
      setLoading(false);
    }
  }, [centerId, classRoomId, grid]);

  useEffect(() => {
    load();
  }, [load]);

  const today = data?.today || toDateKey(new Date());

  function goToMonthOf(key) {
    const d = parseDateKey(key);
    setMonth(new Date(d.getFullYear(), d.getMonth(), 1));
  }

  function jump() {
    setNotice("");
    const day = Number(jumpDay);
    const target = data ? findDateForDay(data.anchors, data.closedDays, day, today) : null;
    if (!target) {
      setNotice(data?.anchors?.length ? `Day ${day} is not on the calendar.` : "Set a start day first.");
      return;
    }
    setHighlight(target);
    goToMonthOf(target);
  }

  const futureClosed = (data?.closedDays || []).filter((d) => d >= today);

  return (
    <AdminLayout title="Curriculum">
      <div className="space-y-4">
        <h1 className={`text-3xl font-black ${NAVY}`}>Lesson Calendar</h1>
        <CurriculumTabs active="calendar" />

        <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="flex flex-wrap items-end gap-3">
              <ClassroomPicker picker={picker} />
              <button type="button" className={button} onClick={() => goToMonthOf(today)}>
                Today
              </button>
              <div className="flex items-center gap-1 rounded-lg border border-gray-300 px-1 dark:border-gray-600">
                <button type="button" aria-label="Previous month" className="px-2 py-2 text-lg font-bold text-[#0b2a5b] dark:text-blue-100" onClick={() => setMonth(new Date(month.getFullYear(), monthIndex - 1, 1))}>
                  {"‹"}
                </button>
                <span className={`min-w-[130px] text-center text-sm font-bold ${NAVY}`}>
                  {month.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                </span>
                <button type="button" aria-label="Next month" className="px-2 py-2 text-lg font-bold text-[#0b2a5b] dark:text-blue-100" onClick={() => setMonth(new Date(month.getFullYear(), monthIndex + 1, 1))}>
                  {"›"}
                </button>
              </div>
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <button type="button" className={button} onClick={() => setShowStartDay(true)} disabled={!classRoomId}>
                {"\u{1F4C5}"} Set Start Day
              </button>
              <label className={`flex items-center gap-2 text-sm font-semibold ${NAVY}`}>
                Jump to Day:
                <input
                  type="number"
                  min="1"
                  value={jumpDay}
                  onChange={(e) => setJumpDay(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && jump()}
                  className="w-20 rounded-lg border border-gray-300 bg-white px-2 py-2 text-sm dark:border-gray-600 dark:bg-gray-800"
                  aria-label="Day number"
                />
              </label>
              <button type="button" onClick={jump} className="rounded-lg bg-blue-700 px-5 py-2 text-sm font-bold text-white hover:bg-blue-800">
                Go
              </button>
            </div>
          </div>

          {(error || picker.error || notice) && (
            <div role="status" className={`mt-3 rounded-lg px-3 py-2 text-sm ${error || picker.error ? "bg-red-50 text-red-700" : "bg-blue-50 text-blue-800"}`}>
              {error || picker.error || notice}
            </div>
          )}
          {data && !data.anchors.length && (
            <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
              This classroom has no start day yet. Use Set Start Day to number the school days.
            </p>
          )}

          <div className="mt-4 overflow-x-auto">
            <div className={`grid min-w-[720px] grid-cols-7 border-l border-t border-gray-200 dark:border-gray-700 ${loading ? "opacity-60" : ""}`}>
              {WEEKDAYS.map((name) => (
                <div key={name} className={`border-b border-r border-gray-200 bg-blue-50 py-1.5 text-center text-sm font-bold dark:border-gray-700 dark:bg-gray-800 ${NAVY}`}>
                  {name}
                </div>
              ))}
              {grid.map((key) => {
                const info = data?.days?.[key];
                const inMonth = parseDateKey(key).getMonth() === monthIndex;
                const weekend = !isSchoolDay(key);
                const shaded = weekend || info?.closed || !inMonth;
                return (
                  <div
                    key={key}
                    data-date={key}
                    className={`relative min-h-[84px] border-b border-r border-gray-200 p-1.5 dark:border-gray-700 ${
                      info?.closed ? "bg-gray-300/80 dark:bg-gray-700" : shaded ? "bg-gray-100 dark:bg-gray-800/60" : "bg-white dark:bg-gray-900"
                    } ${highlight === key ? "ring-2 ring-inset ring-blue-600" : ""}`}
                  >
                    <span
                      className={`inline-block rounded px-1.5 text-xs font-bold ${
                        key === today ? "bg-blue-700 text-white" : inMonth ? "bg-blue-50 text-[#0b2a5b] dark:bg-gray-800 dark:text-blue-100" : "text-gray-400"
                      }`}
                    >
                      {parseDateKey(key).getDate()}
                    </span>
                    <div className="mt-2 text-center text-sm font-semibold">
                      {info?.closed ? (
                        <span className="font-black uppercase text-gray-700 dark:text-gray-200">Closed</span>
                      ) : info?.day ? (
                        <span className={inMonth ? NAVY : "text-gray-400"}>Day {info.day}</span>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {showStartDay && data && (
        <StartDayDialog
          centerId={centerId}
          classRoomId={classRoomId}
          classroomName={picker.classrooms.find((c) => c.id === classRoomId)?.name || "this classroom"}
          today={today}
          initialClosed={futureClosed}
          onClose={() => setShowStartDay(false)}
          onSaved={async (message, startDate) => {
            setShowStartDay(false);
            setNotice(message);
            if (startDate) {
              setHighlight(startDate);
              goToMonthOf(startDate);
            }
            await load();
          }}
        />
      )}
    </AdminLayout>
  );
}

function StartDayDialog({ centerId, classRoomId, classroomName, today, initialClosed, onClose, onSaved }) {
  const [startDate, setStartDate] = useState("");
  const [dayNumber, setDayNumber] = useState("1");
  const [applyToAll, setApplyToAll] = useState(true);
  const [closed, setClosed] = useState(initialClosed);
  const [pick, setPick] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function addClosed(key) {
    setError("");
    if (!key) return;
    if (key < today) return setError("Closed days cannot be in the past.");
    if (!isSchoolDay(key)) return setError("Weekends are already skipped.");
    setClosed((prev) => [...new Set([...prev, key])].sort());
    setPick("");
  }

  async function apply() {
    setSaving(true);
    setError("");
    try {
      await apiJson("/api/v1/lesson-calendar", {
        method: "PUT",
        body: JSON.stringify({ centerId, classRoomId, applyToAll, startDate: startDate || null, dayNumber: Number(dayNumber), closedDays: closed }),
      });
      onSaved(
        startDate
          ? `${formatLong(startDate)} is now Day ${dayNumber} for ${applyToAll ? "every classroom" : classroomName}.`
          : "Closed days saved for every classroom.",
        startDate,
      );
    } catch (e) {
      setError(e.message || "Could not save");
      setSaving(false);
    }
  }

  const field = "mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-labelledby="start-day-title">
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl dark:bg-gray-900">
        <div className="flex items-start justify-between">
          <h2 id="start-day-title" className={`text-xl font-black ${NAVY}`}>Set Start Day &amp; Closed Days</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="text-2xl leading-none text-[#0b2a5b] dark:text-blue-100">&times;</button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <label className={`text-sm font-semibold ${NAVY}`}>
            Start Date
            <input type="date" min={today} value={startDate} onChange={(e) => setStartDate(e.target.value)} className={field} />
          </label>
          <label className={`text-sm font-semibold ${NAVY}`}>
            Day Number
            <input type="number" min="1" max="999" value={dayNumber} onChange={(e) => setDayNumber(e.target.value)} className={field} />
          </label>
        </div>
        <p className="mt-1 text-xs text-gray-500">Leave the start date empty to change only the closed days. Days before today never change.</p>
        <label className="mt-2 flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
          <input type="checkbox" checked={applyToAll} onChange={(e) => setApplyToAll(e.target.checked)} />
          Use this start day for every classroom in the center
        </label>

        <div className="mt-4">
          <div className={`text-sm font-bold ${NAVY}`}>Mark Closed Days (optional)</div>
          <p className="text-xs text-gray-600 dark:text-gray-400">
            Closed days apply to every classroom. They are greyed out and the day numbers move on to the next school day.
          </p>
          <div className="mt-2 flex gap-2">
            <input type="date" min={today} value={pick} onChange={(e) => setPick(e.target.value)} className={field} aria-label="Closed day" />
            <button type="button" onClick={() => addClosed(pick)} className={`${button} mt-1`}>Add</button>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {closed.map((key) => (
              <span key={key} className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-[#0b2a5b] dark:bg-blue-900/40 dark:text-blue-100">
                {formatLong(key)}
                <button type="button" aria-label={`Remove ${formatLong(key)}`} onClick={() => setClosed((prev) => prev.filter((d) => d !== key))} className="ml-1 text-base leading-none">
                  &times;
                </button>
              </span>
            ))}
          </div>
        </div>

        {error && <div className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

        <div className="mt-5 grid grid-cols-2 gap-3">
          <button type="button" onClick={onClose} className="rounded-lg border border-gray-300 py-2.5 text-sm font-bold text-[#0b2a5b] dark:border-gray-600 dark:text-blue-100">
            Cancel
          </button>
          <button type="button" onClick={apply} disabled={saving} className="rounded-lg bg-[#0b2a5b] py-2.5 text-sm font-bold text-white hover:bg-[#123a78] disabled:opacity-60">
            {saving ? "Saving..." : "Apply"}
          </button>
        </div>
      </div>
    </div>
  );
}

