import AdminLayout from "@/components/admin/AdminLayout";
import { SkeletonTable } from "@/components/ui/Skeleton";
import { apiJson } from "@/lib/api";
import { useEffect, useState, useCallback, useMemo } from "react";

const TABS = [
  { key: "attendance", label: "Attendance", icon: "📋" },
  { key: "time-off", label: "Time Off", icon: "🏖️" },
  { key: "training", label: "Training", icon: "📚" },
  { key: "budgets", label: "Budgets", icon: "💰" },
  { key: "evaluations", label: "Evaluations", icon: "⭐" },
];

const ATT_STATUS_BADGE = {
  PRESENT: { bg: "bg-emerald-100 text-emerald-800", icon: "✓" },
  LATE: { bg: "bg-amber-100 text-amber-800", icon: "⏰" },
  ABSENT: { bg: "bg-red-100 text-red-800", icon: "✕" },
  HALF_DAY: { bg: "bg-sky-100 text-sky-800", icon: "½" },
};

const TIMEOFF_STATUS_BADGE = {
  PENDING: "bg-amber-100 text-amber-800",
  APPROVED: "bg-emerald-100 text-emerald-800",
  DENIED: "bg-red-100 text-red-800",
  CANCELLED: "bg-gray-100 text-gray-600",
};

const EVAL_STATUS_BADGE = {
  DRAFT: "bg-gray-100 text-gray-600",
  SUBMITTED: "bg-sky-100 text-sky-800",
  ACKNOWLEDGED: "bg-emerald-100 text-emerald-800",
};

const EVAL_CATEGORIES = [
  "Classroom Management",
  "Communication",
  "Curriculum Delivery",
  "Child Engagement",
  "Professionalism",
];

const TRAINING_CATEGORIES = ["Orientation", "Safety", "Curriculum", "Professional Development", "Other"];
const EXPENSE_CATEGORIES = ["Supplies", "Materials", "Equipment", "Food", "Other"];
const ATTENDANCE_INITIAL_FORM = {
  userId: "",
  status: "PRESENT",
  clockIn: "",
  clockOut: "",
  lateMinutes: 0,
  notes: "",
};
function createTrainingForm() {
  return {
    userIds: [],
    topic: "",
    description: "",
    hours: "",
    date: today(),
    category: "Other",
    performedBy: "",
  };
}

function today() { return new Date().toISOString().split("T")[0]; }
function currentMonth() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; }
function addDays(dateString, days) {
  const d = dateString ? new Date(dateString) : new Date();
  if (Number.isNaN(d.getTime())) return today();
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}
function fmtDate(d) { return d ? new Date(d).toLocaleDateString() : ""; }
function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
function formatEvaluationPeriod(ev) {
  if (ev?.periodStart || ev?.periodEnd) {
    return `${fmtDate(ev.periodStart) || "Open"} - ${fmtDate(ev.periodEnd) || "Open"}`;
  }
  return ev?.period || "";
}
function fmtDateTime(d) { return d ? new Date(d).toLocaleString() : "—"; }
function fmtTimeOffRange(start, end) {
  if (!start || !end) return "—";
  const startDate = new Date(start);
  const endDate = new Date(end);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return "—";

  const sameDay =
    startDate.getFullYear() === endDate.getFullYear() &&
    startDate.getMonth() === endDate.getMonth() &&
    startDate.getDate() === endDate.getDate();

  if (sameDay) {
    return `${startDate.toLocaleDateString()} · ${startDate.toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    })} - ${endDate.toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    })}`;
  }

  return `${fmtDateTime(start)} — ${fmtDateTime(end)}`;
}

