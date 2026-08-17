import { useMemo, useState } from "react";

const CATEGORY_STYLES = {
  PHYSICAL: {
    dot: "bg-sky-400",
    badge: "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900/70 dark:bg-sky-950/50 dark:text-sky-200",
    label: "Physical",
  },
  COGNITIVE: {
    dot: "bg-indigo-400",
    badge: "border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-900/70 dark:bg-indigo-950/50 dark:text-indigo-200",
    label: "Cognitive",
  },
  EMOTIONAL: {
    dot: "bg-rose-400",
    badge: "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/70 dark:bg-rose-950/50 dark:text-rose-200",
    label: "Emotional",
  },
  GROSS_MOTOR: {
    dot: "bg-emerald-400",
    badge: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/70 dark:bg-emerald-950/50 dark:text-emerald-200",
    label: "Gross Motor",
  },
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
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDayKey(key) {
  const [year, month, day] = String(key || "")
    .split("-")
    .map((part) => Number(part));
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

function formatMonthTitle(v) {
  return new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" }).format(v);
}

function formatLongDate(v) {
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "-";
  return new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(d);
}

function formatEventTime(v) {
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "-";
  return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(d);
}

function categoryFromActivity(activity) {
  const type = String(activity?.type || "").toUpperCase();
  if (["DIAPER_CHANGE", "NAP", "BOTTLE", "MEAL", "SNACK"].includes(type)) return "PHYSICAL";
  if (["ACTIVITY", "TASK_CHECKLIST"].includes(type)) return "COGNITIVE";
  if (type === "BEHAVIOR" || type === "CHARACTER_HIGHLIGHT") return "EMOTIONAL";
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

function SummaryStat({ label, value, hint, tone = "sky" }) {
  const tones = {
    sky: "border-sky-200 bg-white/85 text-sky-900 dark:border-sky-900/70 dark:bg-slate-900/80 dark:text-sky-100",
    emerald: "border-emerald-200 bg-white/85 text-emerald-900 dark:border-emerald-900/70 dark:bg-slate-900/80 dark:text-emerald-100",
    amber: "border-amber-200 bg-white/85 text-amber-900 dark:border-amber-900/70 dark:bg-slate-900/80 dark:text-amber-100",
    rose: "border-rose-200 bg-white/85 text-rose-900 dark:border-rose-900/70 dark:bg-slate-900/80 dark:text-rose-100",
  };

  return (
    <div className={`flex h-full min-h-[88px] flex-col rounded-[18px] border p-3 shadow-sm ${tones[tone] || tones.sky}`}>
      <div className="text-[10px] font-extrabold uppercase tracking-[0.16em] opacity-70">{label}</div>
      <div className="mt-2 break-words text-[clamp(1.05rem,1.8vw,1.4rem)] font-black leading-tight tracking-tight">{value}</div>
      <div className="mt-auto pt-2 text-[11px] leading-4 text-gray-600 dark:text-gray-300">{hint}</div>
    </div>
  );
}

export default function MilestoneCalendarPanel({
  activities,
  progressRows,
  childName,
}) {
  const today = useMemo(() => startOfDay(new Date()), []);
  const todayKey = useMemo(() => formatDayKey(today), [today]);
  const [monthDate, setMonthDate] = useState(today);
  const [selectedKey, setSelectedKey] = useState(todayKey);

  const events = useMemo(() => {
    return arr(activities)
      .map((activity) => {
        const date = new Date(activity?.createdAt);
        if (Number.isNaN(date.getTime())) return null;
        return {
          id: activity.id || `${activity.createdAt}:${activity.type || "activity"}`,
          date,
          dayKey: formatDayKey(date),
          category: categoryFromActivity(activity),
          title: titleFromActivity(activity),
          notes: activity?.notes || "",
        };
      })
      .filter(Boolean);
  }, [activities]);

  const eventsByDay = useMemo(() => {
    const map = new Map();
    for (const event of events) {
      if (!map.has(event.dayKey)) map.set(event.dayKey, []);
      map.get(event.dayKey).push(event);
    }
    return map;
  }, [events]);

  const monthStart = useMemo(
    () => new Date(monthDate.getFullYear(), monthDate.getMonth(), 1),
    [monthDate],
  );
  const monthEnd = useMemo(
    () => new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0, 23, 59, 59, 999),
    [monthDate],
  );

  const gridStart = useMemo(() => {
    const d = new Date(monthStart);
    d.setDate(d.getDate() - d.getDay());
    return d;
  }, [monthStart]);

  const monthEvents = useMemo(() => {
    return events.filter((event) => event.date >= monthStart && event.date <= monthEnd);
  }, [events, monthEnd, monthStart]);

  const cells = useMemo(() => {
    const output = [];
    for (let i = 0; i < 42; i += 1) {
      const d = new Date(gridStart);
      d.setDate(gridStart.getDate() + i);
      const key = formatDayKey(d);
      const dayEvents = eventsByDay.get(key) || [];
      const categories = [...new Set(dayEvents.map((event) => event.category))].slice(0, 4);
      output.push({
        key,
        date: d,
        inMonth: d.getMonth() === monthStart.getMonth(),
        isToday: key === todayKey,
        isSelected: key === selectedKey,
        categories,
        count: dayEvents.length,
      });
    }
    return output;
  }, [eventsByDay, gridStart, monthStart, selectedKey, todayKey]);

  const selectedEvents = useMemo(() => {
    return (eventsByDay.get(selectedKey) || []).slice().sort((a, b) => b.date - a.date);
  }, [eventsByDay, selectedKey]);

  const completedMilestones = useMemo(() => {
    return arr(progressRows)
      .filter((row) => row?.status === "COMPLETED" || row?.status === "PASSED")
      .map((row) => ({
        id: row.id,
        date: new Date(row.achievedAt || row.updatedAt || row.createdAt),
        title: row.lesson?.title || "Milestone achieved",
      }))
      .filter((item) => !Number.isNaN(item.date.getTime()) && item.date >= monthStart && item.date <= monthEnd)
      .sort((a, b) => b.date - a.date);
  }, [monthEnd, monthStart, progressRows]);

  const activityDays = useMemo(() => new Set(monthEvents.map((event) => event.dayKey)).size, [monthEvents]);
  const selectedDateLabel = useMemo(() => {
    const parsed = parseDayKey(selectedKey);
    return parsed ? formatLongDate(parsed) : "Selected day";
  }, [selectedKey]);

  return (
    <div className="space-y-3">
      <div className="rounded-[24px] border border-sky-200 bg-gradient-to-br from-white via-sky-50/80 to-emerald-50 p-4 shadow-sm dark:border-sky-900/60 dark:bg-gradient-to-br dark:from-slate-950 dark:via-sky-950/25 dark:to-emerald-950/20">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl">
            <div className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-sky-700">Timeline</div>
            <h4 className="mt-1.5 text-xl font-black tracking-tight text-gray-900 dark:text-gray-100">Milestone calendar</h4>
            <p className="mt-1.5 text-[13px] leading-5 text-gray-700 dark:text-gray-300">
              Tracking {childName || "your child"} across the month so parents can review logged days, milestones, and teacher notes in one place.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setMonthDate(new Date(monthDate.getFullYear(), monthDate.getMonth() - 1, 1))}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-white/80 bg-white/85 text-gray-700 shadow-sm transition-colors hover:bg-white dark:border-gray-700 dark:bg-slate-900 dark:text-gray-200 dark:hover:bg-slate-800"
              aria-label="Previous month"
            >
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                <path
                  fillRule="evenodd"
                  d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
            <div className="rounded-full border border-white/80 bg-white/85 px-3 py-1.5 text-[13px] font-semibold text-gray-700 shadow-sm dark:border-gray-700 dark:bg-slate-900 dark:text-gray-200">
              {formatMonthTitle(monthDate)}
            </div>
            <button
              type="button"
              onClick={() => setMonthDate(new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 1))}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-white/80 bg-white/85 text-gray-700 shadow-sm transition-colors hover:bg-white dark:border-gray-700 dark:bg-slate-900 dark:text-gray-200 dark:hover:bg-slate-800"
              aria-label="Next month"
            >
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                <path
                  fillRule="evenodd"
                  d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => {
                setMonthDate(today);
                setSelectedKey(todayKey);
              }}
              className="rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1.5 text-[11px] font-semibold text-sky-700 transition-colors hover:bg-sky-100 dark:border-sky-800 dark:bg-sky-950/50 dark:text-sky-200 dark:hover:bg-sky-950/70"
            >
              Today
            </button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2.5 xl:grid-cols-4">
          <SummaryStat
            label="Logged days"
            value={activityDays}
            hint="Days with updates in this month"
            tone="sky"
          />
          <SummaryStat
            label="Updates"
            value={monthEvents.length}
            hint="All recorded events in this month"
            tone="amber"
          />
          <SummaryStat
            label="Milestones"
            value={completedMilestones.length}
            hint="Completed or passed progress items"
            tone="emerald"
          />
          <SummaryStat
            label="Selected day"
            value={selectedEvents.length}
            hint="Events shown for the current date"
            tone="rose"
          />
        </div>
      </div>

      <div className="space-y-3">
        <div className="rounded-[24px] border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-slate-950">
          <div className="grid grid-cols-7 rounded-t-[24px] border-b border-gray-200 bg-gray-50 text-[10px] font-extrabold uppercase tracking-[0.16em] text-gray-500 dark:border-gray-800 dark:bg-slate-900 dark:text-gray-400">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
              <div key={day} className="px-2.5 py-2.5">
                {day}
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
                  "min-h-[88px] border-r border-t border-gray-100 px-2.5 py-2.5 text-left transition-colors dark:border-gray-800",
                  cell.inMonth
                    ? "bg-white hover:bg-sky-50/50 dark:bg-slate-950 dark:hover:bg-sky-950/30"
                    : "bg-gray-50/70 text-gray-400 hover:bg-gray-100/70 dark:bg-slate-900 dark:text-gray-500 dark:hover:bg-slate-800",
                  cell.isSelected ? "ring-2 ring-sky-300 ring-inset dark:ring-sky-700" : "",
                ].join(" ")}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className={["text-[13px] font-bold", cell.inMonth ? "text-gray-900 dark:text-gray-100" : "text-gray-400 dark:text-gray-500"].join(" ")}>
                    {cell.date.getDate()}
                  </span>
                  {cell.isToday ? (
                    <span className="rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[10px] font-extrabold text-sky-700 dark:border-sky-800 dark:bg-sky-950/50 dark:text-sky-200">
                      Today
                    </span>
                  ) : null}
                </div>

                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {cell.categories.map((category) => (
                    <span
                      key={`${cell.key}-${category}`}
                      className={["h-2.5 w-2.5 rounded-full", CATEGORY_STYLES[category]?.dot || "bg-gray-300"].join(" ")}
                    />
                  ))}
                </div>

                {cell.count ? (
                  <div className="mt-2.5 inline-flex rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-[10px] font-semibold text-gray-600 dark:border-gray-700 dark:bg-slate-800 dark:text-gray-300">
                    {cell.count} update{cell.count !== 1 ? "s" : ""}
                  </div>
                ) : null}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-[22px] border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-slate-900">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-gray-500 dark:text-gray-400">Selected day</div>
              <div className="mt-1 text-base font-black tracking-tight text-gray-900 dark:text-gray-100">{selectedDateLabel}</div>
            </div>
            <span className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-bold text-sky-700 dark:border-sky-800 dark:bg-sky-950/50 dark:text-sky-200">
              {selectedEvents.length} event{selectedEvents.length !== 1 ? "s" : ""}
            </span>
          </div>

          {selectedEvents.length ? (
            <div className="mt-3 grid gap-2.5 md:grid-cols-2">
              {selectedEvents.slice(0, 4).map((event) => {
                const style = CATEGORY_STYLES[event.category] || CATEGORY_STYLES.COGNITIVE;
                return (
                  <div key={event.id} className="rounded-[16px] border border-gray-200 bg-gray-50/80 p-3.5 dark:border-gray-800 dark:bg-slate-800/90">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${style.badge}`}>
                        {style.label}
                      </span>
                      <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">{formatEventTime(event.date)}</span>
                    </div>
                    <div className="mt-2.5 text-[13px] font-bold text-gray-900 dark:text-gray-100">{event.title}</div>
                    {event.notes && String(event.notes).trim() ? (
                      <div className="mt-2 text-[13px] leading-5 text-gray-600 dark:text-gray-300">{event.notes}</div>
                    ) : (
                      <div className="mt-2 text-[13px] text-gray-500 dark:text-gray-400">No note added to this event.</div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="mt-3 rounded-[16px] border border-dashed border-gray-300 bg-gray-50/80 px-3.5 py-5 text-[13px] text-gray-600 dark:border-gray-700 dark:bg-slate-800/70 dark:text-gray-300">
              No milestones or activity logs were recorded on this date.
            </div>
          )}

          {selectedEvents.length > 4 ? (
            <div className="mt-3 text-center text-xs font-semibold text-gray-500 dark:text-gray-400">
              +{selectedEvents.length - 4} more event{selectedEvents.length - 4 !== 1 ? "s" : ""}
            </div>
          ) : null}
        </div>
      </div>

      <div className="rounded-[22px] border border-gray-200 bg-white px-4 py-3 shadow-sm dark:border-gray-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center gap-3 text-[11px] font-semibold text-gray-600 dark:text-gray-300">
          <span className="font-extrabold uppercase tracking-[0.16em] text-gray-500 dark:text-gray-400">Legend</span>
          {Object.entries(CATEGORY_STYLES).map(([key, style]) => (
            <span key={key} className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-gray-50 px-3 py-1 dark:border-gray-700 dark:bg-slate-800">
              <span className={["h-2.5 w-2.5 rounded-full", style.dot].join(" ")} />
              {style.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
