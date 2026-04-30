import MonthlyCalendar from "@/components/calendar/MonthlyCalendar";
import StaffLayout from "@/components/staff/StaffLayout";
import Skeleton from "@/components/ui/Skeleton";
import {
  WorkspaceHero,
  WorkspacePill,
  WorkspaceState,
  WorkspaceStat,
  workspaceInputClass,
} from "@/components/ui/Workspace";
import useSyncedCenterId from "@/hooks/useSyncedCenterId";
import { apiJson } from "@/lib/api";
import { useCallback, useEffect, useMemo, useState } from "react";

const SOURCE_BADGE = {
  event: "bg-indigo-100 text-indigo-700",
  shift: "bg-blue-100 text-blue-700",
  timeoff: "bg-emerald-100 text-emerald-700",
};

const LEGEND = [
  { label: "Events", cls: "bg-indigo-100" },
  { label: "My Shifts", cls: "bg-blue-100" },
  { label: "My Time Off", cls: "bg-emerald-100" },
];

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

export default function StaffCalendarPage() {
  const [centers, setCenters] = useState([]);
  const [centerId, setCenterId] = useState("");
  const [calYear, setCalYear] = useState(new Date().getFullYear());
  const [calMonth, setCalMonth] = useState(new Date().getMonth());
  const [calData, setCalData] = useState({ events: [], shifts: [], timeOff: [] });
  const [filters, setFilters] = useState({ events: true, shifts: true, timeOff: true });
  const [selectedDay, setSelectedDay] = useState(null);
  const [loadingCenters, setLoadingCenters] = useState(true);
  const [loadingCalendar, setLoadingCalendar] = useState(false);
  const [error, setError] = useState("");

  useSyncedCenterId(centerId, setCenterId, centers);

  useEffect(() => {
    (async () => {
      setLoadingCenters(true);
      setError("");
      try {
        const data = await apiJson("/api/v1/centers");
        setCenters(Array.isArray(data) ? data : []);
      } catch (nextError) {
        setError(nextError.message || "Failed to load centers");
      } finally {
        setLoadingCenters(false);
      }
    })();
  }, []);

  const loadCalendar = useCallback(async () => {
    if (!centerId) {
      setCalData({ events: [], shifts: [], timeOff: [] });
      return;
    }

    setLoadingCalendar(true);
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
      });
    } catch (nextError) {
      setError(nextError.message || "Failed to load calendar data");
      setCalData({ events: [], shifts: [], timeOff: [] });
    } finally {
      setLoadingCalendar(false);
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

    return rows;
  }, [calData.events, calData.shifts, calData.timeOff, filters.events, filters.shifts, filters.timeOff]);

  const dayItems = useMemo(() => {
    if (!selectedDay) return [];

    const target = new Date(calYear, calMonth, selectedDay);
    return normalizedEvents.filter((item) => {
      const start = new Date(new Date(item.startDate).toDateString());
      const end = new Date(new Date(item.endDate).toDateString());
      return target >= start && target <= end;
    });
  }, [calMonth, calYear, normalizedEvents, selectedDay]);

  const upcomingItems = useMemo(() => {
    const today = new Date();
    return normalizedEvents
      .map((item) => {
        const startsAt =
          item._source === "shift"
            ? buildShiftDate(item._raw?.date, item._raw?.startTime)
            : new Date(item.startDate);
        return {
          ...item,
          startsAt,
        };
      })
      .filter((item) => !Number.isNaN(item.startsAt.getTime()) && item.startsAt >= today)
      .sort((a, b) => a.startsAt - b.startsAt)
      .slice(0, 5);
  }, [normalizedEvents]);

  const selectedCenterName =
    centers.find((center) => center.id === centerId)?.name || "";

  return (
    <StaffLayout
      title="Calendar"
      shellMaxWidthClassName="max-w-[1760px]"
      contentMaxWidthClassName="max-w-[1320px]"
    >
      <div className="space-y-5">
        <WorkspaceHero
          eyebrow="Staff Calendar"
          title={selectedCenterName ? `${selectedCenterName} schedule view` : "My calendar"}
          description="Track shared events alongside your own shifts and approved time off, without classroom or child scheduling views."
          meta={
            <>
              <WorkspacePill tone="amber">
                {new Date(calYear, calMonth, 1).toLocaleDateString("en-US", {
                  month: "long",
                  year: "numeric",
                })}
              </WorkspacePill>
              {selectedCenterName ? (
                <WorkspacePill tone="sky">{selectedCenterName}</WorkspacePill>
              ) : (
                <WorkspacePill tone="slate">Select a center to load your month</WorkspacePill>
              )}
            </>
          }
          controls={
            <label className="block">
              <div className="mb-1.5 text-xs font-black uppercase tracking-[0.16em] text-gray-500">
                Center
              </div>
              <select
                value={centerId}
                onChange={(event) => {
                  setCenterId(event.target.value);
                  setSelectedDay(null);
                }}
                className={workspaceInputClass}
                disabled={loadingCenters}
              >
                <option value="">Select a center...</option>
                {centers.map((center) => (
                  <option key={center.id} value={center.id}>
                    {center.name}
                  </option>
                ))}
              </select>
            </label>
          }
          stats={
            <>
              <WorkspaceStat
                label="Events"
                value={calData.events.length}
                description="Center-wide events visible this month."
                tone="sky"
              />
              <WorkspaceStat
                label="My Shifts"
                value={calData.shifts.length}
                description="Shift entries on your calendar."
                tone="amber"
              />
              <WorkspaceStat
                label="My Time Off"
                value={calData.timeOff.length}
                description="Approved time-off entries in view."
                tone="emerald"
              />
              <WorkspaceStat
                label="Upcoming"
                value={upcomingItems.length}
                description="Next scheduled items starting from today."
                tone="slate"
              />
            </>
          }
        />

        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {error}
          </div>
        ) : null}

        {loadingCenters ? (
          <div className="rounded-3xl border border-gray-200 bg-white p-6">
            <Skeleton count={5} />
          </div>
        ) : !centerId ? (
          <WorkspaceState
            title="Select a center to view your calendar."
            description="The selected center is shared across the staff portal so your dashboard, checklists, and time-off tools stay aligned."
          />
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              {[
                { key: "events", label: "Events", activeClass: "border-indigo-200 bg-indigo-50 text-indigo-700" },
                { key: "shifts", label: "My Shifts", activeClass: "border-blue-200 bg-blue-50 text-blue-700" },
                { key: "timeOff", label: "My Time Off", activeClass: "border-emerald-200 bg-emerald-50 text-emerald-700" },
              ].map((filter) => (
                <button
                  key={filter.key}
                  type="button"
                  onClick={() =>
                    setFilters((current) => ({
                      ...current,
                      [filter.key]: !current[filter.key],
                    }))
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

            {loadingCalendar ? (
              <div className="rounded-3xl border border-gray-200 bg-white p-6">
                <Skeleton count={6} />
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
                <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
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

                <div className="space-y-4">
                  <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-base font-black text-gray-900">
                          {selectedDay
                            ? formatDayLabel(calYear, calMonth, selectedDay)
                            : "Upcoming items"}
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
                      {(selectedDay ? dayItems : upcomingItems).length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-600">
                          {selectedDay
                            ? "No calendar items fall on this date."
                            : "No upcoming calendar items are visible with the current filters."}
                        </div>
                      ) : (
                        (selectedDay ? dayItems : upcomingItems).map((item) => (
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
                                    : "Time Off"}
                              </span>
                              <div className="text-sm font-extrabold text-gray-900">
                                {item.label}
                              </div>
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
                            {item._source === "timeoff" && item._raw?.reason ? (
                              <div className="mt-2 text-xs text-gray-500">{item._raw.reason}</div>
                            ) : null}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </StaffLayout>
  );
}
