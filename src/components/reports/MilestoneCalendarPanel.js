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
    return events
      .filter((e) => e.date >= monthStart && e.date <= monthEnd)
      .sort((a, b) => b.date - a.date)
      .slice(0, 3);
  }, [events, monthStart, monthEnd]);

  const upcomingGoals = useMemo(() => {
    return arr(progressRows)
      .filter((p) => ["NOT_STARTED", "IN_PROGRESS", "FAILED"].includes(p?.status))
      .slice(0, 3)
      .map((p) => ({
        id: p.id,
        title: p.lesson?.title || "Milestone Goal",
        expected: p.updatedAt || p.createdAt,
      }));
  }, [progressRows]);

  const teacherNote = useMemo(() => {
    const withNotes = events.find((e) => e.notes && String(e.notes).trim());
    if (!withNotes) return "No notes recorded yet this month.";
    return withNotes.notes;
  }, [events]);

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h4 className="text-2xl font-extrabold text-gray-900">Milestone Calendar</h4>
          <p className="mt-1 text-sm text-gray-600">
            Tracking {childName || "child"} development for {formatMonthTitle(monthDate)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setMonthDate(new Date(monthDate.getFullYear(), monthDate.getMonth() - 1, 1))}
            className="h-9 w-9 rounded-full border border-gray-200 bg-white text-lg text-gray-700 hover:bg-gray-50"
          >
            ‹
          </button>
          <div className="rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700">
            {formatMonthTitle(monthDate)}
          </div>
          <button
            type="button"
            onClick={() => setMonthDate(new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 1))}
            className="h-9 w-9 rounded-full border border-gray-200 bg-white text-lg text-gray-700 hover:bg-gray-50"
          >
            ›
          </button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[1fr_280px]">
        <div>
          <div className="overflow-hidden rounded-2xl border border-gray-200">
            <div className="grid grid-cols-7 bg-gray-50 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
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
                    "min-h-[92px] border-r border-t border-gray-100 px-2 py-2 text-left",
                    cell.inMonth ? "bg-white" : "bg-gray-50/60",
                    cell.isSelected ? "ring-2 ring-sky-300 ring-inset" : "",
                  ].join(" ")}
                >
                  <div className={["text-xs font-semibold", cell.inMonth ? "text-gray-900" : "text-gray-400"].join(" ")}>
                    {cell.date.getDate()}
                    {cell.isToday ? <span className="ml-1 text-[10px] font-bold text-sky-600">TODAY</span> : null}
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

          <div className="mt-3 rounded-xl border border-gray-200 bg-white p-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Selected day</div>
            {selectedEvents.length ? (
              <div className="mt-2 space-y-1">
                {selectedEvents.slice(0, 4).map((e) => (
                  <div key={e.id} className="text-sm text-gray-700">
                    {e.title}
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-2 text-sm text-gray-600">No milestones/logs on this day.</div>
            )}
          </div>
        </div>

        <div className="space-y-3">
          <div className="rounded-2xl border border-gray-200 bg-gray-50 p-3">
            <div className="text-sm font-extrabold text-gray-900">Achievements</div>
            {achievements.length ? (
              <div className="mt-2 space-y-2">
                {achievements.map((item) => (
                  <div key={item.id} className="rounded-xl border border-gray-200 bg-white p-2">
                    <div className="text-xs font-semibold text-gray-800">{item.title}</div>
                    <div className="mt-0.5 text-[11px] text-gray-500">{formatShortDate(item.date)}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-2 text-xs text-gray-600">No achievements logged yet.</div>
            )}
          </div>

          <div className="rounded-2xl border border-gray-200 bg-gray-50 p-3">
            <div className="text-sm font-extrabold text-gray-900">Upcoming Goals</div>
            {upcomingGoals.length ? (
              <div className="mt-2 space-y-2">
                {upcomingGoals.map((goal) => (
                  <div key={goal.id} className="rounded-xl border border-gray-200 bg-white p-2">
                    <div className="text-xs font-semibold text-gray-800">{goal.title}</div>
                    <div className="mt-0.5 text-[11px] text-gray-500">Expected by {formatShortDate(goal.expected)}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-2 text-xs text-gray-600">No upcoming goals in progress.</div>
            )}
          </div>

          <div className="rounded-2xl border border-gray-200 bg-gray-50 p-3">
            <div className="text-sm font-extrabold text-gray-900">{noteLabel}</div>
            <div className="mt-2 text-xs italic text-gray-700">"{teacherNote}"</div>
          </div>
        </div>
      </div>

      <div className="mt-3 rounded-xl border border-gray-200 bg-white px-3 py-2">
        <div className="flex flex-wrap items-center gap-4 text-[11px] text-gray-600">
          <span className="font-semibold uppercase tracking-wide text-gray-500">Legend:</span>
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
