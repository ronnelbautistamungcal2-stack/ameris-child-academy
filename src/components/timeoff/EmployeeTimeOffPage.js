import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { SkeletonTable } from "@/components/ui/Skeleton";
import MonthlyCalendar from "@/components/calendar/MonthlyCalendar";
import { apiJson } from "@/lib/api";
import { TIME_OFF_TYPE_OPTIONS } from "@/lib/time-off";
import { useSession } from "next-auth/react";
import { useCallback, useEffect, useMemo, useState } from "react";

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

const STATUS_BADGE = {
  PENDING: "border-amber-200 bg-amber-50 text-amber-800",
  APPROVED: "border-emerald-200 bg-emerald-50 text-emerald-800",
  DENIED: "border-red-200 bg-red-50 text-red-800",
  CANCELLED: "border-gray-200 bg-gray-50 text-gray-600",
};

const CALENDAR_LEGEND = [
  { label: "Events", cls: "bg-indigo-100" },
  { label: "Pending Requests", cls: "bg-amber-200" },
  { label: "Approved Time Off", cls: "bg-emerald-100" },
];

function formatHours(value) {
  const num = Number(value || 0);
  return Number.isFinite(num) ? num.toFixed(num % 1 === 0 ? 0 : 2) : "0";
}

export default function EmployeeTimeOffPage({
  LayoutComponent,
  title = "Time Off",
  description = "Submit time-off requests and track your approvals here.",
  requestHelpText = "Approvals are managed by administrators from Staff Management.",
}) {
  const { data: session } = useSession();
  const userId = session?.user?.id || "";

  const [centers, setCenters] = useState([]);
  const [centerId, setCenterId] = useState("");

  const [requests, setRequests] = useState([]);
  const [attendanceSummary, setAttendanceSummary] = useState(null);
  const [balanceSummary, setBalanceSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [startDate, setStartDate] = useState(toDateInputValue(new Date()));
  const [endDate, setEndDate] = useState(toDateInputValue(new Date()));
  const [startTime, setStartTime] = useState(toTimeInputValue(new Date()) || "08:00");
  const [endTime, setEndTime] = useState("17:00");
  const [requestType, setRequestType] = useState("PAID");
  const [reason, setReason] = useState("");
  const [cancelTarget, setCancelTarget] = useState(null);
  const [warningState, setWarningState] = useState(null);

  const [calYear, setCalYear] = useState(new Date().getFullYear());
  const [calMonth, setCalMonth] = useState(new Date().getMonth());
  const [calEvents, setCalEvents] = useState([]);

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
      setBalanceSummary(null);
      return;
    }

    (async () => {
      try {
        const yearStart = `${new Date().getFullYear()}-01-01`;
        const [attendance, balanceData] = await Promise.all([
          apiJson(
            `/api/v1/staff-attendance/summary?centerId=${encodeURIComponent(centerId)}&userId=${encodeURIComponent(userId)}&from=${yearStart}&to=${toDateInputValue(new Date())}`,
          ),
          apiJson(
            `/api/v1/time-off/balances?centerId=${encodeURIComponent(centerId)}&userId=${encodeURIComponent(userId)}`,
          ),
        ]);
        setAttendanceSummary(attendance);
        setBalanceSummary(balanceData?.summary || null);
      } catch {
        setAttendanceSummary(null);
        setBalanceSummary(null);
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

  async function submitRequest({ overrideBalanceWarning = false } = {}) {
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

      await apiJson("/api/v1/time-off", {
        method: "POST",
        body: JSON.stringify({
          centerId,
          type: requestType,
          startDate: start.toISOString(),
          endDate: end.toISOString(),
          reason: reason || null,
          overrideBalanceWarning,
        }),
      });

      setReason("");
      setWarningState(null);
      setSuccess("Time-off request submitted.");
      await loadRequests();
      await loadCalendarEvents();
    } catch (nextError) {
      if (nextError?.status === 409 && nextError?.data?.code === "TIME_OFF_BALANCE_WARNING") {
        setWarningState({
          startDate,
          endDate,
          startTime,
          endTime,
          requestType,
          reason,
          warning: nextError.data.warning || null,
        });
        return;
      }
      setError(nextError.message || "Failed to submit request");
    } finally {
      setSaving(false);
    }
  }

  async function submit(event) {
    event.preventDefault();
    await submitRequest();
  }

  async function cancelRequest(id) {
    try {
      await apiJson(`/api/v1/time-off/${id}`, {
        method: "PUT",
        body: JSON.stringify({ status: "CANCELLED" }),
      });
      setCancelTarget(null);
      await loadRequests();
      await loadCalendarEvents();
    } catch (nextError) {
      setError(nextError.message || "Failed to cancel request");
      setCancelTarget(null);
    }
  }

  const pending = useMemo(() => requests.filter((row) => row.status === "PENDING"), [requests]);
  const approved = useMemo(() => requests.filter((row) => row.status === "APPROVED"), [requests]);
  const other = useMemo(
    () => requests.filter((row) => row.status !== "PENDING" && row.status !== "APPROVED"),
    [requests],
  );

  return (
    <LayoutComponent title={title}>
      <div className="space-y-4">
        <div className="rounded-2xl border border-gray-200 bg-white p-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-extrabold text-gray-900">{title}</h2>
              <p className="mt-1 text-sm text-gray-600">{description}</p>
              <p className="mt-1 text-xs text-gray-500">{requestHelpText}</p>
            </div>

            <label className="block">
              <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Center</div>
              <select
                value={centerId}
                onChange={(event) => setCenterId(event.target.value)}
                className="mt-1 w-72 max-w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
                disabled={loading}
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

          {error ? (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              {error}
            </div>
          ) : null}
          {success ? (
            <div className="mt-4 rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-800">
              {success}
            </div>
          ) : null}

          {loading ? (
            <div className="mt-4">
              <SkeletonTable rows={5} cols={4} />
            </div>
          ) : !centerId ? (
            <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
              Select a center to submit requests and review your schedule.
            </div>
          ) : (
            <div className="mt-4 space-y-4">
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <MiniSummaryCard label="Late" value={attendanceSummary?.late ?? 0} />
                <MiniSummaryCard label="Absent" value={attendanceSummary?.absent ?? 0} />
                <MiniSummaryCard label="Paid Hours Available" value={balanceSummary?.paidAvailable ?? 0} />
                <MiniSummaryCard label="Unpaid Hours Available" value={balanceSummary?.unpaidAvailable ?? 0} />
              </div>

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <div className="rounded-2xl border border-gray-200 bg-white p-4">
                  <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Submit request</div>
                  <form onSubmit={submit} className="mt-3 space-y-3">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <label className="block">
                        <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Start date</div>
                        <input
                          type="date"
                          value={startDate}
                          onChange={(event) => setStartDate(event.target.value)}
                          className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
                          required
                        />
                      </label>
                      <label className="block">
                        <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">End date</div>
                        <input
                          type="date"
                          value={endDate}
                          onChange={(event) => setEndDate(event.target.value)}
                          className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
                          required
                        />
                      </label>
                      <label className="block">
                        <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Start time</div>
                        <input
                          type="time"
                          value={startTime}
                          onChange={(event) => setStartTime(event.target.value)}
                          className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
                          required
                        />
                      </label>
                      <label className="block">
                        <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">End time</div>
                        <input
                          type="time"
                          value={endTime}
                          onChange={(event) => setEndTime(event.target.value)}
                          className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
                          required
                        />
                      </label>
                    </div>

                    <label className="block">
                      <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Type</div>
                      <select
                        value={requestType}
                        onChange={(event) => setRequestType(event.target.value)}
                        className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
                      >
                        {TIME_OFF_TYPE_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="block">
                      <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Reason</div>
                      <input
                        value={reason}
                        onChange={(event) => setReason(event.target.value)}
                        className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
                        placeholder="Short note"
                      />
                    </label>

                    <button
                      type="submit"
                      disabled={saving}
                      className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-extrabold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {saving ? "Submitting..." : "Submit request"}
                    </button>
                  </form>
                </div>

                <div className="rounded-2xl border border-gray-200 bg-white p-4">
                  <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">My requests</div>
                  <p className="mt-1 text-sm text-gray-600">Your request history and current approval status.</p>

                  {requests.length === 0 ? (
                    <div className="mt-3 rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm text-gray-600">
                      No time-off requests submitted yet.
                    </div>
                  ) : (
                    <div className="mt-3 space-y-2">
                      {approved.length > 0 ? (
                        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                          <div className="mb-1 text-xs font-semibold text-emerald-700">Approved time off</div>
                          {approved.map((request) => (
                            <div key={request.id} className="text-sm text-emerald-800">
                              {request.typeLabel || request.type} - {fmtRange(request.startDate, request.endDate)}
                              {request.reason ? <span className="ml-1 text-emerald-700">({request.reason})</span> : null}
                            </div>
                          ))}
                        </div>
                      ) : null}

                      {pending.map((request) => (
                        <div key={request.id} className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <div className="text-sm font-extrabold text-gray-900">{request.typeLabel || request.type || "Time off"}</div>
                              <div className="mt-1 text-sm text-gray-700">{fmtRange(request.startDate, request.endDate)}</div>
                              {request.reason ? <div className="mt-1 text-xs text-gray-600">{request.reason}</div> : null}
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="rounded-full border border-amber-200 bg-white px-2 py-1 text-[11px] font-extrabold text-amber-700">
                                PENDING
                              </span>
                              <button
                                type="button"
                                onClick={() => setCancelTarget(request.id)}
                                className="rounded-lg border border-red-200 px-2 py-1 text-[11px] font-semibold text-red-600 hover:bg-red-50"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}

                      {other.map((request) => (
                        <div key={request.id} className={`rounded-xl border p-3 ${STATUS_BADGE[request.status] || STATUS_BADGE.CANCELLED}`}>
                          <div className="flex items-center justify-between gap-3">
                            <div className="text-sm font-extrabold text-gray-900">{request.typeLabel || request.type || "Time off"}</div>
                            <span className="rounded-full border border-gray-200 bg-white px-2 py-1 text-[11px] font-extrabold text-gray-700">
                              {request.status}
                            </span>
                          </div>
                          <div className="mt-1 text-sm text-gray-700">{fmtRange(request.startDate, request.endDate)}</div>
                          {request.reason ? <div className="mt-1 text-xs text-gray-600">{request.reason}</div> : null}
                          {request.reviewNotes ? <div className="mt-1 text-xs italic text-gray-500">Review: {request.reviewNotes}</div> : null}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-gray-200 bg-white p-5">
                <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Calendar view</div>
                <p className="mt-1 text-sm text-gray-600">
                  Center events plus pending and approved time-off requests appear here so you can avoid conflicts before submitting.
                </p>
                <div className="mt-3">
                  <MonthlyCalendar
                    year={calYear}
                    month={calMonth}
                    events={calEvents}
                    legendItems={CALENDAR_LEGEND}
                    onMonthChange={(nextYear, nextMonth) => {
                      setCalYear(nextYear);
                      setCalMonth(nextMonth);
                    }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      <ConfirmDialog
        open={!!cancelTarget}
        title="Cancel Request"
        message="Are you sure you want to cancel this time-off request?"
        confirmLabel="Cancel Request"
        variant="danger"
        onConfirm={() => cancelRequest(cancelTarget)}
        onCancel={() => setCancelTarget(null)}
      />
      <ConfirmDialog
        open={!!warningState}
        title="Proceed With Overage?"
        message={
          warningState?.warning
            ? `This ${String(warningState.warning.balanceType || "").toLowerCase()} request uses ${formatHours(warningState.warning.requestedHours)} hours, but only ${formatHours(warningState.warning.availableHours)} hour${Number(warningState.warning.availableHours) === 1 ? "" : "s"} are available. Submit it anyway?`
            : "This request exceeds the available time-off balance. Submit it anyway?"
        }
        confirmLabel="Submit Anyway"
        onConfirm={() => submitRequest({ overrideBalanceWarning: true })}
        onCancel={() => setWarningState(null)}
      />
    </LayoutComponent>
  );
}

function MiniSummaryCard({ label, value }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">{label}</div>
      <div className="mt-1 text-2xl font-extrabold text-gray-900">{value}</div>
    </div>
  );
}
