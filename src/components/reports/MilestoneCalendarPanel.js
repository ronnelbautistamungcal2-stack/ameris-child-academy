import { useMemo, useState } from "react";

const CATEGORY_STYLES = {
  PHYSICAL: { dot: "bg-sky-400", label: "Physical" },
  COGNITIVE: { dot: "bg-indigo-400", label: "Cognitive" },
  EMOTIONAL: { dot: "bg-rose-400", label: "Emotional" },
  GROSS_MOTOR: { dot: "bg-emerald-400", label: "Gross Motor" },
};

function arr(v) {
  return Array.isArray(v) ? v : [];
}

function startOfDay(v) {
  const d = new Date(v);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatDayKey(v) {
  const d = startOfDay(v);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatMonthTitle(v) {
  return new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" }).format(v);
}

function formatShortDate(v) {
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "-";
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(d);
}

function categoryFromActivity(activity) {
  const type = String(activity?.type || "").toUpperCase();
  if (["DIAPER_CHANGE", "NAP", "BOTTLE", "MEAL", "SNACK"].includes(type)) return "PHYSICAL";
  if (["ACTIVITY", "TASK_CHECKLIST"].includes(type)) return "COGNITIVE";
  if (type === "BEHAVIOR") return "EMOTIONAL";
  return "GROSS_MOTOR";
}

function titleFromActivity(activity) {
  if (activity?.type === "OTHER" && activity?.details?.kind === "DAILY_GRADE") {
    return activity?.details?.domains ? "Developmental Assessment" : "Daily Grade";
  }
  if (activity?.type === "DIAPER_CHANGE") return "Diaper / Potty";
  if (activity?.type === "NAP") return "Rest Time";
  if (["MEAL", "SNACK", "BOTTLE"].includes(activity?.type)) return "Meals & Nutrition";
  return String(activity?.type || "Update")
    .toLowerCase()
    .split("_")
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(" ");
}

export default function MilestoneCalendarPanel({
  activities,
  progressRows,
  childName,
  noteLabel = "Teacher's Note",
}) {
  const now = new Date();
  const [monthDate, setMonthDate] = useState(startOfDay(now));
  const [selectedKey, setSelectedKey] = useState(formatDayKey(now));

  const events = useMemo(() => {
    return arr(activities)
      .map((a) => {
        const date = new Date(a?.createdAt);
        if (Number.isNaN(date.getTime())) return null;
        return {
          id: a.id || `${a.createdAt}:${a.type || "activity"}`,
          date,
          dayKey: formatDayKey(date),
          category: categoryFromActivity(a),
          title: titleFromActivity(a),
          notes: a?.notes || "",
        };
      })
      .filter(Boolean);
  }, [activities]);

  const eventsByDay = useMemo(() => {
    const by = new Map();
    for (const e of events) {
      if (!by.has(e.dayKey)) by.set(e.dayKey, []);
      by.get(e.dayKey).push(e);
    }
    return by;
  }, [events]);

  const monthStart = useMemo(
    () => new Date(monthDate.getFullYear(), monthDate.getMonth(), 1),
    [monthDate],
  );
  const monthEnd = useMemo(
    () => new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0),
    [monthDate],
  );

  const gridStart = useMemo(() => {
    const d = new Date(monthStart);
    d.setDate(d.getDate() - d.getDay());
    return d;
  }, [monthStart]);

  const cells = useMemo(() => {
    const out = [];
    for (let i = 0; i < 42; i += 1) {
      const d = new Date(gridStart);
      d.setDate(gridStart.getDate() + i);
      const key = formatDayKey(d);
      const dayEvents = eventsByDay.get(key) || [];
      const categories = [...new Set(dayEvents.map((e) => e.category))].slice(0, 4);
      out.push({
        key,
        date: d,
        inMonth: d.getMonth() === monthStart.getMonth(),
        isToday: key === formatDayKey(now),
        isSelected: key === selectedKey,
        categories,
        count: dayEvents.length,
      });
    }
    return out;
  }, [eventsByDay, gridStart, monthStart, now, selectedKey]);

  const selectedEvents = useMemo(() => eventsByDay.get(selectedKey) || [], [eventsByDay, selectedKey]);

  const achievements = useMemo(() => {
    // Show completed progress milestones first, then fall back to activity events
    const completedMilestones = arr(progressRows)
      .filter((p) => p?.status === "COMPLETED" || p?.status === "PASSED")
      .map((p) => {
        const date = new Date(p.achievedAt || p.updatedAt || p.createdAt);
        return {
          id: p.id,
          date,
          title: p.lesson?.title || "Milestone achieved",
          isAchievement: true,
        };
      })
      .filter((m) => m.date >= monthStart && m.date <= monthEnd)
      .sort((a, b) => b.date - a.date);
    if (completedMilestones.length) return completedMilestones.slice(0, 3);
    return events
      .filter((e) => e.date >= monthStart && e.date <= monthEnd)
      .sort((a, b) => b.date - a.date)
      .slice(0, 3);
  }, [events, progressRows, monthStart, monthEnd]);

  const upcomingGoals = useMemo(() => {
    return arr(progressRows)
      .filter((p) => ["NOT_STARTED", "IN_PROGRESS", "FAILED"].includes(p?.status))
      .slice(0, 3)
      .map((p) => ({
        id: p.id,
        title: p.lesson?.title || "Milestone Goal",
        status: p.status,
      }));
  }, [progressRows]);

  const teacherNote = useMemo(() => {
    // Find the most recent note for the current month
    const monthEvents = events
      .filter((e) => e.notes && String(e.notes).trim() && e.date >= monthStart && e.date <= monthEnd)
      .sort((a, b) => b.date - a.date);
    if (!monthEvents.length) return "No notes recorded yet this month.";
    return monthEvents[0].notes;
  }, [events, monthStart, monthEnd]);

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h4 className="text-2xl font-extrabold text-gray-900 dark:text-gray-100">Milestone Calendar</h4>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Tracking {childName || "child"} development for {formatMonthTitle(monthDate)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setMonthDate(new Date(monthDate.getFullYear(), monthDate.getMonth() - 1, 1))}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
            aria-label="Previous month"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4"><path fillRule="evenodd" d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z" clipRule="evenodd" /></svg>
          </button>
          <div className="rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300">
            {formatMonthTitle(monthDate)}
          </div>
          <button
            type="button"
            onClick={() => setMonthDate(new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 1))}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
            aria-label="Next month"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4"><path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" /></svg>
          </button>
          <button
            type="button"
            onClick={() => {
              const today = new Date();
              setMonthDate(startOfDay(today));
              setSelectedKey(formatDayKey(today));
            }}
            className="ml-1 rounded-full border border-sky-200 bg-sky-50 px-3 py-2 text-xs font-semibold text-sky-700 hover:bg-sky-100 transition"
          >
            Today
          </button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[1fr_280px]">
        <div>
          <div className="overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-700">
            <div className="grid grid-cols-7 bg-gray-50 text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:bg-gray-800 dark:text-gray-400">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                <div key={d} className="px-3 py-2">
                  {d}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {cells.map((cell) => (
                <button
                  key={cell.key}
                  type="button"
                  onClick={() => setSelectedKey(cell.key)}
                  className={[
                    "min-h-[92px] border-r border-t border-gray-100 px-2 py-2 text-left dark:border-gray-700",
                    cell.inMonth ? "bg-white dark:bg-gray-900" : "bg-gray-50/60 dark:bg-gray-800/60",
                    cell.isSelected ? "ring-2 ring-violet-300 ring-inset dark:ring-violet-600" : "",
                  ].join(" ")}
                >
                  <div className={["text-xs font-semibold", cell.inMonth ? "text-gray-900 dark:text-gray-100" : "text-gray-400 dark:text-gray-600"].join(" ")}>
                    {cell.date.getDate()}
                    {cell.isToday ? <span className="ml-1 text-[10px] font-bold text-violet-600 dark:text-violet-400">TODAY</span> : null}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {cell.categories.map((category) => (
                      <span key={`${cell.key}-${category}`} className={["h-2 w-2 rounded-full", CATEGORY_STYLES[category]?.dot || "bg-gray-300"].join(" ")} />
                    ))}
                  </div>
                  {cell.count ? <div className="mt-2 text-[10px] text-gray-500">{cell.count} update(s)</div> : null}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-3 rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-900">
            <div className="flex items-center justify-between">
              <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Selected day</div>
              {selectedEvents.length ? (
                <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-semibold text-sky-700">
                  {selectedEvents.length} event{selectedEvents.length !== 1 ? "s" : ""}
                </span>
              ) : null}
            </div>
            {selectedEvents.length ? (
              <div className="mt-2 space-y-2">
                {selectedEvents.slice(0, 6).map((e) => {
                  const style = CATEGORY_STYLES[e.category];
                  return (
                    <div key={e.id} className="flex items-start gap-2 rounded-lg border border-gray-100 bg-gray-50 p-2 dark:border-gray-700 dark:bg-gray-800">
                      <span className={["mt-1 h-2 w-2 shrink-0 rounded-full", style?.dot || "bg-gray-300"].join(" ")} />
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-semibold text-gray-800 dark:text-gray-200">{e.title}</div>
                        {e.notes && String(e.notes).trim() ? (
                          <div className="mt-0.5 line-clamp-2 text-[11px] text-gray-500">{e.notes}</div>
                        ) : null}
                        <div className="mt-0.5 text-[10px] text-gray-400">
                          {new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(e.date)}
                        </div>
                      </div>
                    </div>
                  );
                })}
                {selectedEvents.length > 6 ? (
                  <div className="text-center text-[11px] text-gray-500">+{selectedEvents.length - 6} more</div>
                ) : null}
              </div>
            ) : (
              <div className="mt-2 text-sm text-gray-600 dark:text-gray-400">No milestones/logs on this day.</div>
            )}
          </div>
        </div>

        <div className="space-y-3">
          <div className="rounded-2xl border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800">
            <div className="text-sm font-extrabold text-gray-900 dark:text-gray-100">Achievements</div>
            {achievements.length ? (
              <div className="mt-2 space-y-2">
                {achievements.map((item) => (
                  <div key={item.id} className={["rounded-xl border bg-white p-2 dark:bg-gray-900", item.isAchievement ? "border-emerald-200 dark:border-emerald-800" : "border-gray-200 dark:border-gray-600"].join(" ")}>
                    <div className="flex items-start justify-between gap-1">
                      <div className="text-xs font-semibold text-gray-800 dark:text-gray-200">{item.title}</div>
                      {item.isAchievement ? (
                        <span className="shrink-0 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">Milestone</span>
                      ) : null}
                    </div>
                    <div className="mt-0.5 text-[11px] text-gray-500">{formatShortDate(item.date)}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-2 text-xs text-gray-600">No achievements logged yet.</div>
            )}
          </div>

          <div className="rounded-2xl border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800">
            <div className="text-sm font-extrabold text-gray-900 dark:text-gray-100">Upcoming Goals</div>
            {upcomingGoals.length ? (
              <div className="mt-2 space-y-2">
                {upcomingGoals.map((goal) => (
                  <div key={goal.id} className="rounded-xl border border-gray-200 bg-white p-2 dark:border-gray-600 dark:bg-gray-900">
                    <div className="text-xs font-semibold text-gray-800 dark:text-gray-200">{goal.title}</div>
                    <div className="mt-0.5">
                      <span className={[
                        "inline-block rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                        goal.status === "FAILED" ? "bg-red-100 text-red-700"
                          : goal.status === "IN_PROGRESS" ? "bg-amber-100 text-amber-700"
                          : "bg-gray-100 text-gray-600",
                      ].join(" ")}>
                        {goal.status === "FAILED" ? "Needs Support" : goal.status === "IN_PROGRESS" ? "In Progress" : "Not Started"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-2 text-xs text-gray-600">No upcoming goals in progress.</div>
            )}
          </div>

          <div className="rounded-2xl border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800">
            <div className="text-sm font-extrabold text-gray-900 dark:text-gray-100">{noteLabel}</div>
            <div className="mt-2 text-xs italic text-gray-700 dark:text-gray-300">"{teacherNote}"</div>
          </div>
        </div>
      </div>

      <div className="mt-3 rounded-xl border border-gray-200 bg-white px-3 py-2 dark:border-gray-700 dark:bg-gray-900">
        <div className="flex flex-wrap items-center gap-4 text-[11px] text-gray-600 dark:text-gray-400">
          <span className="font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Legend:</span>
          {Object.entries(CATEGORY_STYLES).map(([key, cfg]) => (
            <span key={key} className="inline-flex items-center gap-1.5">
              <span className={["h-2 w-2 rounded-full", cfg.dot].join(" ")} />
              {cfg.label}
            </span>
          ))}
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-gray-500" />
            Target Goal
          </span>
        </div>
      </div>
    </div>
  );
}
