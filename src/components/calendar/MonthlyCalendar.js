import { useMemo } from "react";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const STATUS_COLORS = {
  APPROVED: "bg-emerald-200 text-emerald-800",
  PENDING: "bg-amber-200 text-amber-800",
};

const TYPE_COLORS = {
  PTO: "bg-emerald-100 text-emerald-700",
  Sick: "bg-red-100 text-red-700",
  Unpaid: "bg-gray-200 text-gray-600",
  Other: "bg-sky-100 text-sky-700",
};

function getEventColor(event) {
  return TYPE_COLORS[event.type] || STATUS_COLORS[event.status] || "bg-gray-100 text-gray-600";
}

function sameDay(d1, d2) {
  return d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate();
}

function normalizeDate(d) {
  const date = new Date(d);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export default function MonthlyCalendar({ year, month, events = [], onMonthChange }) {
  const today = new Date();
  const firstDay = new Date(year, month, 1);
  const startDow = firstDay.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells = useMemo(() => {
    const result = [];
    for (let i = 0; i < startDow; i++) {
      result.push({ day: null, key: `pad-${i}` });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      result.push({ day: d, key: `day-${d}` });
    }
    return result;
  }, [startDow, daysInMonth]);

  const eventsByDay = useMemo(() => {
    const map = {};
    for (const evt of events) {
      const start = normalizeDate(evt.startDate);
      const end = normalizeDate(evt.endDate);
      for (let d = 1; d <= daysInMonth; d++) {
        const current = new Date(year, month, d);
        if (current >= start && current <= end) {
          if (!map[d]) map[d] = [];
          map[d].push(evt);
        }
      }
    }
    return map;
  }, [events, year, month, daysInMonth]);

  function prevMonth() {
    if (month === 0) onMonthChange?.(year - 1, 11);
    else onMonthChange?.(year, month - 1);
  }

  function nextMonth() {
    if (month === 11) onMonthChange?.(year + 1, 0);
    else onMonthChange?.(year, month + 1);
  }

  return (
    <div>
      <div className="flex items-center justify-between py-2">
        <button
          type="button"
          onClick={prevMonth}
          className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
        >
          &larr;
        </button>
        <div className="text-sm font-extrabold text-gray-900">
          {MONTH_NAMES[month]} {year}
        </div>
        <button
          type="button"
          onClick={nextMonth}
          className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
        >
          &rarr;
        </button>
      </div>

      <div className="mt-2 grid grid-cols-7 border-b border-gray-200">
        {DAY_LABELS.map((label) => (
          <div key={label} className="py-2 text-center text-xs font-semibold text-gray-500">
            {label}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {cells.map((cell) => {
          if (cell.day === null) {
            return <div key={cell.key} className="min-h-[72px] border border-gray-50 bg-gray-50/50" />;
          }

          const dayEvents = eventsByDay[cell.day] || [];
          const isToday = sameDay(new Date(year, month, cell.day), today);

          return (
            <div
              key={cell.key}
              className={[
                "min-h-[72px] border border-gray-100 p-1",
                isToday ? "ring-2 ring-inset ring-sky-400 bg-sky-50/30" : "",
              ].join(" ")}
            >
              <div className={[
                "text-right text-xs",
                isToday ? "font-extrabold text-sky-700" : "text-gray-600",
              ].join(" ")}>
                {cell.day}
              </div>
              {dayEvents.length > 0 && (
                <div className="mt-0.5 space-y-0.5">
                  {dayEvents.slice(0, 3).map((evt) => (
                    <div
                      key={evt.id}
                      className={`truncate rounded-sm px-1 text-[10px] font-semibold leading-tight ${getEventColor(evt)}`}
                      title={`${evt.type || "Time Off"} - ${evt.user?.name || "Unknown"} (${evt.status})`}
                    >
                      {evt.user?.name || "—"}
                    </div>
                  ))}
                  {dayEvents.length > 3 && (
                    <div className="px-1 text-[10px] text-gray-400">
                      +{dayEvents.length - 3} more
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap gap-3">
        {Object.entries(TYPE_COLORS).map(([type, cls]) => (
          <div key={type} className="flex items-center gap-1.5">
            <span className={`inline-block h-3 w-3 rounded-sm ${cls.split(" ")[0]}`} />
            <span className="text-xs text-gray-500">{type}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
