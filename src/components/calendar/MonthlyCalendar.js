import { useMemo, useState } from "react";

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
  PAID: "bg-emerald-100 text-emerald-700",
  UNPAID: "bg-gray-200 text-gray-600",
  PTO: "bg-emerald-100 text-emerald-700",
  Sick: "bg-red-100 text-red-700",
  Unpaid: "bg-gray-200 text-gray-600",
  Other: "bg-sky-100 text-sky-700",
};

const SOURCE_COLORS = {
  event: "bg-indigo-100 text-indigo-700 border-indigo-200",
  shift: "bg-blue-100 text-blue-700 border-blue-200",
  timeoff: "bg-emerald-100 text-emerald-700 border-emerald-200",
};

const SOURCE_DOT = {
  event: "#6366f1",
  shift: "#3b82f6",
  timeoff: "#10b981",
};

function getEventColor(event) {
  if (event._source && SOURCE_COLORS[event._source]) return SOURCE_COLORS[event._source];
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

export default function MonthlyCalendar({ year, month, events = [], onMonthChange, onDayClick, selectedDay, legendItems }) {
  const today = new Date();
  const firstDay = new Date(year, month, 1);
  const startDow = firstDay.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Previous month days for leading cells
  const prevMonthDays = new Date(year, month, 0).getDate();

  const cells = useMemo(() => {
    const result = [];
    for (let i = startDow - 1; i >= 0; i--) {
      result.push({ day: prevMonthDays - i, key: `pad-${i}`, outside: true });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      result.push({ day: d, key: `day-${d}`, outside: false });
    }
    // Trailing cells to fill last row
    const trailing = (7 - (result.length % 7)) % 7;
    for (let i = 1; i <= trailing; i++) {
      result.push({ day: i, key: `trail-${i}`, outside: true });
    }
    return result;
  }, [startDow, daysInMonth, prevMonthDays]);

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

  function goToday() {
    const t = new Date();
    onMonthChange?.(t.getFullYear(), t.getMonth());
  }

  const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;

  const legendEntries = legendItems || Object.entries(TYPE_COLORS).map(([type, cls]) => ({
    label: type,
    cls: cls.split(" ")[0],
  }));

  return (
    <div>
      {/* Navigation header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button
            type="button"
            onClick={prevMonth}
            style={{
              width: 36, height: 36, display: "inline-flex", alignItems: "center", justifyContent: "center",
              border: "1px solid var(--admin-border)", borderRadius: 8, background: "var(--admin-bg)",
              color: "var(--admin-text-secondary)", cursor: "pointer", fontSize: 16, fontWeight: 600,
              transition: "all 0.15s ease",
            }}
            onMouseEnter={e => { e.currentTarget.style.background = "var(--admin-bg-tertiary)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "var(--admin-bg)"; }}
            aria-label="Previous month"
          >
            &#8249;
          </button>
          <button
            type="button"
            onClick={nextMonth}
            style={{
              width: 36, height: 36, display: "inline-flex", alignItems: "center", justifyContent: "center",
              border: "1px solid var(--admin-border)", borderRadius: 8, background: "var(--admin-bg)",
              color: "var(--admin-text-secondary)", cursor: "pointer", fontSize: 16, fontWeight: 600,
              transition: "all 0.15s ease",
            }}
            onMouseEnter={e => { e.currentTarget.style.background = "var(--admin-bg-tertiary)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "var(--admin-bg)"; }}
            aria-label="Next month"
          >
            &#8250;
          </button>
        </div>

        <div style={{ fontSize: 18, fontWeight: 800, color: "var(--admin-text)", letterSpacing: "-0.02em" }}>
          {MONTH_NAMES[month]} {year}
        </div>

        <button
          type="button"
          onClick={goToday}
          style={{
            padding: "6px 14px", fontSize: 12, fontWeight: 700,
            border: isCurrentMonth ? "1px solid #2563eb" : "1px solid var(--admin-border)",
            borderRadius: 8,
            background: isCurrentMonth ? "#2563eb" : "var(--admin-bg)",
            color: isCurrentMonth ? "#fff" : "var(--admin-text-secondary)",
            cursor: "pointer", transition: "all 0.15s ease",
          }}
        >
          Today
        </button>
      </div>

      {/* Day-of-week headers */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", borderBottom: "2px solid var(--admin-border)" }}>
        {DAY_LABELS.map((label, i) => (
          <div key={label} style={{
            padding: "8px 0", textAlign: "center", fontSize: 11, fontWeight: 700,
            textTransform: "uppercase", letterSpacing: "0.05em",
            color: (i === 0 || i === 6) ? "var(--admin-text-faint)" : "var(--admin-text-muted)",
          }}>
            {label}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)" }}>
        {cells.map((cell) => {
          if (cell.outside) {
            return (
              <div key={cell.key} style={{
                minHeight: 88, padding: 4,
                borderBottom: "1px solid var(--admin-border-light, #f3f4f6)",
                borderRight: "1px solid var(--admin-border-light, #f3f4f6)",
                background: "var(--admin-bg-secondary)",
              }}>
                <div style={{ textAlign: "right", fontSize: 12, color: "var(--admin-text-faint)", opacity: 0.5, padding: "2px 4px" }}>
                  {cell.day}
                </div>
              </div>
            );
          }

          const dayEvents = eventsByDay[cell.day] || [];
          const isToday = sameDay(new Date(year, month, cell.day), today);
          const isSelected = selectedDay === cell.day;
          const isWeekend = new Date(year, month, cell.day).getDay() % 6 === 0;

          // Get unique source types for dot indicators
          const sourceDots = [...new Set(dayEvents.map(e => e._source).filter(Boolean))];

          return (
            <div
              key={cell.key}
              onClick={onDayClick ? () => onDayClick(cell.day) : undefined}
              style={{
                minHeight: 88, padding: 4, position: "relative",
                borderBottom: "1px solid var(--admin-border-light, #f3f4f6)",
                borderRight: "1px solid var(--admin-border-light, #f3f4f6)",
                background: isSelected
                  ? "var(--admin-accent-bg)"
                  : isWeekend
                    ? "var(--admin-bg-secondary)"
                    : "var(--admin-bg)",
                cursor: onDayClick ? "pointer" : "default",
                transition: "background 0.12s ease",
                ...(isSelected ? { boxShadow: "inset 0 0 0 2px #2563eb" } : {}),
              }}
              onMouseEnter={e => {
                if (!isSelected) e.currentTarget.style.background = "var(--admin-bg-tertiary)";
              }}
              onMouseLeave={e => {
                if (!isSelected) {
                  e.currentTarget.style.background = isWeekend ? "var(--admin-bg-secondary)" : "var(--admin-bg)";
                }
              }}
            >
              {/* Day number */}
              <div style={{
                display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 3,
                padding: "1px 3px", marginBottom: 2,
              }}>
                {/* Source dot indicators */}
                {sourceDots.length > 0 && (
                  <div style={{ display: "flex", gap: 2, marginRight: "auto" }}>
                    {sourceDots.map(src => (
                      <span key={src} style={{
                        width: 5, height: 5, borderRadius: "50%",
                        background: SOURCE_DOT[src] || "#9ca3af",
                      }} />
                    ))}
                  </div>
                )}
                <span style={{
                  fontSize: 12, fontWeight: isToday ? 800 : 500,
                  color: isToday ? "#fff" : isSelected ? "#2563eb" : "var(--admin-text-muted)",
                  ...(isToday ? {
                    background: "#2563eb", borderRadius: "50%",
                    width: 24, height: 24, display: "inline-flex",
                    alignItems: "center", justifyContent: "center", lineHeight: 1,
                  } : {}),
                }}>
                  {cell.day}
                </span>
              </div>

              {/* Event pills */}
              {dayEvents.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                  {dayEvents.slice(0, 2).map((evt) => (
                    <div
                      key={evt.id}
                      className={getEventColor(evt)}
                      style={{
                        fontSize: 10, fontWeight: 600, lineHeight: "14px",
                        padding: "1px 4px", borderRadius: 3,
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      }}
                      title={evt._source === "event"
                        ? `${evt.type || "Event"} - ${evt.label}`
                        : evt._source === "shift"
                          ? `Shift - ${evt.label}`
                          : `${evt.type || "Time Off"} - ${evt.user?.name || "Unknown"} (${evt.status})`}
                    >
                      {evt.label || evt.user?.name || "\u2014"}
                    </div>
                  ))}
                  {dayEvents.length > 2 && (
                    <div style={{ fontSize: 10, color: "var(--admin-text-faint)", paddingLeft: 4, fontWeight: 600 }}>
                      +{dayEvents.length - 2} more
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div style={{
        display: "flex", flexWrap: "wrap", gap: 16, marginTop: 14,
        padding: "10px 0", borderTop: "1px solid var(--admin-border-light, #f3f4f6)",
      }}>
        {legendEntries.map((item) => (
          <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span className={item.cls} style={{ width: 10, height: 10, borderRadius: 3, display: "inline-block" }} />
            <span style={{ fontSize: 11, color: "var(--admin-text-muted)", fontWeight: 600 }}>{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
