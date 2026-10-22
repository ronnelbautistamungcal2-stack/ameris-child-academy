import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { SkeletonTable } from "@/components/ui/Skeleton";
import MonthlyCalendar from "@/components/calendar/MonthlyCalendar";
import { apiJson } from "@/lib/api";
import { toCalendarDay } from "@/lib/calendar";
import { groupTimeOffRequests } from "@/lib/time-off";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { TIME_OFF_CALENDAR_KINDS, calendarStyleOf } from "@/lib/calendarColors";
import { NAVY } from "@/components/reports/reportUi";

function toDateInputValue(date) {
  if (!date) return "";
  const value = new Date(date);
  if (Number.isNaN(value.getTime())) return "";
  const yyyy = value.getFullYear();
  const mm = String(value.getMonth() + 1).padStart(2, "0");
  const dd = String(value.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function toTimeInputValue(date) {
  if (!date) return "";
  const value = new Date(date);
  if (Number.isNaN(value.getTime())) return "";
  const hh = String(value.getHours()).padStart(2, "0");
  const mm = String(value.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

function buildDateTime(dateValue, timeValue, fallback = "00:00") {
  const datePart = String(dateValue || "").trim();
  if (!datePart) return null;
  const timePart = String(timeValue || fallback).trim() || fallback;
  const value = new Date(`${datePart}T${timePart}`);
  return Number.isNaN(value.getTime()) ? null : value;
}

function fmtDateTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function fmtRange(start, end) {
  if (!start || !end) return "-";
  const startDate = new Date(start);
  const endDate = new Date(end);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return "-";

  const sameDay =
    startDate.getFullYear() === endDate.getFullYear() &&
    startDate.getMonth() === endDate.getMonth() &&
    startDate.getDate() === endDate.getDate();

  if (sameDay) {
    return `${startDate.toLocaleDateString()} - ${startDate.toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    })} to ${endDate.toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    })}`;
  }

  return `${fmtDateTime(start)} - ${fmtDateTime(end)}`;
}

export default function EmployeeTimeOffPage({
  LayoutComponent,
  title = "Time Off",
  description = "Submit time-off requests and track your approvals here.",
  requestHelpText = "Approvals are managed by administrators from Staff Management.",
}) {
  const { data: session } = useSession();
  const userId = session?.user?.id || "";
  const router = useRouter();
  // Each portal has its own My Time Sheet page (e.g. /teacher/time-sheet).
  const timeSheetHref = `/${String(router.pathname || "").split("/").filter(Boolean)[0] || "staff"}/time-sheet`;

  const [centers, setCenters] = useState([]);
  const [centerId, setCenterId] = useState("");

  const [requests, setRequests] = useState([]);
  const [attendanceSummary, setAttendanceSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [startDate, setStartDate] = useState(toDateInputValue(new Date()));
  const [endDate, setEndDate] = useState(toDateInputValue(new Date()));
  const [startTime, setStartTime] = useState(toTimeInputValue(new Date()) || "08:00");
  const [endTime, setEndTime] = useState("17:00");
  const [reason, setReason] = useState("");
  const [cancelTarget, setCancelTarget] = useState(null);
  const [expandedGroups, setExpandedGroups] = useState({});
  const [requestsOpen, setRequestsOpen] = useState(true);
  const [showPast, setShowPast] = useState(false);

  const [calYear, setCalYear] = useState(new Date().getFullYear());
  const [calMonth, setCalMonth] = useState(new Date().getMonth());
  const [calEvents, setCalEvents] = useState([]);
  const [selectedDay, setSelectedDay] = useState(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError("");
      try {
        const data = await apiJson("/api/v1/centers");
        const rows = Array.isArray(data) ? data : [];
        setCenters(rows);
        if (rows.length === 1) setCenterId(rows[0].id);
      } catch (nextError) {
        setError(nextError.message || "Failed to load centers");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const loadRequests = useCallback(async () => {
    if (!centerId || !userId) {
      setRequests([]);
      return;
    }

    try {
      const query = new URLSearchParams({
        centerId,
        userId,
      });
      const data = await apiJson(`/api/v1/time-off?${query.toString()}`);
      setRequests(Array.isArray(data) ? data : []);
    } catch (nextError) {
      setError(nextError.message || "Failed to load requests");
    }
  }, [centerId, userId]);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  useEffect(() => {
    if (!centerId || !userId) {
      setAttendanceSummary(null);
      return;
    }

    (async () => {
      try {
        const yearStart = `${new Date().getFullYear()}-01-01`;
        setAttendanceSummary(
          await apiJson(
            `/api/v1/staff-attendance/summary?centerId=${encodeURIComponent(centerId)}&userId=${encodeURIComponent(userId)}&from=${yearStart}&to=${toDateInputValue(new Date())}`,
          ),
        );
      } catch {
        setAttendanceSummary(null);
      }
    })();
  }, [centerId, userId]);

  const loadCalendarEvents = useCallback(async () => {
    if (!centerId) {
      setCalEvents([]);
      return;
    }

    try {
      const from = `${calYear}-${String(calMonth + 1).padStart(2, "0")}-01`;
      const lastDay = new Date(calYear, calMonth + 1, 0).getDate();
      const to = `${calYear}-${String(calMonth + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
      const data = await apiJson(
        `/api/v1/time-off/calendar?centerId=${encodeURIComponent(centerId)}&from=${from}&to=${to}&includeEvents=1&includePending=1`,
      );
      setCalEvents(Array.isArray(data) ? data : []);
    } catch {
      setCalEvents([]);
    }
  }, [calMonth, calYear, centerId]);

  useEffect(() => {
    loadCalendarEvents();
  }, [loadCalendarEvents]);

  async function submitRequest() {
    if (!centerId) {
      setError("Select a center first.");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const start = buildDateTime(startDate, startTime, "00:00");
      const end = buildDateTime(endDate, endTime, "23:59");

      if (!startDate || !endDate) throw new Error("Start and end date are required.");
      if (!start || !end) throw new Error("Invalid date or time.");
      if (end < start) throw new Error("End date cannot be before start date.");

      const result = await apiJson("/api/v1/time-off", {
        method: "POST",
        body: JSON.stringify({
          centerId,
          startDate: start.toISOString(),
          endDate: end.toISOString(),
          reason: reason || null,
        }),
      });

      setReason("");
      setSuccess(
        Array.isArray(result?.requests) && result.requests.length > 1
          ? `Time-off request submitted for ${result.requests.length} weekdays.`
          : "Time-off request submitted.",
      );
      await loadRequests();
      await loadCalendarEvents();
    } catch (nextError) {
      setError(nextError.message || "Failed to submit request");
    } finally {
      setSaving(false);
    }
  }

  async function submit(event) {
    event.preventDefault();
    await submitRequest();
  }

  async function cancelRequests(ids) {
    try {
      await Promise.all(
        ids.map((id) =>
          apiJson(`/api/v1/time-off/${id}`, {
            method: "PUT",
            body: JSON.stringify({ status: "CANCELLED" }),
          }),
        ),
      );
      setCancelTarget(null);
      await loadRequests();
      await loadCalendarEvents();
    } catch (nextError) {
      setError(nextError.message || "Failed to cancel request");
      setCancelTarget(null);
    }
  }

  const monthCalEvents = useMemo(
    () =>
      calEvents.map((evt) =>
        evt._source === "timeoff" ? { ...evt, label: evt.user?.name || "Unknown" } : evt,
      ),
    [calEvents],
  );

  const dayItems = useMemo(() => {
    if (!selectedDay) return [];
    const day = new Date(calYear, calMonth, selectedDay);
    return monthCalEvents.filter((evt) => {
      const start = toCalendarDay(evt.startDate, { allDay: !!evt.allDay });
      const end = toCalendarDay(evt.endDate, { allDay: !!evt.allDay });
      if (!start || !end) return false;
      return day >= start && day <= end;
    });
  }, [monthCalEvents, calYear, calMonth, selectedDay]);

  const fullGroupSizeByKey = useMemo(() => {
    const map = new Map();
    for (const request of requests) {
      const key = request.requestGroupId || request.id;
      map.set(key, (map.get(key) || 0) + 1);
    }
    return map;
  }, [requests]);

  // One card per request (multi-day requests grouped), per status. Past
  // requests are hidden unless asked for (client request 2026-10-02).
  const requestGroups = useMemo(() => {
    const byStatus = {};
    for (const request of requests) {
      const kind = request.status === "APPROVED" && request.isUnexcused ? "UNEXCUSED" : request.status;
      (byStatus[kind] ||= []).push(request);
    }
    const now = Date.now();
    return Object.entries(byStatus)
      .flatMap(([kind, list]) => groupTimeOffRequests(list, fullGroupSizeByKey).map((group) => ({ ...group, kind })))
      .filter((group) => showPast || new Date(group.rangeEnd).getTime() >= now)
      .sort((a, b) => new Date(a.rangeStart).getTime() - new Date(b.rangeStart).getTime());
  }, [requests, fullGroupSizeByKey, showPast]);

  const toggleGroupExpanded = useCallback((key) => {
    setExpandedGroups((current) => ({ ...current, [key]: !current[key] }));
  }, []);

  return (
    <LayoutComponent title={title}>
      <div className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white" aria-hidden>
              <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
              </svg>
            </span>
            <div>
              <h1 className={`text-3xl font-black ${NAVY}`}>{title}</h1>
              <p className="text-sm text-blue-700 dark:text-blue-300">{description}</p>
              <p className="text-xs text-gray-500">{requestHelpText}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-end gap-2">
          <Link href={timeSheetHref} className="rounded-lg border border-blue-300 bg-white px-4 py-2 text-sm font-bold text-blue-700 hover:bg-blue-50 dark:bg-gray-800">
            My Time Sheet
          </Link>
          <label className="block">
            <span className={`text-sm font-bold ${NAVY}`}>Center</span>
            <select
              value={centerId}
              onChange={(event) => setCenterId(event.target.value)}
              className="mt-1 block w-64 max-w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800"
              disabled={loading}
              aria-label="Center"
            >
              <option value="">Select a center...</option>
              {centers.map((center) => (
                <option key={center.id} value={center.id}>
                  {center.name}
                </option>
              ))}
            </select>
          </label>
          </div>
        </div>

        {error ? <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div> : null}
        {success ? <div className="rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-800">{success}</div> : null}

        {loading ? (
          <SkeletonTable rows={5} cols={4} />
        ) : !centerId ? (
          <div className="rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-900">
            Select a center to submit requests and review your schedule.
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <SummaryCard label="Late" value={attendanceSummary?.late ?? 0} tone="sky" icon="clock" />
              <SummaryCard label="Absent" value={attendanceSummary?.absent ?? 0} tone="green" icon="calendar" />
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div className={card}>
                <h2 className={`text-lg font-black ${NAVY}`}>Submit Time Off Request</h2>
                <form onSubmit={submit} className="mt-3 space-y-3">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <label className="block">
                      <span className={labelClass}>Start Date</span>
                      <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} className={inputClass} required />
                    </label>
                    <label className="block">
                      <span className={labelClass}>End Date</span>
                      <input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} className={inputClass} required />
                    </label>
                    <label className="block">
                      <span className={labelClass}>Start Time</span>
                      <input type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} className={inputClass} required />
                    </label>
                    <label className="block">
                      <span className={labelClass}>End Time</span>
                      <input type="time" value={endTime} onChange={(event) => setEndTime(event.target.value)} className={inputClass} required />
                    </label>
                  </div>
                  <label className="block">
                    <span className={labelClass}>Reason</span>
                    <textarea
                      value={reason}
                      onChange={(event) => setReason(event.target.value.slice(0, 250))}
                      rows={3}
                      className={inputClass}
                      placeholder="Enter a short note (optional)..."
                    />
                    <span className="block text-right text-xs text-gray-500">{reason.length}/250</span>
                  </label>
                  <button
                    type="submit"
                    disabled={saving}
                    className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {saving ? "Submitting..." : "Submit Request"}
                  </button>
                </form>
              </div>

              <div className={card}>
                <button
                  type="button"
                  onClick={() => setRequestsOpen((open) => !open)}
                  aria-expanded={requestsOpen}
                  className="flex w-full items-start justify-between gap-3 text-left"
                >
                  <div>
                    <h2 className={`text-lg font-black ${NAVY}`}>My Requests</h2>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Your request history and current approval status.</p>
                  </div>
                  <span className="mt-1 text-gray-500">{requestsOpen ? "▲" : "▼"}</span>
                </button>
                {requestsOpen ? (
                  <div className="mt-3 space-y-2">
                    {requestGroups.length === 0 ? (
                      <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-800">
                        {showPast ? "No time-off requests submitted yet." : "No upcoming time-off requests."}
                      </div>
                    ) : (
                      requestGroups.map((group) => (
                        <RequestCard
                          key={`${group.kind}:${group.key}`}
                          group={group}
                          expanded={!!expandedGroups[group.key]}
                          onToggle={() => toggleGroupExpanded(group.key)}
                          onCancel={(ids) => setCancelTarget(ids)}
                        />
                      ))
                    )}
                    <button type="button" onClick={() => setShowPast((v) => !v)} className="text-xs font-semibold text-blue-700 hover:underline">
                      {showPast ? "Hide past requests" : "Show past requests"}
                    </button>
                  </div>
                ) : null}
              </div>
            </div>

            <div className={card}>
              <div className={`grid grid-cols-1 gap-4 ${selectedDay ? "lg:grid-cols-[1fr_minmax(0,280px)]" : ""}`}>
                <MonthlyCalendar
                  year={calYear}
                  month={calMonth}
                  events={monthCalEvents}
                  legendKinds={TIME_OFF_CALENDAR_KINDS}
                  selectedDay={selectedDay}
                  onDayClick={setSelectedDay}
                  onMonthChange={(nextYear, nextMonth) => {
                    setCalYear(nextYear);
                    setCalMonth(nextMonth);
                    setSelectedDay(null);
                  }}
                />
                {selectedDay ? (
                  <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800">
                    <div className="flex items-center justify-between gap-3">
                      <div className={`text-sm font-extrabold ${NAVY}`}>
                        {new Date(calYear, calMonth, selectedDay).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
                      </div>
                      <button type="button" onClick={() => setSelectedDay(null)} aria-label="Close day detail" className="text-gray-400 hover:text-gray-600">
                        &#10005;
                      </button>
                    </div>
                    {dayItems.length === 0 ? (
                      <div className="mt-3 text-sm text-gray-500">No items this day.</div>
                    ) : (
                      <div className="mt-3 space-y-2">
                        {dayItems.map((item) => (
                          <div key={item.id} className="rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-900">
                            <div className="flex items-center gap-2">
                              <span className={`rounded-full border px-2 py-0.5 text-[10px] font-extrabold ${calendarStyleOf(item).pill}`}>
                                {item._source === "event" ? "EVENT" : item.isUnexcused ? "UNEXCUSED" : "TIME OFF"}
                              </span>
                              <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">{item.label}</span>
                            </div>
                            {item._source === "event" && item.description ? <div className="mt-1 text-xs text-gray-600">{item.description}</div> : null}
                            {item._source === "timeoff" ? (
                              <>
                                <div className="mt-1 text-xs text-gray-600 dark:text-gray-400">Status: {item.status}</div>
                                <div className="mt-1 text-xs text-gray-600 dark:text-gray-400">{fmtRange(item.startDate, item.endDate)}</div>
                                <div className="mt-1 text-xs text-gray-600 dark:text-gray-400">Cover: {item.coverageName || "Unassigned"}</div>
                              </>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            </div>
          </>
        )}
      </div>
      <ConfirmDialog
        open={!!cancelTarget}
        title="Cancel Request"
        message={
          cancelTarget?.length > 1
            ? `Are you sure you want to cancel these ${cancelTarget.length} pending days?`
            : "Are you sure you want to cancel this time-off request?"
        }
        confirmLabel="Cancel Request"
        variant="danger"
        onConfirm={() => cancelRequests(cancelTarget)}
        onCancel={() => setCancelTarget(null)}
      />
    </LayoutComponent>
  );
}

const card = "rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900";
const labelClass = "text-sm font-semibold text-gray-700 dark:text-gray-300";
const inputClass = "mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800";

const REQUEST_STYLES = {
  APPROVED: { box: "border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/40", badge: "bg-emerald-100 text-emerald-800", label: "Approved" },
  UNEXCUSED: { box: "border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/40", badge: "bg-red-100 text-red-800", label: "Unexcused" },
  PENDING: { box: "border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40", badge: "bg-amber-100 text-amber-800", label: "Pending" },
  DENIED: { box: "border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/40", badge: "bg-red-100 text-red-800", label: "Denied" },
  CANCELLED: { box: "border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800", badge: "bg-gray-200 text-gray-700", label: "Cancelled" },
};

function RequestCard({ group, expanded, onToggle, onCancel }) {
  const request = group.items[0];
  const style = REQUEST_STYLES[group.kind] || REQUEST_STYLES.CANCELLED;
  const heading = `${style.label} Time Off`;
  const created = request.createdAt ? new Date(request.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "";
  return (
    <div className={`rounded-xl border p-3 ${style.box}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-extrabold text-gray-900 dark:text-gray-100">{heading}</div>
          <div className="text-sm text-gray-800 dark:text-gray-200">{fmtRange(group.rangeStart, group.rangeEnd)}</div>
          <div className="text-xs text-gray-600 dark:text-gray-400">
            {request.reason}
          </div>
          {group.isGrouped ? (
            <button type="button" onClick={onToggle} className="mt-1 text-xs font-semibold text-gray-600 underline decoration-dotted">
              {group.items.length} of {group.fullGroupSize} day{group.fullGroupSize === 1 ? "" : "s"}
              {expanded ? " (hide days)" : " (show days)"}
            </button>
          ) : null}
          {request.coverageName ? <div className="text-xs text-gray-600">Cover: {request.coverageName}</div> : null}
          {request.reviewNotes ? <div className="text-xs italic text-gray-500">Review: {request.reviewNotes}</div> : null}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${style.badge}`}>{style.label}</span>
          <span className="text-xs text-gray-500">{created}</span>
          {group.kind === "PENDING" ? (
            <button type="button" onClick={() => onCancel(group.items.map((item) => item.id))} className="text-xs font-semibold text-red-600 hover:underline">
              {group.isGrouped ? "Cancel all" : "Cancel"}
            </button>
          ) : null}
        </div>
      </div>
      {group.isGrouped && expanded ? (
        <div className="mt-2 space-y-1 border-t border-black/10 pt-2">
          {group.items.map((item) => (
            <div key={item.id} className="flex items-center justify-between gap-2 text-xs text-gray-700 dark:text-gray-300">
              <span>{fmtRange(item.startDate, item.endDate)}</span>
              {group.kind === "PENDING" ? (
                <button type="button" onClick={() => onCancel([item.id])} className="font-semibold text-red-600 hover:underline">
                  Cancel this day
                </button>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

const SUMMARY_TONES = {
  sky: "bg-sky-50 text-sky-600 dark:bg-sky-950/40",
  green: "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40",
};
const SUMMARY_ICONS = {
  clock: "M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z",
  calendar: "M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5",
};

function SummaryCard({ label, value, tone, icon }) {
  return (
    <div className={`flex items-center gap-3 rounded-xl border border-gray-200 p-4 dark:border-gray-700 ${SUMMARY_TONES[tone]}`}>
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white dark:bg-gray-900" aria-hidden>
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d={SUMMARY_ICONS[icon]} />
        </svg>
      </span>
      <div>
        <div className={`text-sm font-semibold ${NAVY}`}>{label}</div>
        <div className={`text-2xl font-black ${NAVY}`}>{value}</div>
      </div>
    </div>
  );
}
