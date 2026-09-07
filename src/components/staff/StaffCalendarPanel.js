import MonthlyCalendar from "@/components/calendar/MonthlyCalendar";
import Skeleton from "@/components/ui/Skeleton";
import { apiJson } from "@/lib/api";
import { toCalendarDay } from "@/lib/calendar";
import { useCallback, useEffect, useMemo, useState } from "react";

const SOURCE_BADGE = {
  event: "bg-indigo-100 text-indigo-700",
  shift: "bg-blue-100 text-blue-700",
  timeoff: "bg-emerald-100 text-emerald-700",
  birthday: "bg-pink-100 text-pink-700",
};

const LEGEND = [
  { label: "Events", cls: "bg-indigo-100" },
  { label: "My Shifts", cls: "bg-blue-100" },
  { label: "My Time Off", cls: "bg-emerald-100" },
  { label: "Birthdays", cls: "bg-pink-100" },
];

const FILTERS = [
  { key: "events", label: "Events", activeClass: "border-indigo-200 bg-indigo-50 text-indigo-700" },
  { key: "shifts", label: "My Shifts", activeClass: "border-blue-200 bg-blue-50 text-blue-700" },
  { key: "timeOff", label: "My Time Off", activeClass: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  { key: "birthdays", label: "Birthdays", activeClass: "border-pink-200 bg-pink-50 text-pink-700" },
];

const EMPTY_DATA = { events: [], shifts: [], timeOff: [], birthdays: [] };

function buildShiftDate(date, time) {
  const day = String(date || "").slice(0, 10);
  const hours = String(time || "00:00").padEnd(5, "0");
  const parsed = new Date(`${day}T${hours}`);
  return Number.isNaN(parsed.getTime()) ? new Date(date) : parsed;
}

function formatDayLabel(year, month, day) {
  return new Date(year, month, day).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

/**
 * Month calendar of the signed-in staff member's events, shifts, time off, and
 * staff birthdays. Rendered inside the Other Staff dashboard, which owns the
 * center selection.
 */
export default function StaffCalendarPanel({ centerId }) {
  const now = new Date();
  const [calYear, setCalYear] = useState(now.getFullYear());
  const [calMonth, setCalMonth] = useState(now.getMonth());
  const [calData, setCalData] = useState(EMPTY_DATA);
  const [filters, setFilters] = useState({ events: true, shifts: true, timeOff: true, birthdays: true });
  const [selectedDay, setSelectedDay] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setSelectedDay(null);
  }, [centerId]);

  const loadCalendar = useCallback(async () => {
    if (!centerId) {
      setCalData(EMPTY_DATA);
      return;
    }

    setLoading(true);
    setError("");
    try {
      const from = new Date(calYear, calMonth, 1).toISOString();
      const to = new Date(calYear, calMonth + 1, 0, 23, 59, 59, 999).toISOString();
      const data = await apiJson(
        `/api/v1/calendar?centerId=${encodeURIComponent(centerId)}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
      );
      setCalData({
        events: Array.isArray(data?.events) ? data.events : [],
        shifts: Array.isArray(data?.shifts) ? data.shifts : [],
        timeOff: Array.isArray(data?.timeOff) ? data.timeOff : [],
        birthdays: Array.isArray(data?.birthdays) ? data.birthdays : [],
      });
    } catch (nextError) {
      setError(nextError.message || "Failed to load calendar data");
      setCalData(EMPTY_DATA);
    } finally {
      setLoading(false);
    }
  }, [calMonth, calYear, centerId]);

  useEffect(() => {
    loadCalendar();
  }, [loadCalendar]);

  const normalizedEvents = useMemo(() => {
    const rows = [];

    if (filters.events) {
      for (const event of calData.events || []) {
        rows.push({
          id: event.id,
          _source: "event",
          type: event.type,
          status: "ACTIVE",
          startDate: event.startDate,
          endDate: event.endDate,
          allDay: event.allDay,
          user: event.createdBy,
          label: event.title,
          _raw: event,
        });
      }
    }

    if (filters.shifts) {
      for (const shift of calData.shifts || []) {
        rows.push({
          id: shift.id,
          _source: "shift",
          type: "Shift",
          status: "ACTIVE",
          startDate: shift.date,
          endDate: shift.date,
          user: shift.user,
          label: `${shift.startTime}-${shift.endTime}${shift.position ? ` (${shift.position})` : ""}`,
          _raw: shift,
        });
      }
    }

    if (filters.timeOff) {
      for (const request of calData.timeOff || []) {
        rows.push({
          id: request.id,
          _source: "timeoff",
          type: request.type,
          status: request.status,
          startDate: request.startDate,
          endDate: request.endDate,
          user: request.user,
          label: `${request.type} (${request.status})`,
          _raw: request,
        });
      }
    }

    if (filters.birthdays) {
      for (const birthday of calData.birthdays || []) {
        rows.push({
          id: birthday.id,
          _source: "birthday",
          type: "Birthday",
          status: "ACTIVE",
          startDate: birthday.date,
          endDate: birthday.date,
          allDay: true,
          user: birthday.user,
          label: `${birthday.user?.name || "—"}'s Birthday`,
          _raw: { ...birthday, allDay: true },
        });
      }
    }

    return rows;
  }, [
    calData.events,
    calData.shifts,
    calData.timeOff,
    calData.birthdays,
    filters.events,
    filters.shifts,
    filters.timeOff,
    filters.birthdays,
  ]);

  const dayItems = useMemo(() => {
    if (!selectedDay) return [];

    const target = new Date(calYear, calMonth, selectedDay);
    return normalizedEvents.filter((item) => {
      const start = toCalendarDay(item.startDate, { allDay: !!item._raw?.allDay });
      const end = toCalendarDay(item.endDate, { allDay: !!item._raw?.allDay });
      if (!start || !end) return false;
      return target >= start && target <= end;
    });
  }, [calMonth, calYear, normalizedEvents, selectedDay]);

  const upcomingItems = useMemo(() => {
    const today = new Date();
    return normalizedEvents
      .map((item) => ({
        ...item,
        startsAt:
          item._source === "shift"
            ? buildShiftDate(item._raw?.date, item._raw?.startTime)
            : new Date(item.startDate),
      }))
      .filter((item) => !Number.isNaN(item.startsAt.getTime()) && item.startsAt >= today)
      .sort((a, b) => a.startsAt - b.startsAt)
      .slice(0, 5);
  }, [normalizedEvents]);

  if (!centerId) {
    return (
      <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-600">
        Select a center to load your calendar.
      </div>
    );
  }

  const listItems = selectedDay ? dayItems : upcomingItems;

  return (
    <div className="space-y-4">
      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((filter) => (
          <button
            key={filter.key}
            type="button"
            onClick={() =>
              setFilters((current) => ({ ...current, [filter.key]: !current[filter.key] }))
            }
            className={[
              "rounded-full border px-3 py-1.5 text-sm font-semibold transition",
              filters[filter.key]
                ? filter.activeClass
                : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50",
            ].join(" ")}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {loading ? (
        <Skeleton count={6} />
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="rounded-2xl border border-gray-200 bg-white p-4">
            <MonthlyCalendar
              year={calYear}
              month={calMonth}
              events={normalizedEvents}
              selectedDay={selectedDay}
              onMonthChange={(nextYear, nextMonth) => {
                setCalYear(nextYear);
                setCalMonth(nextMonth);
                setSelectedDay(null);
              }}
              onDayClick={setSelectedDay}
              legendItems={LEGEND}
            />
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-base font-black text-gray-900">
                  {selectedDay ? formatDayLabel(calYear, calMonth, selectedDay) : "Upcoming items"}
                </div>
                <div className="mt-1 text-sm text-gray-500">
                  {selectedDay
                    ? "Events, shifts, and time off scheduled for this date."
                    : "The next items coming up on your calendar."}
                </div>
              </div>
              {selectedDay ? (
                <button
                  type="button"
                  onClick={() => setSelectedDay(null)}
                  className="rounded-xl border border-gray-200 px-3 py-1.5 text-xs font-bold text-gray-600 hover:bg-gray-50"
                >
                  Clear day
                </button>
              ) : null}
            </div>

            <div className="mt-4 space-y-3">
              {listItems.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-600">
                  {selectedDay
                    ? "No calendar items fall on this date."
                    : "No upcoming calendar items are visible with the current filters."}
                </div>
              ) : (
                listItems.map((item) => (
                  <div
                    key={`${item._source}-${item.id}`}
                    className="rounded-2xl border border-gray-200 bg-gray-50/80 p-4"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
                          SOURCE_BADGE[item._source] || "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {item._source === "event"
                          ? "Event"
                          : item._source === "shift"
                            ? "Shift"
                            : item._source === "birthday"
                              ? "Birthday"
                              : "Time Off"}
                      </span>
                      <div className="text-sm font-extrabold text-gray-900">{item.label}</div>
                    </div>
                    <div className="mt-2 text-sm text-gray-600">
                      {item._source === "shift"
                        ? item.startsAt.toLocaleString()
                        : new Date(item.startDate).toLocaleDateString()}
                    </div>
                    {item._raw?.description ? (
                      <div className="mt-2 text-sm text-gray-600">{item._raw.description}</div>
                    ) : null}
                    {item._source === "shift" && item._raw?.notes ? (
                      <div className="mt-2 text-xs text-gray-500">{item._raw.notes}</div>
                    ) : null}
                    {item._source === "birthday" && Number.isFinite(item._raw?.age) ? (
                      <div className="mt-2 text-xs text-gray-500">Turning {item._raw.age}</div>
                    ) : null}
                    {item._source === "timeoff" && item._raw?.reason ? (
                      <div className="mt-2 text-xs text-gray-500">{item._raw.reason}</div>
                    ) : null}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
