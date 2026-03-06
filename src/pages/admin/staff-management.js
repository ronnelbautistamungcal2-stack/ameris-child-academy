import AdminLayout from "@/components/admin/AdminLayout";
import { SkeletonTable } from "@/components/ui/Skeleton";
import { apiJson } from "@/lib/api";
import { useEffect, useState, useCallback } from "react";

const TABS = [
  { key: "attendance", label: "Staff Attendance" },
  { key: "time-off", label: "Time Off" },
  { key: "training", label: "Training Hours" },
  { key: "budgets", label: "Classroom Budgets" },
  { key: "evaluations", label: "Evaluations" },
];

const ATT_STATUS_BADGE = {
  PRESENT: "bg-emerald-100 text-emerald-800",
  LATE: "bg-amber-100 text-amber-800",
  ABSENT: "bg-red-100 text-red-800",
  HALF_DAY: "bg-sky-100 text-sky-800",
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

function today() { return new Date().toISOString().split("T")[0]; }
function currentMonth() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; }
function fmtDate(d) { return d ? new Date(d).toLocaleDateString() : ""; }
function fmtDateTime(d) { return d ? new Date(d).toLocaleString() : "—"; }

export default function StaffManagement() {
  const [activeTab, setActiveTab] = useState("attendance");
  const [centers, setCenters] = useState([]);
  const [centerId, setCenterId] = useState("");
  const [classes, setClasses] = useState([]);
  const [teachers, setTeachers] = useState([]);
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
    if (!centerId) { setClasses([]); setTeachers([]); return; }
    (async () => {
      try {
        const [cls, users] = await Promise.all([
          apiJson(`/api/v1/classes?centerId=${centerId}`).catch(() => []),
          apiJson(`/api/v1/users?centerId=${centerId}&role=TEACHER`).catch(() => []),
        ]);
        setClasses(Array.isArray(cls) ? cls : []);
        setTeachers(Array.isArray(users) ? users : []);
      } catch {}
    })();
  }, [centerId]);

  return (
    <AdminLayout title="Staff Management">
      <div className="space-y-4">
        <div className="rounded-2xl border border-gray-200 bg-white p-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-extrabold text-gray-900">Staff Management</h2>
              <p className="mt-1 text-sm text-gray-600">Attendance, time-off, training, budgets, and evaluations.</p>
            </div>
          </div>

          <div className="mt-4">
            <FilterSelect label="Center" value={centerId} onChange={setCenterId} disabled={loading}>
              <option value="">Select a center…</option>
              {centers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </FilterSelect>
          </div>

          <div className="mt-4 flex gap-1 overflow-x-auto border-b border-gray-200">
            {TABS.map((tab) => (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                className={["whitespace-nowrap px-4 py-2.5 text-sm font-semibold transition",
                  activeTab === tab.key ? "border-b-2 border-sky-600 text-sky-700" : "text-gray-500 hover:text-gray-700",
                ].join(" ")}>{tab.label}</button>
            ))}
          </div>
        </div>

        {!centerId ? (
          <Empty msg="Select a center to get started." />
        ) : (
          <>
            {activeTab === "attendance" && <AttendanceTab centerId={centerId} teachers={teachers} />}
            {activeTab === "time-off" && <TimeOffTab centerId={centerId} teachers={teachers} />}
            {activeTab === "training" && <TrainingTab centerId={centerId} teachers={teachers} />}
            {activeTab === "budgets" && <BudgetsTab centerId={centerId} classes={classes} />}
            {activeTab === "evaluations" && <EvaluationsTab centerId={centerId} teachers={teachers} />}
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
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ userId: "", status: "PRESENT", clockIn: "", clockOut: "", lateMinutes: 0, notes: "" });
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
    if (!summaryUserId) { setSummary(null); return; }
    try {
      const now = new Date();
      const from = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
      const data = await apiJson(`/api/v1/staff-attendance/summary?centerId=${centerId}&userId=${summaryUserId}&from=${from}`);
      setSummary(data);
    } catch {}
  }, [centerId, summaryUserId]);

  useEffect(() => { loadSummary(); }, [loadSummary]);

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
      setShowForm(false);
      setForm({ userId: "", status: "PRESENT", clockIn: "", clockOut: "", lateMinutes: 0, notes: "" });
      loadRecords();
    } catch {} finally { setSaving(false); }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-gray-200 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <FilterInput label="Date" type="date" value={date} onChange={setDate} />
          </div>
          <button onClick={() => setShowForm(!showForm)} className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700">
            {showForm ? "Cancel" : "Record Attendance"}
          </button>
        </div>

        {showForm && (
          <form onSubmit={handleSave} className="mt-4 grid grid-cols-1 gap-3 rounded-xl border border-gray-100 bg-gray-50 p-4 md:grid-cols-3">
            <FilterSelect label="Teacher" value={form.userId} onChange={(v) => setForm({ ...form, userId: v })}>
              <option value="">Select teacher…</option>
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
            <div className="flex items-end">
              <button type="submit" disabled={saving} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </form>
        )}

        {loading ? <Loading /> : records.length === 0 ? (
          <p className="mt-4 text-sm text-gray-500">No attendance records for this date.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead><tr className="border-b border-gray-200 text-left text-xs font-semibold uppercase text-gray-500">
                <th className="px-3 py-2">Teacher</th><th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Clock In</th><th className="px-3 py-2">Clock Out</th>
                <th className="px-3 py-2">Late Min</th><th className="px-3 py-2">Notes</th>
              </tr></thead>
              <tbody>
                {records.map((r) => (
                  <tr key={r.id} className="border-b border-gray-100">
                    <td className="px-3 py-2 font-medium">{r.user?.name || "—"}</td>
                    <td className="px-3 py-2"><Badge map={ATT_STATUS_BADGE} value={r.status} /></td>
                    <td className="px-3 py-2">{r.clockIn ? new Date(r.clockIn).toLocaleTimeString() : "—"}</td>
                    <td className="px-3 py-2">{r.clockOut ? new Date(r.clockOut).toLocaleTimeString() : "—"}</td>
                    <td className="px-3 py-2">{r.lateMinutes || 0}</td>
                    <td className="px-3 py-2 text-gray-500">{r.notes || ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Monthly Summary */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5">
        <div className="text-sm font-extrabold text-gray-900">Monthly Summary</div>
        <div className="mt-3">
          <FilterSelect label="Teacher" value={summaryUserId} onChange={setSummaryUserId}>
            <option value="">Select teacher…</option>
            {teachers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </FilterSelect>
        </div>
        {summary && (
          <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-5">
            <KpiCard label="Total Days" value={summary.totalDays} color="gray" />
            <KpiCard label="Present" value={summary.present} color="emerald" />
            <KpiCard label="Late" value={summary.late} color="amber" />
            <KpiCard label="Absent" value={summary.absent} color="red" />
            <KpiCard label="Late Minutes" value={summary.totalLateMinutes} color="amber" />
          </div>
        )}
      </div>
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
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <div className="text-sm font-extrabold text-amber-800">Pending Requests ({pending.length})</div>
          <div className="mt-3 space-y-3">
            {pending.map((r) => (
              <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-white p-4">
                <div>
                  <div className="font-semibold text-gray-900">{r.user?.name}</div>
                  <div className="text-sm text-gray-600">
                    {r.type} &middot; {fmtDate(r.startDate)} — {fmtDate(r.endDate)}
                    {r.reason && <span className="ml-2 text-gray-400">({r.reason})</span>}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handleAction(r.id, "APPROVED")} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700">Approve</button>
                  <button onClick={() => handleAction(r.id, "DENIED")} className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700">Deny</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* All Requests */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm font-extrabold text-gray-900">All Requests</div>
          <FilterSelect label="Status" value={statusFilter} onChange={setStatusFilter}>
            <option value="">All</option>
            <option value="PENDING">Pending</option>
            <option value="APPROVED">Approved</option>
            <option value="DENIED">Denied</option>
            <option value="CANCELLED">Cancelled</option>
          </FilterSelect>
        </div>
        {loading ? <Loading /> : rest.length === 0 && pending.length === 0 ? (
          <p className="mt-4 text-sm text-gray-500">No time-off requests.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead><tr className="border-b border-gray-200 text-left text-xs font-semibold uppercase text-gray-500">
                <th className="px-3 py-2">Teacher</th><th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">Dates</th><th className="px-3 py-2">Reason</th>
                <th className="px-3 py-2">Status</th><th className="px-3 py-2">Reviewed By</th>
              </tr></thead>
              <tbody>
                {(statusFilter ? requests : rest).map((r) => (
                  <tr key={r.id} className="border-b border-gray-100">
                    <td className="px-3 py-2 font-medium">{r.user?.name || "—"}</td>
                    <td className="px-3 py-2">{r.type}</td>
                    <td className="px-3 py-2">{fmtDate(r.startDate)} — {fmtDate(r.endDate)}</td>
                    <td className="px-3 py-2 text-gray-500">{r.reason || ""}</td>
                    <td className="px-3 py-2"><Badge map={TIMEOFF_STATUS_BADGE} value={r.status} /></td>
                    <td className="px-3 py-2 text-gray-500">{r.reviewedBy?.name || ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Training Tab ────────────────────────────────────────────

function TrainingTab({ centerId, teachers }) {
  const [logs, setLogs] = useState([]);
  const [summary, setSummary] = useState(null);
  const [userId, setUserId] = useState("");
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ userId: "", topic: "", description: "", hours: "", date: today(), category: "Other" });
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const qs = `centerId=${centerId}${userId ? `&userId=${userId}` : ""}`;
      const [logsData, summaryData] = await Promise.all([
        apiJson(`/api/v1/training-logs?${qs}`),
        userId ? apiJson(`/api/v1/training-logs/summary?${qs}`) : Promise.resolve(null),
      ]);
      setLogs(Array.isArray(logsData) ? logsData : []);
      setSummary(summaryData);
    } catch {} finally { setLoading(false); }
  }, [centerId, userId]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.topic || !form.hours) return;
    setSaving(true);
    try {
      await apiJson("/api/v1/training-logs", {
        method: "POST",
        body: JSON.stringify({
          centerId,
          userId: form.userId || undefined,
          topic: form.topic,
          description: form.description || null,
          hours: parseFloat(form.hours),
          date: form.date,
          category: form.category,
        }),
      });
      setShowForm(false);
      setForm({ userId: "", topic: "", description: "", hours: "", date: today(), category: "Other" });
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
      <div className="rounded-2xl border border-gray-200 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <FilterSelect label="Teacher" value={userId} onChange={setUserId}>
              <option value="">All teachers</option>
              {teachers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </FilterSelect>
          </div>
          <button onClick={() => setShowForm(!showForm)} className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700">
            {showForm ? "Cancel" : "Log Training"}
          </button>
        </div>

        {showForm && (
          <form onSubmit={handleSave} className="mt-4 grid grid-cols-1 gap-3 rounded-xl border border-gray-100 bg-gray-50 p-4 md:grid-cols-3">
            <FilterSelect label="Teacher" value={form.userId} onChange={(v) => setForm({ ...form, userId: v })}>
              <option value="">Self</option>
              {teachers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </FilterSelect>
            <FilterInput label="Topic" type="text" value={form.topic} onChange={(v) => setForm({ ...form, topic: v })} />
            <FilterInput label="Hours" type="number" value={form.hours} onChange={(v) => setForm({ ...form, hours: v })} />
            <FilterInput label="Date" type="date" value={form.date} onChange={(v) => setForm({ ...form, date: v })} />
            <FilterSelect label="Category" value={form.category} onChange={(v) => setForm({ ...form, category: v })}>
              {TRAINING_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </FilterSelect>
            <FilterInput label="Description" type="text" value={form.description} onChange={(v) => setForm({ ...form, description: v })} />
            <div className="flex items-end">
              <button type="submit" disabled={saving} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </form>
        )}

        {/* Summary cards */}
        {summary && (
          <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
            <KpiCard label="Total Hours" value={summary.totalHours} color="sky" />
            {Object.entries(summary.byCategory || {}).map(([cat, hrs]) => (
              <KpiCard key={cat} label={cat} value={hrs} color="violet" />
            ))}
          </div>
        )}

        {loading ? <Loading /> : logs.length === 0 ? (
          <p className="mt-4 text-sm text-gray-500">No training logs found.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead><tr className="border-b border-gray-200 text-left text-xs font-semibold uppercase text-gray-500">
                <th className="px-3 py-2">Teacher</th><th className="px-3 py-2">Topic</th>
                <th className="px-3 py-2">Hours</th><th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">Category</th><th className="px-3 py-2">Actions</th>
              </tr></thead>
              <tbody>
                {logs.map((l) => (
                  <tr key={l.id} className="border-b border-gray-100">
                    <td className="px-3 py-2 font-medium">{l.user?.name || "—"}</td>
                    <td className="px-3 py-2">{l.topic}</td>
                    <td className="px-3 py-2">{l.hours}</td>
                    <td className="px-3 py-2">{fmtDate(l.date)}</td>
                    <td className="px-3 py-2">{l.category}</td>
                    <td className="px-3 py-2">
                      <button onClick={() => handleDelete(l.id)} className="text-xs text-red-600 hover:underline">Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Budgets Tab ─────────────────────────────────────────────

function BudgetsTab({ centerId, classes }) {
  const [budgets, setBudgets] = useState([]);
  const [month, setMonth] = useState(currentMonth());
  const [classRoomId, setClassRoomId] = useState("");
  const [loading, setLoading] = useState(false);
  const [showBudgetForm, setShowBudgetForm] = useState(false);
  const [budgetForm, setBudgetForm] = useState({ classRoomId: "", allocatedAmount: "", notes: "" });
  const [expenseForm, setExpenseForm] = useState(null); // { budgetId, description, amount, date, category }
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
      <div className="rounded-2xl border border-gray-200 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <FilterInput label="Month" type="month" value={month} onChange={setMonth} />
            <FilterSelect label="Classroom" value={classRoomId} onChange={setClassRoomId}>
              <option value="">All classrooms</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </FilterSelect>
          </div>
          <button onClick={() => setShowBudgetForm(!showBudgetForm)} className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700">
            {showBudgetForm ? "Cancel" : "Set Budget"}
          </button>
        </div>

        {showBudgetForm && (
          <form onSubmit={handleSetBudget} className="mt-4 grid grid-cols-1 gap-3 rounded-xl border border-gray-100 bg-gray-50 p-4 md:grid-cols-3">
            <FilterSelect label="Classroom" value={budgetForm.classRoomId} onChange={(v) => setBudgetForm({ ...budgetForm, classRoomId: v })}>
              <option value="">Select classroom…</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </FilterSelect>
            <FilterInput label="Allocated Amount ($)" type="number" value={budgetForm.allocatedAmount} onChange={(v) => setBudgetForm({ ...budgetForm, allocatedAmount: v })} />
            <FilterInput label="Notes" type="text" value={budgetForm.notes} onChange={(v) => setBudgetForm({ ...budgetForm, notes: v })} />
            <div className="flex items-end">
              <button type="submit" disabled={saving} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
                {saving ? "Saving…" : "Save Budget"}
              </button>
            </div>
          </form>
        )}
      </div>

      {loading ? <Loading /> : budgets.length === 0 ? (
        <Empty msg="No budgets set for this month." />
      ) : budgets.map((b) => {
        const pct = b.allocatedAmount > 0 ? Math.min(100, Math.round((b.spent / b.allocatedAmount) * 100)) : 0;
        return (
          <div key={b.id} className="rounded-2xl border border-gray-200 bg-white p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="font-semibold text-gray-900">{b.classRoom?.name || "Classroom"}</div>
                <div className="text-sm text-gray-500">{b.month}</div>
              </div>
              <button onClick={() => setExpenseForm({ budgetId: b.id, description: "", amount: "", date: today(), category: "Other" })}
                className="rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-700">Add Expense</button>
            </div>

            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <KpiCard label="Allocated" value={`$${b.allocatedAmount.toFixed(2)}`} color="sky" />
              <KpiCard label="Spent" value={`$${(b.spent || 0).toFixed(2)}`} color={pct > 90 ? "red" : "amber"} />
              <KpiCard label="Remaining" value={`$${(b.remaining || 0).toFixed(2)}`} color="emerald" />
              <div className="flex flex-col justify-center rounded-xl border border-gray-200 bg-gray-50 p-4">
                <div className="text-xs font-semibold uppercase text-gray-500">Used</div>
                <div className="mt-1 h-3 w-full rounded-full bg-gray-200">
                  <div className={`h-3 rounded-full ${pct > 90 ? "bg-red-500" : pct > 70 ? "bg-amber-500" : "bg-emerald-500"}`} style={{ width: `${pct}%` }} />
                </div>
                <div className="mt-1 text-sm font-bold">{pct}%</div>
              </div>
            </div>

            {expenseForm && expenseForm.budgetId === b.id && (
              <form onSubmit={handleAddExpense} className="grid grid-cols-1 gap-3 rounded-xl border border-gray-100 bg-gray-50 p-4 md:grid-cols-3">
                <FilterInput label="Description" type="text" value={expenseForm.description} onChange={(v) => setExpenseForm({ ...expenseForm, description: v })} />
                <FilterInput label="Amount ($)" type="number" value={expenseForm.amount} onChange={(v) => setExpenseForm({ ...expenseForm, amount: v })} />
                <FilterInput label="Date" type="date" value={expenseForm.date} onChange={(v) => setExpenseForm({ ...expenseForm, date: v })} />
                <FilterSelect label="Category" value={expenseForm.category} onChange={(v) => setExpenseForm({ ...expenseForm, category: v })}>
                  {EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </FilterSelect>
                <div className="flex items-end gap-2">
                  <button type="submit" disabled={saving} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
                    {saving ? "Saving…" : "Add"}
                  </button>
                  <button type="button" onClick={() => setExpenseForm(null)} className="rounded-lg border px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50">Cancel</button>
                </div>
              </form>
            )}

            {b.expenses && b.expenses.length > 0 && (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead><tr className="border-b border-gray-200 text-left text-xs font-semibold uppercase text-gray-500">
                    <th className="px-3 py-2">Description</th><th className="px-3 py-2">Amount</th>
                    <th className="px-3 py-2">Date</th><th className="px-3 py-2">Category</th><th className="px-3 py-2">Actions</th>
                  </tr></thead>
                  <tbody>
                    {b.expenses.map((exp) => (
                      <tr key={exp.id} className="border-b border-gray-100">
                        <td className="px-3 py-2">{exp.description}</td>
                        <td className="px-3 py-2">${exp.amount.toFixed(2)}</td>
                        <td className="px-3 py-2">{fmtDate(exp.date)}</td>
                        <td className="px-3 py-2">{exp.category}</td>
                        <td className="px-3 py-2">
                          <button onClick={() => handleDeleteExpense(b.id, exp.id)} className="text-xs text-red-600 hover:underline">Delete</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
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
  const [form, setForm] = useState({
    teacherId: "", period: currentMonth(),
    categories: Object.fromEntries(EVAL_CATEGORIES.map((c) => [c, 3])),
    strengths: "", areasForImprovement: "", goals: "", notes: "",
  });
  const [saving, setSaving] = useState(false);

  const loadEvaluations = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiJson(`/api/v1/evaluations?centerId=${centerId}`);
      setEvaluations(Array.isArray(data) ? data : []);
    } catch {} finally { setLoading(false); }
  }, [centerId]);

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
          centerId, teacherId: form.teacherId, period: form.period,
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
        teacherId: "", period: currentMonth(),
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

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-gray-200 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm font-extrabold text-gray-900">Teacher Evaluations</div>
          <button onClick={() => setShowForm(!showForm)} className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700">
            {showForm ? "Cancel" : "Create Evaluation"}
          </button>
        </div>

        {showForm && (
          <form onSubmit={handleCreate} className="mt-4 space-y-4 rounded-xl border border-gray-100 bg-gray-50 p-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <FilterSelect label="Teacher" value={form.teacherId} onChange={(v) => setForm({ ...form, teacherId: v })}>
                <option value="">Select teacher…</option>
                {teachers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </FilterSelect>
              <FilterInput label="Period" type="month" value={form.period} onChange={(v) => setForm({ ...form, period: v })} />
            </div>

            <div>
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Category Scores (1-5)</div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                {EVAL_CATEGORIES.map((cat) => (
                  <label key={cat} className="block">
                    <div className="mb-1 text-xs text-gray-600">{cat}</div>
                    <input type="range" min="1" max="5" step="1"
                      value={form.categories[cat] || 3}
                      onChange={(e) => setForm({ ...form, categories: { ...form.categories, [cat]: parseInt(e.target.value) } })}
                      className="w-full" />
                    <div className="text-center text-xs font-bold text-gray-700">{form.categories[cat]}</div>
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

            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-500">Overall: <strong>{overallScore(form.categories)}%</strong></div>
              <button type="submit" disabled={saving} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
                {saving ? "Saving…" : "Save as Draft"}
              </button>
            </div>
          </form>
        )}
      </div>

      {loading ? <Loading /> : evaluations.length === 0 ? (
        <Empty msg="No evaluations yet." />
      ) : (
        <div className="space-y-3">
          {evaluations.map((ev) => (
            <div key={ev.id} className="rounded-2xl border border-gray-200 bg-white p-5">
              <div className="flex flex-wrap items-center justify-between gap-3 cursor-pointer" onClick={() => setExpandedId(expandedId === ev.id ? null : ev.id)}>
                <div>
                  <div className="font-semibold text-gray-900">{ev.teacher?.name}</div>
                  <div className="text-sm text-gray-500">Period: {ev.period} &middot; By: {ev.evaluator?.name}</div>
                </div>
                <div className="flex items-center gap-3">
                  {ev.overallScore !== null && <span className="text-sm font-bold text-gray-700">{ev.overallScore}%</span>}
                  <Badge map={EVAL_STATUS_BADGE} value={ev.status} />
                  {ev.status === "DRAFT" && (
                    <button onClick={(e) => { e.stopPropagation(); handleSubmit(ev.id); }}
                      className="rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-700">Submit</button>
                  )}
                </div>
              </div>

              {expandedId === ev.id && (
                <div className="mt-4 space-y-3 border-t border-gray-100 pt-4">
                  {ev.categories && Object.keys(ev.categories).length > 0 && (
                    <div>
                      <div className="text-xs font-semibold uppercase text-gray-500 mb-2">Category Scores</div>
                      <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
                        {Object.entries(ev.categories).map(([cat, score]) => (
                          <div key={cat} className="rounded-lg border border-gray-100 bg-gray-50 p-2 text-center">
                            <div className="text-xs text-gray-500">{cat}</div>
                            <div className="text-lg font-bold text-gray-800">{score}/5</div>
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
                    <div className="text-xs text-emerald-600">Acknowledged on {fmtDateTime(ev.teacherAcknowledgedAt)}</div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Shared UI ───────────────────────────────────────────────

function Badge({ map, value }) {
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${map[value] || "bg-gray-100 text-gray-600"}`}>
      {(value || "").replace(/_/g, " ")}
    </span>
  );
}

function KpiCard({ label, value, color = "gray" }) {
  const colorMap = {
    sky: "border-sky-200 bg-sky-50 text-sky-800",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-800",
    violet: "border-violet-200 bg-violet-50 text-violet-800",
    amber: "border-amber-200 bg-amber-50 text-amber-800",
    red: "border-red-200 bg-red-50 text-red-800",
    gray: "border-gray-200 bg-gray-50 text-gray-800",
  };
  return (
    <div className={`rounded-xl border p-4 ${colorMap[color] || colorMap.gray}`}>
      <div className="text-2xl font-extrabold">{String(value)}</div>
      <div className="text-xs font-semibold uppercase tracking-wide">{label}</div>
    </div>
  );
}

function FilterSelect({ label, value, onChange, disabled, children }) {
  return (
    <label className="block">
      <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</div>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" disabled={disabled}>
        {children}
      </select>
    </label>
  );
}

function FilterInput({ label, type, value, onChange }) {
  return (
    <label className="block">
      <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</div>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" />
    </label>
  );
}

function TextArea({ label, value, onChange }) {
  return (
    <label className="block">
      <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</div>
      <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={3}
        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" />
    </label>
  );
}

function TextBlock({ label, value }) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase text-gray-500">{label}</div>
      <p className="mt-1 text-sm text-gray-700 whitespace-pre-wrap">{value}</p>
    </div>
  );
}

function Loading() {
  return <div className="rounded-2xl border border-gray-200 bg-white p-8 dark:border-gray-700 dark:bg-gray-800"><SkeletonTable rows={4} cols={4} /></div>;
}

function Empty({ msg }) {
  return <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-600">{msg}</div>;
}
