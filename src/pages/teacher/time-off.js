import TeacherLayout from "@/components/teacher/TeacherLayout";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import MonthlyCalendar from "@/components/calendar/MonthlyCalendar";
import { apiJson } from "@/lib/api";
import { useEffect, useState, useCallback } from "react";

function toDateInputValue(date) {
  if (!date) return "";
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "";
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function fmtDate(d) {
  return d ? new Date(d).toLocaleDateString() : "—";
}

const STATUS_BADGE = {
  PENDING: "border-amber-200 bg-amber-50 text-amber-800",
  APPROVED: "border-emerald-200 bg-emerald-50 text-emerald-800",
  DENIED: "border-red-200 bg-red-50 text-red-800",
  CANCELLED: "border-gray-200 bg-gray-50 text-gray-600",
};

export default function TeacherTimeOff() {
  const [centers, setCenters] = useState([]);
  const [centerId, setCenterId] = useState("");

  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [startDate, setStartDate] = useState(toDateInputValue(new Date()));
  const [endDate, setEndDate] = useState(toDateInputValue(new Date()));
  const [requestType, setRequestType] = useState("PTO");
  const [reason, setReason] = useState("");
  const [cancelTarget, setCancelTarget] = useState(null);

  const [calYear, setCalYear] = useState(new Date().getFullYear());
  const [calMonth, setCalMonth] = useState(new Date().getMonth());
  const [calEvents, setCalEvents] = useState([]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError("");
      try {
        const c = await apiJson("/api/v1/centers");
        const arr = Array.isArray(c) ? c : [];
        setCenters(arr);
        if (arr.length === 1) setCenterId(arr[0].id);
      } catch (e) {
        setError(e.message || "Failed to load centers");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const loadRequests = useCallback(async () => {
    if (!centerId) { setRequests([]); return; }
    try {
      const data = await apiJson(`/api/v1/time-off?centerId=${encodeURIComponent(centerId)}`);
      setRequests(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e.message || "Failed to load requests");
    }
  }, [centerId]);

  useEffect(() => { loadRequests(); }, [loadRequests]);

  const loadCalendarEvents = useCallback(async () => {
    if (!centerId) { setCalEvents([]); return; }
    try {
      const from = `${calYear}-${String(calMonth + 1).padStart(2, "0")}-01`;
      const lastDay = new Date(calYear, calMonth + 1, 0).getDate();
      const to = `${calYear}-${String(calMonth + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
      const data = await apiJson(
        `/api/v1/time-off/calendar?centerId=${encodeURIComponent(centerId)}&from=${from}&to=${to}`,
      );
      setCalEvents(Array.isArray(data) ? data : []);
    } catch {
      setCalEvents([]);
    }
  }, [centerId, calYear, calMonth]);

  useEffect(() => { loadCalendarEvents(); }, [loadCalendarEvents]);

  async function submit(e) {
    e.preventDefault();
    if (!centerId) { setError("Select a center first."); return; }
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      if (!startDate || !endDate) throw new Error("Start and end date are required.");
      const start = new Date(startDate);
      const end = new Date(endDate);
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) throw new Error("Invalid date.");
      if (end < start) throw new Error("End date cannot be before start date.");

      await apiJson("/api/v1/time-off", {
        method: "POST",
        body: JSON.stringify({
          centerId,
          type: requestType,
          startDate,
          endDate,
          reason: reason || null,
        }),
      });
      setReason("");
      setSuccess("Time off request submitted.");
      loadRequests();
      loadCalendarEvents();
    } catch (e2) {
      setError(e2.message || "Failed to submit request");
    } finally {
      setSaving(false);
    }
  }

  async function cancelRequest(id) {
    try {
      await apiJson(`/api/v1/time-off/${id}`, {
        method: "PUT",
        body: JSON.stringify({ status: "CANCELLED" }),
      });
      setCancelTarget(null);
      loadRequests();
      loadCalendarEvents();
    } catch (e) {
      setError(e.message || "Failed to cancel request");
      setCancelTarget(null);
    }
  }

  const pending = requests.filter((r) => r.status === "PENDING");
  const approved = requests.filter((r) => r.status === "APPROVED");
  const other = requests.filter((r) => r.status !== "PENDING" && r.status !== "APPROVED");

  return (
    <TeacherLayout title="Time Off Request">
      <div className="space-y-4">
        <div className="rounded-2xl border border-gray-200 bg-white p-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-extrabold text-gray-900">Time Off Request</h2>
              <p className="mt-1 text-sm text-gray-600">
                Submit PTO requests and view your time off calendar.
              </p>
            </div>

            <label className="block">
              <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Center</div>
              <select
                value={centerId}
                onChange={(e) => setCenterId(e.target.value)}
                className="mt-1 w-72 max-w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
                disabled={loading}
              >
                <option value="">Select a center…</option>
                {centers.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </label>
          </div>

          {error && (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>
          )}
          {success && (
            <div className="mt-4 rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-800">{success}</div>
          )}

          {loading ? (
            <div className="mt-4 text-sm text-gray-600">Loading…</div>
          ) : !centerId ? (
            <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
              Select a center to submit requests and view your calendar.
            </div>
          ) : (
            <div className="mt-4 space-y-4">
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {/* Submit Form */}
                <div className="rounded-2xl border border-gray-200 bg-white p-4">
                  <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Submit request</div>
                  <form onSubmit={submit} className="mt-3 space-y-3">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <label className="block">
                        <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Start date</div>
                        <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
                          className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm" required />
                      </label>
                      <label className="block">
                        <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">End date</div>
                        <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
                          className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm" required />
                      </label>
                    </div>

                    <label className="block">
                      <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Type</div>
                      <select value={requestType} onChange={(e) => setRequestType(e.target.value)}
                        className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm">
                        {["PTO", "Sick", "Unpaid", "Other"].map((t) => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </label>

                    <label className="block">
                      <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Reason (optional)</div>
                      <input value={reason} onChange={(e) => setReason(e.target.value)}
                        className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm" placeholder="Short note" />
                    </label>

                    <button type="submit" disabled={saving}
                      className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-extrabold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60">
                      {saving ? "Submitting…" : "Submit request"}
                    </button>
                  </form>
                </div>

                {/* Requests List */}
                <div className="rounded-2xl border border-gray-200 bg-white p-4">
                  <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">My requests</div>
                  <p className="mt-1 text-sm text-gray-600">Your requests and their current status.</p>

                  {requests.length === 0 ? (
                    <div className="mt-3 rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm text-gray-600">
                      No time off requests submitted yet.
                    </div>
                  ) : (
                    <div className="mt-3 space-y-2">
                      {approved.length > 0 && (
                        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                          <div className="text-xs font-semibold text-emerald-700 mb-1">Approved Time Off</div>
                          {approved.map((r) => (
                            <div key={r.id} className="text-sm text-emerald-800">
                              {r.type} &middot; {fmtDate(r.startDate)} — {fmtDate(r.endDate)}
                              {r.reason && <span className="text-emerald-600 ml-1">({r.reason})</span>}
                            </div>
                          ))}
                        </div>
                      )}

                      {pending.map((r) => (
                        <div key={r.id} className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <div className="text-sm font-extrabold text-gray-900">{r.type || "Time off"}</div>
                              <div className="mt-1 text-sm text-gray-700">{fmtDate(r.startDate)} — {fmtDate(r.endDate)}</div>
                              {r.reason && <div className="mt-1 text-xs text-gray-600">{r.reason}</div>}
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="rounded-full border border-amber-200 bg-white px-2 py-1 text-[11px] font-extrabold text-amber-700">PENDING</span>
                              <button onClick={() => setCancelTarget(r.id)}
                                className="rounded-lg border border-red-200 px-2 py-1 text-[11px] font-semibold text-red-600 hover:bg-red-50">Cancel</button>
                            </div>
                          </div>
                        </div>
                      ))}

                      {other.map((r) => (
                        <div key={r.id} className={`rounded-xl border p-3 ${STATUS_BADGE[r.status] || STATUS_BADGE.CANCELLED}`}>
                          <div className="flex items-center justify-between gap-3">
                            <div className="text-sm font-extrabold text-gray-900">{r.type || "Time off"}</div>
                            <span className="rounded-full border border-gray-200 bg-white px-2 py-1 text-[11px] font-extrabold text-gray-700">
                              {r.status}
                            </span>
                          </div>
                          <div className="mt-1 text-sm text-gray-700">{fmtDate(r.startDate)} — {fmtDate(r.endDate)}</div>
                          {r.reason && <div className="mt-1 text-xs text-gray-600">{r.reason}</div>}
                          {r.reviewNotes && <div className="mt-1 text-xs text-gray-500 italic">Review: {r.reviewNotes}</div>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Calendar View */}
              <div className="rounded-2xl border border-gray-200 bg-white p-5">
                <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Calendar view</div>
                <p className="mt-1 text-sm text-gray-600">
                  Visual overview of approved and pending time off across the center.
                </p>
                <div className="mt-3">
                  <MonthlyCalendar
                    year={calYear}
                    month={calMonth}
                    events={calEvents}
                    onMonthChange={(y, m) => { setCalYear(y); setCalMonth(m); }}
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
        message="Are you sure you want to cancel this time off request?"
        confirmLabel="Cancel Request"
        variant="danger"
        onConfirm={() => cancelRequest(cancelTarget)}
        onCancel={() => setCancelTarget(null)}
      />
    </TeacherLayout>
  );
}
