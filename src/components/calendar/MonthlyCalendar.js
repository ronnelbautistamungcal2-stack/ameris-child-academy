import { toCalendarDay } from "@/lib/calendar";
import { CALENDAR_KINDS, calendarStyleOf } from "@/lib/calendarColors";
import { useMemo } from "react";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function getEventColor(event) {
  return calendarStyleOf(event).pill;
}

function sameDay(d1, d2) {
  return d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate();
}

function normalizeDate(event, fieldName) {
  return toCalendarDay(event?.[fieldName], { allDay: !!event?.allDay });
}

/**
 * `legendKinds` lists the CALENDAR_KINDS this calendar can show; the legend at
 * the top uses the shared colours and labels for them.
 */
export default function MonthlyCalendar({
  year,
  month,
  events = [],
  onMonthChange,
  onDayClick,
  selectedDay,
  legendKinds = Object.keys(CALENDAR_KINDS),
}) {
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
      const start = normalizeDate(evt, "startDate");
      const end = normalizeDate(evt, "endDate");
      if (!start || !end) continue;
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

  const legendEntries = legendKinds.map((kind) => CALENDAR_KINDS[kind]).filter(Boolean);

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

      {/* Legend */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
        {legendEntries.map((item) => (
          <span
            key={item.label}
            className={item.pill}
            style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 999, borderWidth: 1, borderStyle: "solid" }}
          >
            {item.label}
          </span>
        ))}
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
                          : evt._source === "birthday"
                            ? `Birthday - ${evt.label}`
                            : `${calendarStyleOf(evt).label} - ${evt.user?.name || evt.label || "Unknown"}`}
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
    </div>
  );
}