export default function StaffManagement() {
  const [activeTab, setActiveTab] = useState("attendance");
  const [centers, setCenters] = useState([]);
  const [centerId, setCenterId] = useState("");
  const [classes, setClasses] = useState([]);
  const [staffUsers, setStaffUsers] = useState([]);
  const [evaluationTeachers, setEvaluationTeachers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const c = await apiJson("/api/v1/centers");
        const arr = Array.isArray(c) ? c : [];
        setCenters(arr);
        if (arr.length === 1) setCenterId(arr[0].id);
      } catch {} finally { setLoading(false); }
    })();
  }, []);

  useEffect(() => {
    if (!centerId) { setClasses([]); setStaffUsers([]); setEvaluationTeachers([]); return; }
    (async () => {
      try {
        const [cls, staff, teachers] = await Promise.all([
          apiJson(`/api/v1/classes?centerId=${centerId}`).catch(() => []),
          apiJson(`/api/v1/users?centerId=${centerId}&staffOnly=true`).catch(() => []),
          apiJson(`/api/v1/users?centerId=${centerId}&role=TEACHER`).catch(() => []),
        ]);
        setClasses(Array.isArray(cls) ? cls : []);
        setStaffUsers(Array.isArray(staff) ? staff : []);
        setEvaluationTeachers(Array.isArray(teachers) ? teachers : []);
      } catch {}
    })();
  }, [centerId]);

  const selectedCenter = centers.find((c) => c.id === centerId);

  return (
    <AdminLayout title="Staff Management">
      <div className="space-y-6">
        {/* Page Header */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="flex items-center gap-2 text-xl font-extrabold text-gray-900">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-lg">👥</span>
                Staff Management
              </h2>
              <p className="mt-1.5 text-sm text-gray-500">
                Track attendance, manage time-off requests, log training hours, oversee budgets, and conduct evaluations.
              </p>
            </div>
            {/* Center Selector */}
            <div className="min-w-[220px]">
              <div className="mb-1.5 text-xs font-bold uppercase tracking-wider text-gray-400">Center</div>
              <select
                value={centerId}
                onChange={(e) => setCenterId(e.target.value)}
                disabled={loading}
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm font-semibold text-gray-900 focus:border-blue-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100"
              >
                <option value="">Select a center…</option>
                {centers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>

          {/* Center info pill */}
          {selectedCenter && (
            <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-800">
              <span className="h-2 w-2 rounded-full bg-blue-500" />
              {selectedCenter.name} — {staffUsers.length} staff, {classes.length} classroom{classes.length !== 1 ? "s" : ""}
            </div>
          )}

          {/* Tabs */}
          <div className="mt-5 flex gap-1.5 overflow-x-auto rounded-xl bg-gray-100 p-1.5">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={[
                  "flex items-center gap-1.5 whitespace-nowrap rounded-lg px-4 py-2.5 text-sm font-semibold transition",
                  activeTab === tab.key
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-500 hover:text-gray-700",
                ].join(" ")}
              >
                <span className="text-base">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {!centerId ? (
          <EmptyCard icon="🏫" title="No center selected" msg="Select a center above to manage staff." />
        ) : (
          <>
            {activeTab === "attendance" && <AttendanceTab centerId={centerId} teachers={staffUsers} />}
            {activeTab === "time-off" && <TimeOffTab centerId={centerId} teachers={staffUsers} />}
            {activeTab === "training" && <TrainingManagementTab centerId={centerId} teachers={staffUsers} />}
            {activeTab === "budgets" && <BudgetsTab centerId={centerId} classes={classes} />}
            {activeTab === "evaluations" && <EvaluationsTab centerId={centerId} teachers={evaluationTeachers} />}
          </>
        )}
      </div>
    </AdminLayout>
  );
}

// ─── Attendance Tab ──────────────────────────────────────────

function AttendanceTab({ centerId, teachers }) {
  const [date, setDate] = useState(today());
  const [records, setRecords] = useState([]);
  const [summary, setSummary] = useState(null);
  const [summaryUserId, setSummaryUserId] = useState("");
  const [summaryFrom, setSummaryFrom] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  });
  const [summaryTo, setSummaryTo] = useState(today());
  const [summaryRecords, setSummaryRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(ATTENDANCE_INITIAL_FORM);
  const [saving, setSaving] = useState(false);

  const loadRecords = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiJson(`/api/v1/staff-attendance?centerId=${centerId}&from=${date}&to=${date}`);
      setRecords(Array.isArray(data) ? data : []);
    } catch {} finally { setLoading(false); }
  }, [centerId, date]);

  useEffect(() => { loadRecords(); }, [loadRecords]);

  const loadSummary = useCallback(async () => {
    if (!summaryUserId) { setSummary(null); setSummaryRecords([]); return; }
    try {
      const qs = new URLSearchParams({
        centerId,
        userId: summaryUserId,
        from: summaryFrom,
        to: summaryTo,
      });
      const [summaryData, reportRecords] = await Promise.all([
        apiJson(`/api/v1/staff-attendance/summary?${qs.toString()}`),
        apiJson(`/api/v1/staff-attendance?${qs.toString()}`),
      ]);
      setSummary(summaryData);
      setSummaryRecords(Array.isArray(reportRecords) ? reportRecords : []);
    } catch {}
  }, [centerId, summaryFrom, summaryTo, summaryUserId]);

  useEffect(() => { loadSummary(); }, [loadSummary]);

  const closeForm = useCallback(() => {
    setShowForm(false);
    setForm(ATTENDANCE_INITIAL_FORM);
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.userId) return;
    setSaving(true);
    try {
      await apiJson("/api/v1/staff-attendance", {
        method: "POST",
        body: JSON.stringify({
          centerId, userId: form.userId, date,
          status: form.status,
          clockIn: form.clockIn || null,
          clockOut: form.clockOut || null,
          lateMinutes: parseInt(form.lateMinutes) || 0,
          notes: form.notes || null,
        }),
      });
      closeForm();
      loadRecords();
    } catch {} finally { setSaving(false); }
  };

  // Quick stats from today's records
  const todayStats = {
    present: records.filter((r) => r.status === "PRESENT").length,
    late: records.filter((r) => r.status === "LATE").length,
    absent: records.filter((r) => r.status === "ABSENT").length,
    halfDay: records.filter((r) => r.status === "HALF_DAY").length,
  };

  return (
    <div className="space-y-4">
      {/* Today's Quick Stats */}
      {!loading && records.length > 0 && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <MiniStat icon="✓" label="Present" value={todayStats.present} colorClass="text-emerald-700 bg-emerald-50 border-emerald-200" />
          <MiniStat icon="⏰" label="Late" value={todayStats.late} colorClass="text-amber-700 bg-amber-50 border-amber-200" />
          <MiniStat icon="✕" label="Absent" value={todayStats.absent} colorClass="text-red-700 bg-red-50 border-red-200" />
          <MiniStat icon="½" label="Half Day" value={todayStats.halfDay} colorClass="text-sky-700 bg-sky-50 border-sky-200" />
        </div>
      )}

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <FilterInput label="Date" type="date" value={date} onChange={setDate} />
          </div>
          <PrimaryButton onClick={() => setShowForm(true)}>
            + Record Attendance
          </PrimaryButton>
        </div>

        {loading ? <Loading /> : records.length === 0 ? (
          <div className="mt-6 py-8 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-xl">📋</div>
            <p className="mt-3 text-sm font-semibold text-gray-600">No attendance records for this date.</p>
            <p className="mt-1 text-xs text-gray-400">Record attendance using the button above.</p>
          </div>
        ) : (
          <div className="mt-4 space-y-2">
            {records.map((r) => {
              const badge = ATT_STATUS_BADGE[r.status] || ATT_STATUS_BADGE.PRESENT;
              return (
                <div key={r.id} className="flex flex-wrap items-center gap-4 rounded-xl border border-gray-100 bg-gray-50/50 px-4 py-3 transition hover:border-gray-200 hover:bg-white">
                  {/* Avatar */}
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-800 to-sky-600 text-xs font-bold text-white">
                    {getInitials(r.user?.name)}
                  </div>
                  {/* Name */}
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-bold text-gray-900">{r.user?.name || "—"}</div>
                    <div className="text-xs text-gray-500">
                      {r.clockIn ? new Date(r.clockIn).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}
                      {" → "}
                      {r.clockOut ? new Date(r.clockOut).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}
                    </div>
                  </div>
                  {/* Status */}
                  <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${badge.bg}`}>
                    <span>{badge.icon}</span>
                    {(r.status || "").replace(/_/g, " ")}
                  </span>
                  {/* Late + Notes */}
                  {r.lateMinutes > 0 && (
                    <span className="text-xs font-semibold text-amber-600">{r.lateMinutes}m late</span>
                  )}
                  {r.notes && (
                    <span className="max-w-[200px] truncate text-xs text-gray-400" title={r.notes}>{r.notes}</span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Monthly Summary */}
      <Card>
        <SectionTitle icon="📊" title="Monthly Summary" />
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
          <FilterSelect label="Employee" value={summaryUserId} onChange={setSummaryUserId}>
            <option value="">Select employee…</option>
            {teachers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </FilterSelect>
          <FilterInput label="From" type="date" value={summaryFrom} onChange={setSummaryFrom} />
          <FilterInput label="To" type="date" value={summaryTo} onChange={setSummaryTo} />
        </div>
        {summary && (
          <div className="mt-4 space-y-4">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
              <KpiCard label="Total Days" value={summary.totalDays} color="gray" />
            <KpiCard label="Present" value={summary.present} color="emerald" />
            <KpiCard label="Late" value={summary.late} color="amber" />
            <KpiCard label="Absent" value={summary.absent} color="red" />
            <KpiCard label="Late Minutes" value={summary.totalLateMinutes} color="amber" />
            </div>

            <div className="overflow-x-auto rounded-xl border border-gray-100">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50/80 text-left text-xs font-bold uppercase tracking-wider text-gray-400">
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Clock In</th>
                    <th className="px-4 py-3">Clock Out</th>
                    <th className="px-4 py-3">Late Minutes</th>
                  </tr>
                </thead>
                <tbody>
                  {summaryRecords.length ? summaryRecords.map((record) => (
                    <tr key={record.id} className="border-b border-gray-50">
                      <td className="px-4 py-3 text-gray-700">{fmtDate(record.date)}</td>
                      <td className="px-4 py-3 font-semibold text-gray-900">{String(record.status || "").replace(/_/g, " ")}</td>
                      <td className="px-4 py-3 text-gray-700">{record.clockIn ? new Date(record.clockIn).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}</td>
                      <td className="px-4 py-3 text-gray-700">{record.clockOut ? new Date(record.clockOut).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}</td>
                      <td className="px-4 py-3 text-gray-700">{record.lateMinutes || 0}</td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={5} className="px-4 py-6 text-center text-sm text-gray-500">No attendance records in this range.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Card>
      {showForm && (
        <ModalShell
          title="Record Attendance"
          subtitle={`Create an attendance entry for ${fmtDate(date)}.`}
          onClose={closeForm}
        >
          <form onSubmit={handleSave} className="space-y-5">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <FilterSelect label="Employee" value={form.userId} onChange={(v) => setForm({ ...form, userId: v })}>
                <option value="">Select employee…</option>
                {teachers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </FilterSelect>
              <FilterSelect label="Status" value={form.status} onChange={(v) => setForm({ ...form, status: v })}>
                <option value="PRESENT">Present</option>
                <option value="LATE">Late</option>
                <option value="ABSENT">Absent</option>
                <option value="HALF_DAY">Half Day</option>
              </FilterSelect>
              <FilterInput label="Clock In" type="time" value={form.clockIn} onChange={(v) => setForm({ ...form, clockIn: v })} />
              <FilterInput label="Clock Out" type="time" value={form.clockOut} onChange={(v) => setForm({ ...form, clockOut: v })} />
              <FilterInput label="Late Minutes" type="number" value={form.lateMinutes} onChange={(v) => setForm({ ...form, lateMinutes: v })} />
              <FilterInput label="Notes" type="text" value={form.notes} onChange={(v) => setForm({ ...form, notes: v })} />
            </div>
            <div className="flex flex-wrap justify-end gap-3 border-t border-gray-100 pt-4">
              <button
                type="button"
                onClick={closeForm}
                className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-600 transition hover:bg-gray-50"
              >
                Cancel
              </button>
              <SaveButton saving={saving} />
            </div>
          </form>
        </ModalShell>
      )}
    </div>
  );
}

// ─── Time Off Tab ────────────────────────────────────────────

function TimeOffTab({ centerId, teachers }) {
  const [requests, setRequests] = useState([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(false);

  const loadRequests = useCallback(async () => {
    setLoading(true);
    try {
      const qs = `centerId=${centerId}${statusFilter ? `&status=${statusFilter}` : ""}`;
      const data = await apiJson(`/api/v1/time-off?${qs}`);
      setRequests(Array.isArray(data) ? data : []);
    } catch {} finally { setLoading(false); }
  }, [centerId, statusFilter]);

  useEffect(() => { loadRequests(); }, [loadRequests]);

  const handleAction = async (id, status) => {
    try {
      await apiJson(`/api/v1/time-off/${id}`, { method: "PUT", body: JSON.stringify({ status }) });
      loadRequests();
    } catch {}
  };

  const pending = requests.filter((r) => r.status === "PENDING");
  const rest = requests.filter((r) => r.status !== "PENDING");

  return (
    <div className="space-y-4">
      {/* Pending Requests */}
      {pending.length > 0 && (
        <div className="rounded-2xl border-2 border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50/30 p-6">
          <div className="flex items-center gap-2 text-sm font-extrabold text-amber-800">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-200/60 text-sm">🔔</span>
            Pending Requests
            <span className="ml-1 rounded-full bg-amber-200 px-2 py-0.5 text-xs font-bold text-amber-900">{pending.length}</span>
          </div>
          <div className="mt-4 space-y-3">
            {pending.map((r) => (
              <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-white p-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-800 to-sky-600 text-xs font-bold text-white">
                    {getInitials(r.user?.name)}
                  </div>
                  <div>
                    <div className="text-sm font-bold text-gray-900">{r.user?.name}</div>
                    <div className="text-xs text-gray-500">
                      <span className="font-semibold text-gray-700">{r.type}</span>
                      {" · "}
                      {fmtTimeOffRange(r.startDate, r.endDate)}
                      {r.reason && <span className="ml-2 text-gray-400">({r.reason})</span>}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handleAction(r.id, "APPROVED")} className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 transition">
                    ✓ Approve
                  </button>
                  <button onClick={() => handleAction(r.id, "DENIED")} className="rounded-lg bg-red-500 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-red-600 transition">
                    ✕ Deny
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* All Requests */}
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SectionTitle icon="📑" title="All Requests" />
          <FilterSelect label="Status" value={statusFilter} onChange={setStatusFilter}>
            <option value="">All</option>
            <option value="PENDING">Pending</option>
            <option value="APPROVED">Approved</option>
            <option value="DENIED">Denied</option>
            <option value="CANCELLED">Cancelled</option>
          </FilterSelect>
        </div>
        {loading ? <Loading /> : rest.length === 0 && pending.length === 0 ? (
          <div className="mt-6 py-8 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-xl">🏖️</div>
            <p className="mt-3 text-sm font-semibold text-gray-600">No time-off requests.</p>
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-xl border border-gray-100">
            <table className="min-w-full text-sm">
              <thead><tr className="border-b border-gray-200 bg-gray-50/80 text-left text-xs font-bold uppercase tracking-wider text-gray-400">
                <th className="px-4 py-3">Employee</th><th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Dates / Times</th><th className="px-4 py-3">Reason</th>
                <th className="px-4 py-3">Status</th><th className="px-4 py-3">Reviewed By</th>
              </tr></thead>
              <tbody>
                {(statusFilter ? requests : rest).map((r) => (
                  <tr key={r.id} className="border-b border-gray-50 transition hover:bg-blue-50/30">
                    <td className="px-4 py-3 font-semibold text-gray-900">{r.user?.name || "—"}</td>
                    <td className="px-4 py-3">{r.type}</td>
                    <td className="px-4 py-3 text-gray-600">{fmtTimeOffRange(r.startDate, r.endDate)}</td>
                    <td className="px-4 py-3 text-gray-500">{r.reason || ""}</td>
                    <td className="px-4 py-3"><Badge map={TIMEOFF_STATUS_BADGE} value={r.status} /></td>
                    <td className="px-4 py-3 text-gray-500">{r.reviewedBy?.name || ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

// ─── Training Tab ────────────────────────────────────────────

function TrainingTab({ centerId, teachers }) {
  const [logs, setLogs] = useState([]);
  const [summary, setSummary] = useState(null);
  const [userId, setUserId] = useState("");
  const [reportFrom, setReportFrom] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  });
  const [reportTo, setReportTo] = useState(today());
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ userIds: [], topic: "", description: "", hours: "", date: today(), category: "Other", performedBy: "" });
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({
        centerId,
        ...(userId ? { userId } : {}),
        ...(reportFrom ? { from: reportFrom } : {}),
        ...(reportTo ? { to: reportTo } : {}),
      });
      const [logsData, summaryData] = await Promise.all([
        apiJson(`/api/v1/training-logs?${qs.toString()}`),
        apiJson(`/api/v1/training-logs/summary?${qs.toString()}`),
      ]);
      setLogs(Array.isArray(logsData) ? logsData : []);
      setSummary(summaryData);
    } catch {} finally { setLoading(false); }
  }, [centerId, reportFrom, reportTo, userId]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.topic || !form.hours || !form.userIds.length) return;
    setSaving(true);
    try {
      await apiJson("/api/v1/training-logs", {
        method: "POST",
        body: JSON.stringify({
          centerId,
          userIds: form.userIds,
          topic: form.topic,
          description: form.description || null,
          hours: parseFloat(form.hours),
          date: form.date,
          category: form.category,
          performedBy: form.performedBy || null,
        }),
      });
      setShowForm(false);
      setForm({ userIds: [], topic: "", description: "", hours: "", date: today(), category: "Other", performedBy: "" });
      loadData();
    } catch {} finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!confirm("Delete this training log entry?")) return;
    try {
      await apiJson(`/api/v1/training-logs/${id}`, { method: "DELETE" });
      loadData();
    } catch {}
  };

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <FilterSelect label="Employee" value={userId} onChange={setUserId}>
              <option value="">All employees</option>
              {teachers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </FilterSelect>
            <FilterInput label="From" type="date" value={reportFrom} onChange={setReportFrom} />
            <FilterInput label="To" type="date" value={reportTo} onChange={setReportTo} />
          </div>
          <PrimaryButton onClick={() => setShowForm(!showForm)}>
            {showForm ? "Cancel" : "+ Log Training"}
          </PrimaryButton>
        </div>

        {false && (<><div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
          <FilterSelect label="Teacher" value={filterTeacherId} onChange={setFilterTeacherId}>
            <option value="">All teachers</option>
            {teachers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </FilterSelect>
          <FilterInput label="From" type="date" value={filterFrom} onChange={setFilterFrom} />
          <FilterInput label="To" type="date" value={filterTo} onChange={setFilterTo} />
        </div>

        {evaluations.length > 0 && (
          <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3">
            <KpiCard label="Evaluations" value={evaluationSummary.total} color="gray" />
            <KpiCard label="Submitted" value={evaluationSummary.submitted} color="sky" />
            <KpiCard label="Average Score" value={evaluationSummary.scored ? Math.round(evaluationSummary.scoreTotal / evaluationSummary.scored) : "â€”"} color="emerald" />
          </div>
        )}</>)}

        {showForm && (
          <form onSubmit={handleSave} className="mt-4 space-y-4 rounded-xl border border-blue-100 bg-blue-50/30 p-5">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
              <FilterInput label="Performed By" type="text" value={form.performedBy} onChange={(v) => setForm({ ...form, performedBy: v })} />
              <FilterInput label="Topic" type="text" value={form.topic} onChange={(v) => setForm({ ...form, topic: v })} />
              <FilterInput label="Hours" type="number" value={form.hours} onChange={(v) => setForm({ ...form, hours: v })} />
              <FilterInput label="Date" type="date" value={form.date} onChange={(v) => setForm({ ...form, date: v })} />
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <FilterSelect label="Category" value={form.category} onChange={(v) => setForm({ ...form, category: v })}>
                {TRAINING_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </FilterSelect>
              <FilterInput label="Description" type="text" value={form.description} onChange={(v) => setForm({ ...form, description: v })} />
            </div>

            <div>
              <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-gray-400">Apply To Employees</div>
              <div className="grid grid-cols-1 gap-2 rounded-xl border border-blue-100 bg-white p-4 md:grid-cols-2">
                {teachers.map((teacher) => {
                  const selected = form.userIds.includes(teacher.id);
                  return (
                    <label key={teacher.id} className={`flex items-center gap-3 rounded-lg border px-3 py-2 text-sm ${selected ? "border-blue-200 bg-blue-50 text-blue-900" : "border-gray-200 bg-white text-gray-700"}`}>
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => setForm((current) => ({
                          ...current,
                          userIds: selected
                            ? current.userIds.filter((id) => id !== teacher.id)
                            : [...current.userIds, teacher.id],
                        }))}
                      />
                      <span className="font-semibold">{teacher.name}</span>
                    </label>
                  );
                })}
              </div>
            </div>
            <div className="flex items-end">
              <SaveButton saving={saving} />
            </div>
          </form>
        )}

        {/* Summary cards */}
        {summary && (
          <div className="mt-4 space-y-4">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <KpiCard label="Total Hours" value={summary.totalHours} color="sky" />
              <KpiCard label="Entries" value={summary.totalEntries || 0} color="gray" />
              {Object.entries(summary.byCategory || {}).map(([cat, hrs]) => (
                <KpiCard key={cat} label={cat} value={hrs} color="blue" />
              ))}
            </div>

            <div className="overflow-x-auto rounded-xl border border-gray-100">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50/80 text-left text-xs font-bold uppercase tracking-wider text-gray-400">
                    <th className="px-4 py-3">Employee</th>
                    <th className="px-4 py-3">Entries</th>
                    <th className="px-4 py-3">Hours</th>
                    <th className="px-4 py-3">Last Completed</th>
                  </tr>
                </thead>
                <tbody>
                  {(summary.reportByUser || []).length ? summary.reportByUser.map((reportRow) => (
                    <tr key={reportRow.userId || reportRow.name} className="border-b border-gray-50">
                      <td className="px-4 py-3 font-semibold text-gray-900">{reportRow.name || "Unknown employee"}</td>
                      <td className="px-4 py-3 text-gray-700">{reportRow.entries}</td>
                      <td className="px-4 py-3 text-gray-700">{reportRow.totalHours}</td>
                      <td className="px-4 py-3 text-gray-700">{reportRow.lastCompletedAt ? fmtDate(reportRow.lastCompletedAt) : "—"}</td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={4} className="px-4 py-6 text-center text-sm text-gray-500">No employee training records in this range.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {loading ? <Loading /> : logs.length === 0 ? (
          <div className="mt-6 py-8 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-xl">📚</div>
            <p className="mt-3 text-sm font-semibold text-gray-600">No training logs found.</p>
          </div>
        ) : (
          <div className="mt-4 space-y-2">
            {logs.map((l) => (
              <div key={l.id} className="flex flex-wrap items-center gap-4 rounded-xl border border-gray-100 bg-gray-50/50 px-4 py-3 transition hover:border-gray-200 hover:bg-white">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-800 to-sky-600 text-xs font-bold text-white">
                  {getInitials(l.user?.name)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-bold text-gray-900">{l.topic}</div>
                  <div className="text-xs text-gray-500">
                    {l.user?.name || "—"} · {fmtDate(l.date)}{l.performedBy ? ` · Performed by ${l.performedBy}` : ""}
                  </div>
                </div>
                <span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-bold text-blue-800">{l.category}</span>
                <span className="text-sm font-extrabold text-sky-700">{l.hours}h</span>
                <button onClick={() => handleDelete(l.id)} className="rounded-lg border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-600 hover:bg-red-100 transition">
                  Delete
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

// ─── Budgets Tab ─────────────────────────────────────────────

function TrainingManagementTab({ centerId, teachers }) {
  const [logs, setLogs] = useState([]);
  const [summary, setSummary] = useState(null);
  const [userId, setUserId] = useState("");
  const [reportFrom, setReportFrom] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  });
  const [reportTo, setReportTo] = useState(today());
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(() => createTrainingForm());
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({
        centerId,
        ...(userId ? { userId } : {}),
        ...(reportFrom ? { from: reportFrom } : {}),
        ...(reportTo ? { to: reportTo } : {}),
      });
      const [logsData, summaryData] = await Promise.all([
        apiJson(`/api/v1/training-logs?${qs.toString()}`),
        apiJson(`/api/v1/training-logs/summary?${qs.toString()}`),
      ]);
      setLogs(Array.isArray(logsData) ? logsData : []);
      setSummary(summaryData);
    } catch {} finally { setLoading(false); }
  }, [centerId, reportFrom, reportTo, userId]);

  useEffect(() => { loadData(); }, [loadData]);

  const visibleTeachers = useMemo(() => {
    const query = employeeSearch.trim().toLowerCase();
    if (!query) return teachers;
    return teachers.filter((teacher) =>
      [
        teacher?.name || "",
        teacher?.email || "",
        teacher?.role || "",
      ].join(" ").toLowerCase().includes(query),
    );
  }, [employeeSearch, teachers]);

  const visibleTeacherIds = useMemo(
    () => visibleTeachers.map((teacher) => teacher.id),
    [visibleTeachers],
  );

  const selectedTeachers = useMemo(
    () => teachers.filter((teacher) => form.userIds.includes(teacher.id)),
    [teachers, form.userIds],
  );

  const facilitatorSuggestions = useMemo(
    () => [...new Set(teachers.map((teacher) => (teacher?.name || "").trim()).filter(Boolean))],
    [teachers],
  );

  const topTrainingCategories = useMemo(
    () => Object.entries(summary?.byCategory || {})
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3),
    [summary],
  );
  const reportRows = summary?.reportByUser || [];
  const reportRangeLabel = [reportFrom ? fmtDate(reportFrom) : null, reportTo ? fmtDate(reportTo) : null]
    .filter(Boolean)
    .join(" - ") || "All recorded dates";

  const selectedVisibleCount = visibleTeacherIds.filter((id) => form.userIds.includes(id)).length;
  const allVisibleSelected = visibleTeacherIds.length > 0 && selectedVisibleCount === visibleTeacherIds.length;

  const updateForm = (patch) => {
    setForm((current) => ({ ...current, ...patch }));
  };

  const toggleTeacher = (teacherId) => {
    setForm((current) => {
      const selected = current.userIds.includes(teacherId);
      return {
        ...current,
        userIds: selected
          ? current.userIds.filter((id) => id !== teacherId)
          : [...current.userIds, teacherId],
      };
    });
  };

  const addTeacherIds = (teacherIds) => {
    setForm((current) => ({
      ...current,
      userIds: [...new Set([...current.userIds, ...teacherIds])],
    }));
  };

  const removeTeacherIds = (teacherIds) => {
    const idsToRemove = new Set(teacherIds);
    setForm((current) => ({
      ...current,
      userIds: current.userIds.filter((id) => !idsToRemove.has(id)),
    }));
  };

  const clearSelection = () => {
    setForm((current) => ({ ...current, userIds: [] }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    const topic = form.topic.trim();
    const description = form.description.trim();
    const performedBy = form.performedBy.trim();
    if (!topic || !form.hours || !form.userIds.length) return;
    setSaving(true);
    try {
      await apiJson("/api/v1/training-logs", {
        method: "POST",
        body: JSON.stringify({
          centerId,
          userIds: form.userIds,
          topic,
          description: description || null,
          hours: parseFloat(form.hours),
          date: form.date,
          category: form.category,
          performedBy: performedBy || null,
        }),
      });
      setShowForm(false);
      setForm(createTrainingForm());
      setEmployeeSearch("");
      loadData();
    } catch {} finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!confirm("Delete this training log entry?")) return;
    try {
      await apiJson(`/api/v1/training-logs/${id}`, { method: "DELETE" });
      loadData();
    } catch {}
  };

  const handleExportReport = () => {
    if (!reportRows.length || typeof document === "undefined" || typeof window === "undefined") return;
    const escapeCell = (value) => `"${String(value ?? "").replace(/"/g, "\"\"")}"`;
    const csv = [
      [
        "Employee",
        "Entries",
        "Total Hours Completed",
        "Average Hours Per Entry",
        "Last Completed",
        "Report From",
        "Report To",
      ].join(","),
      ...reportRows.map((row) => [
        escapeCell(row.name || "Unknown employee"),
        row.entries ?? 0,
        row.totalHours ?? 0,
        row.entries ? Math.round(((row.totalHours || 0) / row.entries) * 100) / 100 : 0,
        escapeCell(row.lastCompletedAt ? fmtDate(row.lastCompletedAt) : "-"),
        escapeCell(reportFrom || ""),
        escapeCell(reportTo || ""),
      ].join(",")),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `training-report-${reportFrom || "start"}-${reportTo || "end"}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <SectionTitle icon="📚" title="Training Records" />
            <p className="mt-1.5 text-sm text-gray-500">
              Log one training session, record who facilitated it, and apply it to the employees who attended.
            </p>
          </div>
          <PrimaryButton onClick={() => {
            if (showForm) setEmployeeSearch("");
            setShowForm((current) => !current);
          }}>
            {showForm ? "Close Composer" : "+ New Training Session"}
          </PrimaryButton>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1fr)_280px] xl:items-end">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <FilterSelect label="Employee" value={userId} onChange={setUserId}>
              <option value="">All employees</option>
              {teachers.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.name || teacher.email}</option>)}
            </FilterSelect>
            <FilterInput label="From" type="date" value={reportFrom} onChange={setReportFrom} />
            <FilterInput label="To" type="date" value={reportTo} onChange={setReportTo} />
          </div>
          <div className="rounded-2xl border border-sky-100 bg-sky-50/80 px-4 py-3">
            <div className="text-sm font-extrabold text-sky-900">{logs.length} training record{logs.length === 1 ? "" : "s"} in view</div>
            <p className="mt-1 text-xs text-sky-700">
              Narrow the list by employee or date range when you need to audit specific staff training history.
            </p>
          </div>
        </div>

        {showForm && (
          <form onSubmit={handleSave} className="mt-6 overflow-hidden rounded-[28px] border border-sky-100 bg-gradient-to-br from-sky-50 via-white to-blue-50 shadow-sm">
            <div className="border-b border-sky-100 bg-gradient-to-r from-sky-100/80 to-white px-5 py-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="text-lg font-black tracking-tight text-gray-900">Bulk Training Composer</div>
                  <p className="mt-1 text-sm text-gray-600">
                    Capture the training once, then select the exact employees who attended so you do not have to log duplicate entries manually.
                  </p>
                </div>
                <div className="grid min-w-[240px] grid-cols-2 gap-3">
                  <MiniStat icon="👥" label="Selected Staff" value={selectedTeachers.length} colorClass="border-blue-200 bg-white text-blue-900" />
                  <MiniStat icon="⏱" label="Hours Each" value={form.hours ? `${form.hours}h` : "--"} colorClass="border-sky-200 bg-white text-sky-900" />
                </div>
              </div>
            </div>

            <div className="grid gap-6 p-5 xl:grid-cols-[minmax(0,1fr)_340px]">
              <div className="space-y-5">
                <div className="rounded-2xl border border-white bg-white p-5 shadow-sm">
                  <div className="text-sm font-extrabold text-gray-900">Session Details</div>
                  <p className="mt-1 text-sm text-gray-500">
                    Record the training topic, category, trainer, and any notes staff may need to reference later.
                  </p>

                  <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <FilterInput label="Topic" type="text" value={form.topic} onChange={(value) => updateForm({ topic: value })} />
                    <FilterSelect label="Category" value={form.category} onChange={(value) => updateForm({ category: value })}>
                      {TRAINING_CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}
                    </FilterSelect>
                    <label className="block">
                      <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">Hours</div>
                      <input
                        type="number"
                        min="0.25"
                        step="0.25"
                        value={form.hours}
                        onChange={(e) => updateForm({ hours: e.target.value })}
                        className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm font-medium text-gray-900 focus:border-blue-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100"
                      />
                    </label>
                    <FilterInput label="Date" type="date" value={form.date} onChange={(value) => updateForm({ date: value })} />
                  </div>

                  <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                    <label className="block">
                      <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">Trainer / Facilitator</div>
                      <input
                        type="text"
                        list="training-facilitator-options"
                        value={form.performedBy}
                        onChange={(e) => updateForm({ performedBy: e.target.value })}
                        placeholder="Use a staff member or outside provider"
                        className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm font-medium text-gray-900 focus:border-blue-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100"
                      />
                      <datalist id="training-facilitator-options">
                        {facilitatorSuggestions.map((name) => <option key={name} value={name} />)}
                      </datalist>
                      <p className="mt-1 text-xs text-gray-500">Enter who performed the training, even if it was an external organization.</p>
                    </label>
                    <TextArea label="Description / Notes" value={form.description} onChange={(value) => updateForm({ description: value })} />
                  </div>
                </div>

                <div className="rounded-2xl border border-white bg-white p-5 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-extrabold text-gray-900">Attendees</div>
                      <p className="mt-1 text-sm text-gray-500">
                        Search the employee list, then click the staff members who attended this training session.
                      </p>
                    </div>
                    <div className="rounded-2xl border border-sky-100 bg-sky-50 px-4 py-3 text-right">
                      <div className="text-lg font-extrabold text-sky-900">{selectedVisibleCount}/{visibleTeacherIds.length || 0}</div>
                      <div className="text-[10px] font-bold uppercase tracking-wider text-sky-700">Visible Selected</div>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
                    <label className="block">
                      <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">Search Employees</div>
                      <input
                        type="text"
                        value={employeeSearch}
                        onChange={(e) => setEmployeeSearch(e.target.value)}
                        placeholder="Search by name, email, or role"
                        className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm font-medium text-gray-900 focus:border-blue-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100"
                      />
                    </label>

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          if (!visibleTeacherIds.length) return;
                          if (allVisibleSelected) removeTeacherIds(visibleTeacherIds);
                          else addTeacherIds(visibleTeacherIds);
                        }}
                        className="rounded-xl border border-blue-200 bg-white px-3 py-2 text-xs font-bold text-blue-700 transition hover:bg-blue-50"
                      >
                        {allVisibleSelected ? "Remove Visible" : "Select Visible"}
                      </button>
                      <button
                        type="button"
                        onClick={() => addTeacherIds(teachers.map((teacher) => teacher.id))}
                        className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-gray-700 transition hover:bg-gray-50"
                      >
                        Select All Staff
                      </button>
                      <button
                        type="button"
                        onClick={clearSelection}
                        className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-gray-500 transition hover:bg-gray-50"
                      >
                        Clear
                      </button>
                    </div>
                  </div>

                  {selectedTeachers.length > 0 ? (
                    <div className="mt-4">
                      <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-gray-400">Selected Employees</div>
                      <div className="flex flex-wrap gap-2">
                        {selectedTeachers.map((teacher) => (
                          <button
                            key={teacher.id}
                            type="button"
                            onClick={() => removeTeacherIds([teacher.id])}
                            className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-800 transition hover:bg-blue-100"
                          >
                            <span>{teacher.name || teacher.email}</span>
                            <span className="text-blue-500">x</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="mt-4 rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-500">
                      No employees selected yet. Choose at least one attendee before saving this training session.
                    </div>
                  )}

                  <div className="mt-4 max-h-[360px] overflow-y-auto rounded-2xl border border-gray-100 bg-slate-50/70 p-3">
                    {visibleTeachers.length ? (
                      <div className="grid grid-cols-1 gap-2 xl:grid-cols-2">
                        {visibleTeachers.map((teacher) => {
                          const selected = form.userIds.includes(teacher.id);
                          const displayName = teacher.name || teacher.email || "Unknown employee";
                          return (
                            <button
                              key={teacher.id}
                              type="button"
                              aria-pressed={selected}
                              onClick={() => toggleTeacher(teacher.id)}
                              className={[
                                "flex items-start gap-3 rounded-2xl border px-4 py-3 text-left transition",
                                selected
                                  ? "border-blue-200 bg-blue-50 text-blue-950 shadow-sm"
                                  : "border-gray-200 bg-white text-gray-700 hover:border-blue-100 hover:bg-blue-50/50",
                              ].join(" ")}
                            >
                              <div className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl text-sm font-extrabold ${selected ? "bg-blue-700 text-white" : "bg-gray-100 text-gray-700"}`}>
                                {getInitials(displayName)}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="truncate text-sm font-bold">{displayName}</span>
                                  {teacher.role ? (
                                    <span className="rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-gray-500">
                                      {formatRole(teacher.role)}
                                    </span>
                                  ) : null}
                                </div>
                                <div className="mt-1 truncate text-xs text-gray-500">{teacher.email || "No email on file"}</div>
                              </div>
                              <div className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${selected ? "bg-blue-700 text-white" : "bg-gray-100 text-gray-500"}`}>
                                {selected ? "Selected" : "Select"}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-dashed border-gray-200 bg-white px-4 py-8 text-center">
                        <div className="text-sm font-bold text-gray-700">No employees match this search.</div>
                        <p className="mt-1 text-xs text-gray-500">Try a different name, email, or role filter.</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="rounded-2xl border border-sky-100 bg-white p-5 shadow-sm">
                  <div className="text-sm font-extrabold text-gray-900">Review Before Saving</div>
                  <p className="mt-1 text-sm text-gray-500">
                    This creates one training record per selected employee using the shared session details below.
                  </p>

                  <div className="mt-4 space-y-3">
                    <div className="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Topic</div>
                      <div className="mt-1 text-sm font-semibold text-gray-900">{form.topic.trim() || "Add a topic"}</div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Date</div>
                        <div className="mt-1 text-sm font-semibold text-gray-900">{form.date ? fmtDate(form.date) : "Choose a date"}</div>
                      </div>
                      <div className="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Category</div>
                        <div className="mt-1 text-sm font-semibold text-gray-900">{form.category}</div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Hours</div>
                        <div className="mt-1 text-sm font-semibold text-gray-900">{form.hours ? `${form.hours} hours` : "Add hours"}</div>
                      </div>
                      <div className="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Trainer</div>
                        <div className="mt-1 text-sm font-semibold text-gray-900">{form.performedBy.trim() || "Optional"}</div>
                      </div>
                    </div>
                    <div className="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Attendees</div>
                      <div className="mt-1 text-sm font-semibold text-gray-900">
                        {selectedTeachers.length} employee{selectedTeachers.length === 1 ? "" : "s"} selected
                      </div>
                      {selectedTeachers.length > 0 ? (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {selectedTeachers.slice(0, 8).map((teacher) => (
                            <span key={teacher.id} className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-gray-700 shadow-sm">
                              {teacher.name || teacher.email}
                            </span>
                          ))}
                          {selectedTeachers.length > 8 ? (
                            <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-gray-500 shadow-sm">
                              +{selectedTeachers.length - 8} more
                            </span>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <div className="mt-5 flex flex-col gap-2">
                    <SaveButton
                      saving={saving}
                      disabled={!form.topic.trim() || !form.hours || !form.userIds.length}
                      label={selectedTeachers.length
                        ? `Log Training for ${selectedTeachers.length} Employee${selectedTeachers.length === 1 ? "" : "s"}`
                        : "Select Employees"}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setShowForm(false);
                        setEmployeeSearch("");
                      }}
                      className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-600 transition hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>

                <div className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-4">
                  <div className="text-xs font-bold uppercase tracking-wider text-amber-700">Workflow Tip</div>
                  <p className="mt-2 text-sm text-amber-900">
                    Use search plus "Select Visible" when most staff attended the same training and you only need to exclude a few employees.
                  </p>
                </div>
              </div>
            </div>
          </form>
        )}

        {summary && (
          <div className="mt-6 space-y-4">
            <div className="rounded-[28px] border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="text-lg font-black tracking-tight text-gray-900">Employee Training Report</div>
                  <p className="mt-1 text-sm text-gray-500">
                    Use the employee and date-range filters above, then run or export the current report for completed training hours.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={loadData}
                    className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
                  >
                    Run Report
                  </button>
                  <button
                    type="button"
                    onClick={handleExportReport}
                    disabled={!reportRows.length}
                    className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-semibold text-blue-700 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Export CSV
                  </button>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1fr)_300px]">
                <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
                  <KpiCard label="Total Hours" value={summary.totalHours} color="sky" />
                  <KpiCard label="Entries" value={summary.totalEntries || 0} color="gray" />
                  <KpiCard label="Employees" value={reportRows.length} color="blue" />
                  {topTrainingCategories.map(([category, hours]) => (
                    <KpiCard key={category} label={category} value={hours} color="blue" />
                  ))}
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Report Window</div>
                  <div className="mt-1 text-sm font-bold text-slate-900">{reportRangeLabel}</div>
                  <p className="mt-2 text-xs text-slate-500">
                    {userId
                      ? "This report is currently filtered to one employee."
                      : "This report includes all employees in the selected date range."}
                  </p>
                </div>
              </div>

              <div className="mt-4 overflow-x-auto rounded-2xl border border-gray-100">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50/80 text-left text-xs font-bold uppercase tracking-wider text-gray-400">
                      <th className="px-4 py-3">Employee</th>
                      <th className="px-4 py-3">Entries</th>
                      <th className="px-4 py-3">Total Hours Completed</th>
                      <th className="px-4 py-3">Avg / Entry</th>
                      <th className="px-4 py-3">Last Completed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportRows.length ? reportRows.map((reportRow) => {
                      const averageHours = reportRow.entries ? Math.round((reportRow.totalHours / reportRow.entries) * 100) / 100 : 0;
                      return (
                        <tr key={reportRow.userId || reportRow.name} className="border-b border-gray-50">
                          <td className="px-4 py-3 font-semibold text-gray-900">{reportRow.name || "Unknown employee"}</td>
                          <td className="px-4 py-3 text-gray-700">{reportRow.entries}</td>
                          <td className="px-4 py-3 font-semibold text-sky-700">{reportRow.totalHours}</td>
                          <td className="px-4 py-3 text-gray-700">{averageHours}h</td>
                          <td className="px-4 py-3 text-gray-700">{reportRow.lastCompletedAt ? fmtDate(reportRow.lastCompletedAt) : "-"}</td>
                        </tr>
                      );
                    }) : (
                      <tr>
                        <td colSpan={5} className="px-4 py-6 text-center text-sm text-gray-500">No employee training records in this range.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}

        {loading ? <Loading /> : logs.length === 0 ? (
          <div className="mt-6 py-8 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-xl">📚</div>
            <p className="mt-3 text-sm font-semibold text-gray-600">No training logs found.</p>
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {logs.map((log) => (
              <div key={log.id} className="rounded-2xl border border-gray-100 bg-gray-50/60 px-4 py-4 transition hover:border-gray-200 hover:bg-white">
                <div className="flex flex-wrap items-start gap-4">
                  <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-800 to-sky-600 text-xs font-bold text-white">
                    {getInitials(log.user?.name || log.user?.email)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="text-sm font-bold text-gray-900">{log.topic}</div>
                      <span className="rounded-full bg-blue-100 px-2.5 py-1 text-[11px] font-bold text-blue-800">{log.category}</span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
                      <span>{log.user?.name || log.user?.email || "Unknown employee"}</span>
                      <span>{fmtDate(log.date)}</span>
                      {log.performedBy ? <span>Facilitated by {log.performedBy}</span> : null}
                      {log.recordedBy?.name ? <span>Logged by {log.recordedBy.name}</span> : null}
                    </div>
                    {log.description ? <p className="mt-2 text-sm text-gray-600">{log.description}</p> : null}
                  </div>
                  <div className="ml-auto flex items-center gap-2">
                    <span className="rounded-full bg-sky-100 px-2.5 py-1 text-sm font-extrabold text-sky-800">{log.hours}h</span>
                    <button onClick={() => handleDelete(log.id)} className="rounded-lg border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-600 transition hover:bg-red-100">
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function BudgetsTab({ centerId, classes }) {
  const [budgets, setBudgets] = useState([]);
  const [month, setMonth] = useState(currentMonth());
  const [classRoomId, setClassRoomId] = useState("");
  const [loading, setLoading] = useState(false);
  const [showBudgetForm, setShowBudgetForm] = useState(false);
  const [budgetForm, setBudgetForm] = useState({ classRoomId: "", allocatedAmount: "", notes: "" });
  const [expenseForm, setExpenseForm] = useState(null);
  const [saving, setSaving] = useState(false);

  const loadBudgets = useCallback(async () => {
    setLoading(true);
    try {
      const qs = `centerId=${centerId}&month=${month}${classRoomId ? `&classRoomId=${classRoomId}` : ""}`;
      const data = await apiJson(`/api/v1/classroom-budgets?${qs}`);
      setBudgets(Array.isArray(data) ? data : []);
    } catch {} finally { setLoading(false); }
  }, [centerId, month, classRoomId]);

  useEffect(() => { loadBudgets(); }, [loadBudgets]);

  const handleSetBudget = async (e) => {
    e.preventDefault();
    if (!budgetForm.classRoomId || !budgetForm.allocatedAmount) return;
    setSaving(true);
    try {
      await apiJson("/api/v1/classroom-budgets", {
        method: "POST",
        body: JSON.stringify({
          centerId, classRoomId: budgetForm.classRoomId, month,
          allocatedAmount: parseFloat(budgetForm.allocatedAmount),
          notes: budgetForm.notes || null,
        }),
      });
      setShowBudgetForm(false);
      setBudgetForm({ classRoomId: "", allocatedAmount: "", notes: "" });
      loadBudgets();
    } catch {} finally { setSaving(false); }
  };

  const handleAddExpense = async (e) => {
    e.preventDefault();
    if (!expenseForm || !expenseForm.description || !expenseForm.amount) return;
    setSaving(true);
    try {
      await apiJson(`/api/v1/classroom-budgets/${expenseForm.budgetId}/expenses`, {
        method: "POST",
        body: JSON.stringify({
          description: expenseForm.description,
          amount: parseFloat(expenseForm.amount),
          date: expenseForm.date || today(),
          category: expenseForm.category || "Other",
        }),
      });
      setExpenseForm(null);
      loadBudgets();
    } catch {} finally { setSaving(false); }
  };

  const handleDeleteExpense = async (budgetId, expenseId) => {
    if (!confirm("Delete this expense?")) return;
    try {
      await apiJson(`/api/v1/classroom-budgets/${budgetId}/expenses/${expenseId}`, { method: "DELETE" });
      loadBudgets();
    } catch {}
  };

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <FilterInput label="Month" type="month" value={month} onChange={setMonth} />
            <FilterSelect label="Classroom" value={classRoomId} onChange={setClassRoomId}>
              <option value="">All classrooms</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </FilterSelect>
          </div>
          <PrimaryButton onClick={() => setShowBudgetForm(!showBudgetForm)}>
            {showBudgetForm ? "Cancel" : "+ Set Budget"}
          </PrimaryButton>
        </div>

        {showBudgetForm && (
          <form onSubmit={handleSetBudget} className="mt-4 grid grid-cols-1 gap-3 rounded-xl border border-blue-100 bg-blue-50/30 p-5 md:grid-cols-3">
            <FilterSelect label="Classroom" value={budgetForm.classRoomId} onChange={(v) => setBudgetForm({ ...budgetForm, classRoomId: v })}>
              <option value="">Select classroom…</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </FilterSelect>
            <FilterInput label="Allocated Amount ($)" type="number" value={budgetForm.allocatedAmount} onChange={(v) => setBudgetForm({ ...budgetForm, allocatedAmount: v })} />
            <FilterInput label="Notes" type="text" value={budgetForm.notes} onChange={(v) => setBudgetForm({ ...budgetForm, notes: v })} />
            <div className="flex items-end">
              <SaveButton saving={saving} label="Save Budget" />
            </div>
          </form>
        )}
      </Card>

      {loading ? <Loading /> : budgets.length === 0 ? (
        <EmptyCard icon="💰" title="No budgets set" msg="No budgets for this month. Set one using the button above." />
      ) : budgets.map((b) => {
        const pct = b.allocatedAmount > 0 ? Math.min(100, Math.round((b.spent / b.allocatedAmount) * 100)) : 0;
        const barColor = pct > 90 ? "bg-red-500" : pct > 70 ? "bg-amber-500" : "bg-emerald-500";

        return (
          <Card key={b.id}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-lg">🏫</div>
                <div>
                  <div className="text-sm font-bold text-gray-900">{b.classRoom?.name || "Classroom"}</div>
                  <div className="text-xs text-gray-500">{b.month}</div>
                </div>
              </div>
              <PrimaryButton size="sm" onClick={() => setExpenseForm({ budgetId: b.id, description: "", amount: "", date: today(), category: "Other" })}>
                + Add Expense
              </PrimaryButton>
            </div>

            {/* Budget Overview */}
            <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
              <KpiCard label="Allocated" value={`$${b.allocatedAmount.toFixed(2)}`} color="sky" />
              <KpiCard label="Spent" value={`$${(b.spent || 0).toFixed(2)}`} color={pct > 90 ? "red" : "amber"} />
              <KpiCard label="Remaining" value={`$${(b.remaining || 0).toFixed(2)}`} color="emerald" />
              <div className="flex flex-col justify-center rounded-xl border border-gray-200 bg-gray-50 p-4">
                <div className="text-xs font-bold uppercase tracking-wider text-gray-400">Usage</div>
                <div className="mt-2 h-3 w-full overflow-hidden rounded-full bg-gray-200">
                  <div className={`h-3 rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
                </div>
                <div className="mt-1.5 text-lg font-extrabold text-gray-900">{pct}%</div>
              </div>
            </div>

            {expenseForm && expenseForm.budgetId === b.id && (
              <form onSubmit={handleAddExpense} className="mt-4 grid grid-cols-1 gap-3 rounded-xl border border-blue-100 bg-blue-50/30 p-4 md:grid-cols-3">
                <FilterInput label="Description" type="text" value={expenseForm.description} onChange={(v) => setExpenseForm({ ...expenseForm, description: v })} />
                <FilterInput label="Amount ($)" type="number" value={expenseForm.amount} onChange={(v) => setExpenseForm({ ...expenseForm, amount: v })} />
                <FilterInput label="Date" type="date" value={expenseForm.date} onChange={(v) => setExpenseForm({ ...expenseForm, date: v })} />
                <FilterSelect label="Category" value={expenseForm.category} onChange={(v) => setExpenseForm({ ...expenseForm, category: v })}>
                  {EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </FilterSelect>
                <div className="flex items-end gap-2">
                  <SaveButton saving={saving} label="Add" />
                  <button type="button" onClick={() => setExpenseForm(null)} className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition">Cancel</button>
                </div>
              </form>
            )}

            {b.expenses && b.expenses.length > 0 && (
              <div className="mt-4 overflow-x-auto rounded-xl border border-gray-100">
                <table className="min-w-full text-sm">
                  <thead><tr className="border-b border-gray-200 bg-gray-50/80 text-left text-xs font-bold uppercase tracking-wider text-gray-400">
                    <th className="px-4 py-3">Description</th><th className="px-4 py-3">Amount</th>
                    <th className="px-4 py-3">Date</th><th className="px-4 py-3">Category</th><th className="px-4 py-3"></th>
                  </tr></thead>
                  <tbody>
                    {b.expenses.map((exp) => (
                      <tr key={exp.id} className="border-b border-gray-50 transition hover:bg-blue-50/30">
                        <td className="px-4 py-3 font-medium text-gray-900">{exp.description}</td>
                        <td className="px-4 py-3 font-bold text-gray-900">${exp.amount.toFixed(2)}</td>
                        <td className="px-4 py-3 text-gray-500">{fmtDate(exp.date)}</td>
                        <td className="px-4 py-3">
                          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-600">{exp.category}</span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button onClick={() => handleDeleteExpense(b.id, exp.id)} className="text-xs font-semibold text-red-500 hover:text-red-700 transition">Delete</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}

// ─── Evaluations Tab ─────────────────────────────────────────

function EvaluationsTab({ centerId, teachers }) {
  const [evaluations, setEvaluations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [filterTeacherId, setFilterTeacherId] = useState("");
  const [filterFrom, setFilterFrom] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  });
  const [filterTo, setFilterTo] = useState(today());
  const [form, setForm] = useState({
    teacherId: "", periodStart: today(), periodEnd: addDays(today(), 13),
    categories: Object.fromEntries(EVAL_CATEGORIES.map((c) => [c, 3])),
    strengths: "", areasForImprovement: "", goals: "", notes: "",
  });
  const [saving, setSaving] = useState(false);

  const loadEvaluations = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({
        centerId,
        ...(filterTeacherId ? { teacherId: filterTeacherId } : {}),
        ...(filterFrom ? { from: filterFrom } : {}),
        ...(filterTo ? { to: filterTo } : {}),
      });
      const data = await apiJson(`/api/v1/evaluations?${qs.toString()}`);
      setEvaluations(Array.isArray(data) ? data : []);
    } catch {} finally { setLoading(false); }
  }, [centerId, filterFrom, filterTeacherId, filterTo]);

  useEffect(() => { loadEvaluations(); }, [loadEvaluations]);

  const overallScore = (cats) => {
    const vals = Object.values(cats || {}).filter((v) => typeof v === "number");
    if (vals.length === 0) return null;
    return Math.round((vals.reduce((s, v) => s + v, 0) / vals.length) * 20);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.teacherId) return;
    setSaving(true);
    try {
      await apiJson("/api/v1/evaluations", {
        method: "POST",
        body: JSON.stringify({
          centerId,
          teacherId: form.teacherId,
          periodStart: form.periodStart || null,
          periodEnd: form.periodEnd || null,
          overallScore: overallScore(form.categories),
          categories: form.categories,
          strengths: form.strengths || null,
          areasForImprovement: form.areasForImprovement || null,
          goals: form.goals || null,
          notes: form.notes || null,
        }),
      });
      setShowForm(false);
      setForm({
        teacherId: "", periodStart: today(), periodEnd: addDays(today(), 13),
        categories: Object.fromEntries(EVAL_CATEGORIES.map((c) => [c, 3])),
        strengths: "", areasForImprovement: "", goals: "", notes: "",
      });
      loadEvaluations();
    } catch {} finally { setSaving(false); }
  };

  const handleSubmit = async (id) => {
    try {
      await apiJson(`/api/v1/evaluations/${id}`, { method: "PUT", body: JSON.stringify({ status: "SUBMITTED" }) });
      loadEvaluations();
    } catch {}
  };

  const scoreColor = (score) => {
    if (score >= 80) return "text-emerald-700 bg-emerald-50";
    if (score >= 60) return "text-amber-700 bg-amber-50";
    return "text-red-700 bg-red-50";
  };

  const evaluationSummary = evaluations.reduce((acc, evaluation) => {
    acc.total += 1;
    if (evaluation.status === "SUBMITTED" || evaluation.status === "ACKNOWLEDGED") acc.submitted += 1;
    if (typeof evaluation.overallScore === "number") {
      acc.scored += 1;
      acc.scoreTotal += evaluation.overallScore;
    }
    return acc;
  }, { total: 0, submitted: 0, scored: 0, scoreTotal: 0 });

  const handlePrint = () => {
    const teacherLabel = teachers.find((t) => t.id === filterTeacherId)?.name || "All teachers";
    const rows = evaluations.map((ev) => ({
      teacher: ev.teacher?.name || ev.teacher?.email || "",
      period: formatEvaluationPeriod(ev),
      evaluator: ev.evaluator?.name || "",
      status: ev.status || "",
      score: typeof ev.overallScore === "number" ? `${ev.overallScore}%` : "",
      strengths: ev.strengths || "",
      improvement: ev.areasForImprovement || "",
      goals: ev.goals || "",
      notes: ev.notes || "",
    }));
    const html = `
      <html>
        <head>
          <title>Teacher Evaluations</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; color: #111827; }
            h1 { font-size: 20px; margin: 0 0 4px; }
            .meta { color: #4b5563; font-size: 12px; margin-bottom: 16px; }
            table { border-collapse: collapse; width: 100%; font-size: 12px; }
            th, td { border: 1px solid #d1d5db; padding: 8px; text-align: left; vertical-align: top; }
            th { background: #f3f4f6; }
          </style>
        </head>
        <body>
          <h1>Teacher Evaluations</h1>
          <div class="meta">Employee: ${escapeHtml(teacherLabel)} | Date range: ${escapeHtml(filterFrom || "Any")} to ${escapeHtml(filterTo || "Any")}</div>
          <table>
            <thead><tr><th>Teacher</th><th>Period</th><th>Status</th><th>Score</th><th>Evaluator</th><th>Strengths</th><th>Improvement</th><th>Goals</th><th>Notes</th></tr></thead>
            <tbody>
              ${rows.map((row) => `<tr><td>${escapeHtml(row.teacher)}</td><td>${escapeHtml(row.period)}</td><td>${escapeHtml(row.status)}</td><td>${escapeHtml(row.score)}</td><td>${escapeHtml(row.evaluator)}</td><td>${escapeHtml(row.strengths)}</td><td>${escapeHtml(row.improvement)}</td><td>${escapeHtml(row.goals)}</td><td>${escapeHtml(row.notes)}</td></tr>`).join("")}
            </tbody>
          </table>
        </body>
      </html>
    `;
    const win = window.open("", "_blank", "width=1100,height=800");
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.focus();
    win.print();
  };

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SectionTitle icon="⭐" title="Teacher Evaluations" />
          <div className="flex flex-wrap gap-2">
            <SecondaryButton onClick={handlePrint} disabled={!evaluations.length}>
              Print Report
            </SecondaryButton>
            <PrimaryButton onClick={() => setShowForm(!showForm)}>
              {showForm ? "Cancel" : "+ Create Evaluation"}
            </PrimaryButton>
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-900">
          Submitted evaluations now appear on the teacher side under <span className="font-bold">My Performance &amp; Training &gt; Evaluations</span>.
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
          <FilterSelect label="Teacher" value={filterTeacherId} onChange={setFilterTeacherId}>
            <option value="">All teachersâ€¦</option>
            {teachers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </FilterSelect>
          <FilterInput label="From" type="date" value={filterFrom} onChange={setFilterFrom} />
          <FilterInput label="To" type="date" value={filterTo} onChange={setFilterTo} />
        </div>

        {evaluations.length > 0 && (
          <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3">
            <KpiCard label="Evaluations" value={evaluationSummary.total} color="gray" />
            <KpiCard label="Submitted" value={evaluationSummary.submitted} color="sky" />
            <KpiCard label="Average Score" value={evaluationSummary.scored ? Math.round(evaluationSummary.scoreTotal / evaluationSummary.scored) : "â€”"} color="emerald" />
          </div>
        )}

        {showForm && (
          <form onSubmit={handleCreate} className="mt-4 space-y-5 rounded-xl border border-blue-100 bg-blue-50/30 p-5">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <FilterSelect label="Teacher" value={form.teacherId} onChange={(v) => setForm({ ...form, teacherId: v })}>
                <option value="">Select teacher…</option>
                {teachers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </FilterSelect>
              <FilterInput label="Period Start" type="date" value={form.periodStart} onChange={(v) => setForm({ ...form, periodStart: v })} />
              <FilterInput label="Period End" type="date" value={form.periodEnd} onChange={(v) => setForm({ ...form, periodEnd: v })} />
            </div>

            <div>
              <div className="mb-3 text-xs font-bold uppercase tracking-wider text-gray-400">Category Scores (1-5)</div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                {EVAL_CATEGORIES.map((cat) => (
                  <label key={cat} className="block rounded-xl border border-gray-200 bg-white p-3">
                    <div className="mb-2 text-xs font-semibold text-gray-600">{cat}</div>
                    <input type="range" min="1" max="5" step="1"
                      value={form.categories[cat] || 3}
                      onChange={(e) => setForm({ ...form, categories: { ...form.categories, [cat]: parseInt(e.target.value) } })}
                      className="w-full accent-blue-600" />
                    <div className="mt-1 text-center text-lg font-extrabold text-blue-800">{form.categories[cat]}/5</div>
                  </label>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <TextArea label="Strengths" value={form.strengths} onChange={(v) => setForm({ ...form, strengths: v })} />
              <TextArea label="Areas for Improvement" value={form.areasForImprovement} onChange={(v) => setForm({ ...form, areasForImprovement: v })} />
              <TextArea label="Goals" value={form.goals} onChange={(v) => setForm({ ...form, goals: v })} />
              <TextArea label="Notes" value={form.notes} onChange={(v) => setForm({ ...form, notes: v })} />
            </div>

            <div className="flex items-center justify-between rounded-xl bg-white px-4 py-3 border border-gray-200">
              <div className="text-sm text-gray-600">Overall Score: <span className="text-lg font-extrabold text-blue-800">{overallScore(form.categories)}%</span></div>
              <SaveButton saving={saving} label="Save as Draft" />
            </div>
          </form>
        )}
      </Card>

      {loading ? <Loading /> : evaluations.length === 0 ? (
        <EmptyCard icon="⭐" title="No evaluations yet" msg="Create your first evaluation using the button above." />
      ) : (
        <div className="space-y-3">
          {evaluations.map((ev) => {
            const expanded = expandedId === ev.id;
            return (
              <div key={ev.id} className={`rounded-2xl border bg-white transition ${expanded ? "border-blue-200 shadow-sm" : "border-gray-200"}`}>
                <div
                  className="flex flex-wrap items-center justify-between gap-3 cursor-pointer p-5"
                  onClick={() => setExpandedId(expanded ? null : ev.id)}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-800 to-sky-600 text-xs font-bold text-white">
                      {getInitials(ev.teacher?.name)}
                    </div>
                    <div>
                      <div className="text-sm font-bold text-gray-900">{ev.teacher?.name}</div>
                      <div className="text-xs text-gray-500">Period: {formatEvaluationPeriod(ev)} - By: {ev.evaluator?.name}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {ev.overallScore !== null && (
                      <span className={`rounded-lg px-3 py-1.5 text-sm font-extrabold ${scoreColor(ev.overallScore)}`}>
                        {ev.overallScore}%
                      </span>
                    )}
                    <Badge map={EVAL_STATUS_BADGE} value={ev.status} />
                    {ev.status === "DRAFT" && (
                      <button onClick={(e) => { e.stopPropagation(); handleSubmit(ev.id); }}
                        className="rounded-lg bg-gradient-to-r from-blue-800 to-sky-600 px-3 py-1.5 text-xs font-bold text-white hover:from-blue-900 hover:to-sky-700 transition">Submit</button>
                    )}
                    <svg className={`h-5 w-5 text-gray-400 transition ${expanded ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>

                {expanded && (
                  <div className="space-y-4 border-t border-gray-100 px-5 pb-5 pt-4">
                    {ev.categories && Object.keys(ev.categories).length > 0 && (
                      <div>
                        <div className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">Category Scores</div>
                        <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
                          {Object.entries(ev.categories).map(([cat, score]) => (
                            <div key={cat} className="rounded-xl border border-gray-100 bg-gray-50 p-3 text-center">
                              <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">{cat}</div>
                              <div className="mt-1 text-xl font-extrabold text-gray-800">{score}<span className="text-sm text-gray-400">/5</span></div>
                              {/* Mini bar */}
                              <div className="mx-auto mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-gray-200">
                                <div className="h-1.5 rounded-full bg-blue-500" style={{ width: `${(score / 5) * 100}%` }} />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {ev.strengths && <TextBlock label="Strengths" value={ev.strengths} />}
                    {ev.areasForImprovement && <TextBlock label="Areas for Improvement" value={ev.areasForImprovement} />}
                    {ev.goals && <TextBlock label="Goals" value={ev.goals} />}
                    {ev.notes && <TextBlock label="Notes" value={ev.notes} />}
                    {ev.teacherAcknowledgedAt && (
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600">
                        <span>✓</span> Acknowledged on {fmtDateTime(ev.teacherAcknowledgedAt)}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Shared UI ───────────────────────────────────────────────

function getInitials(name) {
  if (!name) return "?";
  return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
}

function formatRole(role) {
  return String(role || "")
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function Badge({ map, value }) {
  return (
    <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-bold ${map[value] || "bg-gray-100 text-gray-600"}`}>
      {(value || "").replace(/_/g, " ")}
    </span>
  );
}

function KpiCard({ label, value, color = "gray" }) {
  const colorMap = {
    sky: "border-sky-200 bg-sky-50 text-sky-800",
    blue: "border-blue-200 bg-blue-50 text-blue-900",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-800",
    amber: "border-amber-200 bg-amber-50 text-amber-800",
    red: "border-red-200 bg-red-50 text-red-800",
    gray: "border-gray-200 bg-gray-50 text-gray-800",
  };
  return (
    <div className={`rounded-xl border p-4 ${colorMap[color] || colorMap.gray}`}>
      <div className="text-2xl font-extrabold">{String(value)}</div>
      <div className="mt-0.5 text-[10px] font-bold uppercase tracking-wider">{label}</div>
    </div>
  );
}

function MiniStat({ icon, label, value, colorClass }) {
  return (
    <div className={`flex items-center gap-3 rounded-xl border p-4 ${colorClass}`}>
      <span className="text-lg">{icon}</span>
      <div>
        <div className="text-xl font-extrabold">{value}</div>
        <div className="text-[10px] font-bold uppercase tracking-wider">{label}</div>
      </div>
    </div>
  );
}

function Card({ children }) {
  return <div className="rounded-2xl border border-gray-200 bg-white p-6">{children}</div>;
}

function SectionTitle({ icon, title }) {
  return (
    <div className="flex items-center gap-2 text-sm font-extrabold text-gray-900">
      <span className="text-base">{icon}</span>
      {title}
    </div>
  );
}

function PrimaryButton({ onClick, children, size = "md" }) {
  const sizeClass = size === "sm" ? "px-3 py-1.5 text-xs" : "px-5 py-2.5 text-sm";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl bg-gradient-to-r from-blue-800 to-sky-600 font-bold text-white shadow-sm hover:from-blue-900 hover:to-sky-700 transition ${sizeClass}`}
    >
      {children}
    </button>
  );
}

function SecondaryButton({ onClick, children, disabled = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="rounded-xl border border-gray-200 bg-white px-5 py-2.5 text-sm font-bold text-gray-800 shadow-sm transition hover:bg-gray-50 disabled:opacity-50"
    >
      {children}
    </button>
  );
}

function SaveButton({ saving, label = "Save", disabled = false }) {
  return (
    <button
      type="submit"
      disabled={saving || disabled}
      className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50 transition"
    >
      {saving ? "Saving…" : label}
    </button>
  );
}

function FilterSelect({ label, value, onChange, disabled, children }) {
  return (
    <label className="block">
      <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">{label}</div>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm font-medium text-gray-900 focus:border-blue-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100" disabled={disabled}>
        {children}
      </select>
    </label>
  );
}

function FilterInput({ label, type, value, onChange }) {
  return (
    <label className="block">
      <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">{label}</div>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm font-medium text-gray-900 focus:border-blue-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100" />
    </label>
  );
}

function TextArea({ label, value, onChange }) {
  return (
    <label className="block">
      <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">{label}</div>
      <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={3}
        className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm font-medium text-gray-900 focus:border-blue-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100" />
    </label>
  );
}

function TextBlock({ label, value }) {
  return (
    <div className="rounded-xl bg-gray-50 p-4">
      <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">{label}</div>
      <p className="mt-1.5 text-sm text-gray-700 whitespace-pre-wrap">{value}</p>
    </div>
  );
}

function ModalShell({ title, subtitle, onClose, children }) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event) {
      if (event.key === "Escape") onClose();
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-3xl rounded-[28px] border border-white/70 bg-white p-6 shadow-[0_30px_80px_-30px_rgba(15,23,42,0.45)]">
        <div className="flex items-start justify-between gap-4 border-b border-gray-100 pb-4">
          <div>
            <div className="text-xl font-black tracking-tight text-gray-900">{title}</div>
            {subtitle ? <p className="mt-1 text-sm text-gray-500">{subtitle}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-gray-200 text-gray-500 transition hover:bg-gray-50 hover:text-gray-700"
            aria-label="Close modal"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
        <div className="mt-5">{children}</div>
      </div>
    </div>
  );
}

function Loading() {
  return <div className="mt-4 rounded-xl border border-gray-100 bg-gray-50/50 p-6"><SkeletonTable rows={4} cols={4} /></div>;
}

function EmptyCard({ icon, title, msg }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white py-12 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-gray-100 text-2xl">{icon}</div>
      <p className="mt-4 text-sm font-bold text-gray-700">{title}</p>
      <p className="mt-1 text-xs text-gray-500">{msg}</p>
    </div>
  );
}
