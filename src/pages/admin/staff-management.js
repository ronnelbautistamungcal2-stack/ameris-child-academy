import AdminLayout from "@/components/admin/AdminLayout";
import { SkeletonTable } from "@/components/ui/Skeleton";
import MonthlyCalendar from "@/components/calendar/MonthlyCalendar";
import { apiJson } from "@/lib/api";
import { toCalendarDay } from "@/lib/calendar";
import { getTimeOffTypeLabel, groupTimeOffRequests } from "@/lib/time-off";
import { getChecklistAssignedUserIds } from "@/lib/dailyChecklistAssignees";
import { useEffect, useState, useCallback, useMemo } from "react";

const TIMEOFF_CALENDAR_LEGEND = [
  { label: "Events", cls: "bg-indigo-100" },
  { label: "Pending Requests", cls: "bg-amber-200" },
  { label: "Approved Time Off", cls: "bg-emerald-100" },
  { label: "Unexcused Time Off", cls: "bg-red-100" },
];

const TABS = [
  { key: "checklists", label: "Checklists", icon: "✅" },
  { key: "attendance", label: "Attendance", icon: "📋" },
  { key: "time-off", label: "Time Off", icon: "🏖️" },
  { key: "training", label: "Training", icon: "📚" },
  { key: "budgets", label: "Budgets", icon: "💰" },
  { key: "evaluations", label: "Evaluations", icon: "⭐" },
];

const CHECKLIST_CATEGORY_LABELS = {
  OPENING: "Opening",
  CLOSING: "Closing",
  HEALTH_SAFETY: "Health & Safety",
  CLEANING: "Cleaning",
  MEALS: "Meals",
  CLASSROOM: "Classroom",
  OTHER: "Other",
};

function checklistGradeColor(pct) {
  if (pct == null) return "bg-gray-100 text-gray-500";
  if (pct >= 90) return "bg-emerald-100 text-emerald-800";
  if (pct >= 75) return "bg-sky-100 text-sky-800";
  if (pct >= 50) return "bg-amber-100 text-amber-800";
  return "bg-red-100 text-red-800";
}

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

const EVALUATION_STATUS_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "DRAFT", label: "Draft" },
  { value: "SUBMITTED", label: "Submitted" },
  { value: "ACKNOWLEDGED", label: "Acknowledged" },
];

const EVAL_TYPES = [
  "Annual Review",
  "Mid-Year Review",
  "Probationary Review",
  "Performance Improvement",
  "Other",
];

function createDefaultEvaluationForm(teacherId = "", categories = EVAL_CATEGORIES) {
  const list = Array.isArray(categories) && categories.length ? categories : EVAL_CATEGORIES;
  return {
    teacherId,
    evaluationType: "",
    periodStart: today(),
    periodEnd: addDays(today(), 13),
    categories: Object.fromEntries(list.map((category) => [category, 3])),
    strengths: "",
    areasForImprovement: "",
    goals: "",
    notes: "",
  };
}

const TRAINING_CATEGORIES = [
  "Orientation",
  "Safety",
  "Curriculum",
  "Professional Development",
  "Other",
];
const EXPENSE_CATEGORIES = [
  "Supplies",
  "Materials",
  "Equipment",
  "Food",
  "Other",
];
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

function today() {
  return new Date().toISOString().split("T")[0];
}
function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function addDays(dateString, days) {
  const d = dateString ? new Date(dateString) : new Date();
  if (Number.isNaN(d.getTime())) return today();
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}
function fmtDate(d) {
  return d ? new Date(d).toLocaleDateString() : "";
}
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
function fmtDateTime(d) {
  return d ? new Date(d).toLocaleString() : "—";
}
function fmtTimeOffRange(start, end) {
  if (!start || !end) return "—";
  const startDate = new Date(start);
  const endDate = new Date(end);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()))
    return "—";

  const sameDay =
    startDate.getFullYear() === endDate.getFullYear() &&
    startDate.getMonth() === endDate.getMonth() &&
    startDate.getDate() === endDate.getDate();

  if (sameDay) {
    return `${startDate.toLocaleDateString()} · ${startDate.toLocaleTimeString(
      [],
      {
        hour: "numeric",
        minute: "2-digit",
      },
    )} - ${endDate.toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    })}`;
  }

  return `${fmtDateTime(start)} — ${fmtDateTime(end)}`;
}

function fileToBase64(file, timeoutMs = 20000) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    const timer = setTimeout(() => {
      try {
        reader.abort();
      } catch {}
      reject(new Error(`File read timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    reader.onerror = () => {
      clearTimeout(timer);
      reject(new Error("Failed to read file"));
    };

    reader.onload = () => {
      clearTimeout(timer);
      const result = String(reader.result || "");
      const commaIndex = result.indexOf(",");
      if (commaIndex === -1) {
        reject(new Error("Invalid file encoding"));
        return;
      }
      resolve(result.slice(commaIndex + 1));
    };

    reader.readAsDataURL(file);
  });
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
      } catch {
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!centerId) {
      setClasses([]);
      setStaffUsers([]);
      setEvaluationTeachers([]);
      return;
    }
    (async () => {
      try {
        const [cls, staff, teachers] = await Promise.all([
          apiJson(`/api/v1/classes?centerId=${centerId}`).catch(() => []),
          apiJson(`/api/v1/users?centerId=${centerId}&staffOnly=true`).catch(
            () => [],
          ),
          apiJson(
            `/api/v1/users?centerId=${centerId}&roles=TEACHER,OTHER_STAFF,COACH`,
          ).catch(
            () => [],
          ),
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
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-lg">
                  👥
                </span>
                Staff Management
              </h2>
              <p className="mt-1.5 text-sm text-gray-500">
                Track attendance, manage time-off requests, log training hours,
                oversee budgets, and conduct evaluations.
              </p>
            </div>
            {/* Center Selector */}
            <div className="min-w-[220px]">
              <div className="mb-1.5 text-xs font-bold uppercase tracking-wider text-gray-400">
                Center
              </div>
              <select
                value={centerId}
                onChange={(e) => setCenterId(e.target.value)}
                disabled={loading}
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm font-semibold text-gray-900 focus:border-blue-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100"
              >
                <option value="">Select a center…</option>
                {centers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Center info pill */}
          {selectedCenter && (
            <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-800">
              <span className="h-2 w-2 rounded-full bg-blue-500" />
              {selectedCenter.name} — {staffUsers.length} staff,{" "}
              {classes.length} classroom{classes.length !== 1 ? "s" : ""}
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
          <EmptyCard
            icon="🏫"
            title="No center selected"
            msg="Select a center above to manage staff."
          />
        ) : (
          <>
            {activeTab === "checklists" && (
              <ChecklistsTab centerId={centerId} teachers={evaluationTeachers} />
            )}
            {activeTab === "attendance" && (
              <AttendanceTab centerId={centerId} teachers={staffUsers} />
            )}
            {activeTab === "time-off" && (
              <TimeOffTab centerId={centerId} teachers={staffUsers} />
            )}
            {activeTab === "training" && (
              <TrainingManagementTab
                centerId={centerId}
                teachers={staffUsers}
              />
            )}
            {activeTab === "budgets" && (
              <BudgetsTab centerId={centerId} classes={classes} />
            )}
            {activeTab === "evaluations" && (
              <EvaluationsTab
                centerId={centerId}
                teachers={evaluationTeachers}
              />
            )}
          </>
        )}
      </div>
    </AdminLayout>
  );
}

// ─── Checklists Tab ──────────────────────────────────────────

function ChecklistsTab({ centerId, teachers }) {
  const [rangeFrom, setRangeFrom] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  });
  const [rangeTo, setRangeTo] = useState(today());
  const [overview, setOverview] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedStaffId, setSelectedStaffId] = useState("");
  const [detailDate, setDetailDate] = useState(today());
  const [detailChecklists, setDetailChecklists] = useState([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");

  const loadOverview = useCallback(async () => {
    if (!centerId) {
      setOverview([]);
      return;
    }
    setLoading(true);
    try {
      const qs = new URLSearchParams({ centerId, from: rangeFrom, to: rangeTo });
      const data = await apiJson(
        `/api/v1/analytics/staff-checklist-overview?${qs.toString()}`,
      );
      setOverview(Array.isArray(data?.staff) ? data.staff : []);
    } catch {
      setOverview([]);
    } finally {
      setLoading(false);
    }
  }, [centerId, rangeFrom, rangeTo]);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  const loadDetail = useCallback(async () => {
    if (!centerId || !selectedStaffId || !detailDate) {
      setDetailChecklists([]);
      return;
    }
    setDetailLoading(true);
    setDetailError("");
    try {
      const qs = new URLSearchParams({ centerId, date: detailDate });
      const data = await apiJson(`/api/v1/daily-checklists?${qs.toString()}`);
      const lists = Array.isArray(data) ? data : [];
      const forStaff = lists.filter((checklist) =>
        getChecklistAssignedUserIds(checklist).includes(selectedStaffId),
      );
      setDetailChecklists(forStaff);
    } catch (error) {
      setDetailError(error?.message || "Failed to load checklist");
      setDetailChecklists([]);
    } finally {
      setDetailLoading(false);
    }
  }, [centerId, selectedStaffId, detailDate]);

  useEffect(() => {
    loadDetail();
  }, [loadDetail]);

  const rosterRows = useMemo(() => {
    const byId = new Map(overview.map((s) => [s.id, s]));
    return teachers.map((teacher) => {
      const stats = byId.get(teacher.id);
      return (
        stats || {
          id: teacher.id,
          name: teacher.name,
          email: teacher.email,
          role: teacher.role,
          assignedCount: 0,
          completedCount: 0,
          pct: null,
        }
      );
    });
  }, [teachers, overview]);

  const selectedStaff = rosterRows.find((row) => row.id === selectedStaffId) || null;

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <SectionTitle icon="✅" title="Checklist Grades" />
          <div className="flex flex-wrap items-end gap-3">
            <FilterInput label="From" type="date" value={rangeFrom} onChange={setRangeFrom} />
            <FilterInput label="To" type="date" value={rangeTo} onChange={setRangeTo} />
          </div>
        </div>
        <p className="mt-1 text-sm text-gray-500">
          Percentage of assigned daily checklist items each staff member has completed
          in the selected range. Click a row to see exactly what they checked off on a
          given day.
        </p>

        {loading ? (
          <Loading />
        ) : rosterRows.length === 0 ? (
          <div className="mt-6 py-8 text-center text-sm text-gray-500">
            No staff found for this center.
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-xl border border-gray-100">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50/80 text-left text-xs font-bold uppercase tracking-wider text-gray-400">
                  <th className="px-4 py-3">Employee</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Completed</th>
                  <th className="px-4 py-3">Assigned Items/Day</th>
                  <th className="px-4 py-3">Checklist Grade</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {rosterRows.map((row) => (
                  <tr
                    key={row.id}
                    onClick={() =>
                      setSelectedStaffId((current) => (current === row.id ? "" : row.id))
                    }
                    className={[
                      "cursor-pointer border-b border-gray-50 transition hover:bg-blue-50/30",
                      selectedStaffId === row.id ? "bg-blue-50/60" : "",
                    ].join(" ")}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-800 to-sky-600 text-[10px] font-bold text-white">
                          {getInitials(row.name)}
                        </div>
                        <span className="font-semibold text-gray-900">
                          {row.name || row.email}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{formatRole(row.role)}</td>
                    <td className="px-4 py-3 text-gray-600">{row.completedCount}</td>
                    <td className="px-4 py-3 text-gray-600">{row.assignedCount}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold ${checklistGradeColor(row.pct)}`}
                      >
                        {row.pct == null ? "No data" : `${row.pct}%`}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-xs font-semibold text-blue-700">
                      {selectedStaffId === row.id ? "Hide ↑" : "View →"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {selectedStaffId && (
        <Card>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <SectionTitle
              icon="🗓️"
              title={`${selectedStaff?.name || selectedStaff?.email || "Staff member"}'s Checklist`}
            />
            <div className="flex items-end gap-3">
              <FilterInput
                label="Date"
                type="date"
                value={detailDate}
                onChange={setDetailDate}
              />
              <button
                type="button"
                onClick={() => setSelectedStaffId("")}
                className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-600 transition hover:bg-gray-50"
              >
                Close
              </button>
            </div>
          </div>

          {detailError ? (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {detailError}
            </div>
          ) : null}

          {detailLoading ? (
            <Loading />
          ) : detailChecklists.length === 0 ? (
            <div className="mt-6 py-8 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-xl">
                📋
              </div>
              <p className="mt-3 text-sm font-semibold text-gray-600">
                No checklist items assigned to {selectedStaff?.name || "this employee"}{" "}
                for {fmtDate(detailDate)}.
              </p>
            </div>
          ) : (
            <div className="mt-4 space-y-4">
              {detailChecklists.map((checklist) => (
                <div key={checklist.id} className="rounded-xl border border-gray-100 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-gray-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-gray-600">
                      {CHECKLIST_CATEGORY_LABELS[checklist.category] || checklist.category}
                    </span>
                    <span className="text-sm font-extrabold text-gray-900">
                      {checklist.title}
                    </span>
                  </div>
                  <div className="mt-3 space-y-2">
                    {(checklist.items || []).map((item) => {
                      const completion = (item.completions || []).find(
                        (c) => c.completedById === selectedStaffId,
                      );
                      return (
                        <div
                          key={item.id}
                          className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2 ${
                            completion
                              ? "border-emerald-200 bg-emerald-50/50"
                              : "border-gray-100 bg-gray-50/50"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span
                              className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                                completion
                                  ? "bg-emerald-500 text-white"
                                  : "border border-gray-300 bg-white text-transparent"
                              }`}
                            >
                              ✓
                            </span>
                            <span className="text-sm font-medium text-gray-800">
                              {item.title}
                            </span>
                          </div>
                          <span className="text-xs text-gray-500">
                            {completion
                              ? `Checked ${fmtDateTime(completion.completedAt)}`
                              : "Not checked off"}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}
    </div>
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
  const [hoursFrom, setHoursFrom] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  });
  const [hoursTo, setHoursTo] = useState(today());
  const [hoursReport, setHoursReport] = useState([]);
  const [hoursLoading, setHoursLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [form, setForm] = useState(ATTENDANCE_INITIAL_FORM);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState("");
  const [importResult, setImportResult] = useState(null);
  const [importFileName, setImportFileName] = useState("");
  const [importFileBase64, setImportFileBase64] = useState("");
  const [overwriteImportedRows, setOverwriteImportedRows] = useState(true);

  const loadRecords = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiJson(
        `/api/v1/staff-attendance?centerId=${centerId}&from=${date}&to=${date}`,
      );
      setRecords(Array.isArray(data) ? data : []);
    } catch {
    } finally {
      setLoading(false);
    }
  }, [centerId, date]);

  useEffect(() => {
    loadRecords();
  }, [loadRecords]);

  const loadSummary = useCallback(async () => {
    if (!summaryUserId) {
      setSummary(null);
      setSummaryRecords([]);
      return;
    }
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

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  const loadHoursReport = useCallback(async () => {
    setHoursLoading(true);
    try {
      const qs = new URLSearchParams({ centerId, from: hoursFrom, to: hoursTo });
      const data = await apiJson(`/api/v1/staff-attendance/summary?${qs.toString()}`);
      setHoursReport(Array.isArray(data?.reportByUser) ? data.reportByUser : []);
    } catch {
    } finally {
      setHoursLoading(false);
    }
  }, [centerId, hoursFrom, hoursTo]);

  useEffect(() => {
    loadHoursReport();
  }, [loadHoursReport]);

  const handlePrintHoursReport = useCallback(() => {
    const rows = hoursReport;
    const html = `
      <html>
        <head>
          <title>Staff Hours Worked Report</title>
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
          <h1>Staff Hours Worked Report</h1>
          <div class="meta">Period: ${escapeHtml(hoursFrom)} to ${escapeHtml(hoursTo)} | Employees: ${rows.length}</div>
          <table>
            <thead><tr><th>#</th><th>Employee</th><th>Total Hours</th><th>Present</th><th>Late</th><th>Absent</th><th>Half Day</th></tr></thead>
            <tbody>
              ${rows
                .map(
                  (r, i) =>
                    `<tr><td>${i + 1}</td><td>${escapeHtml(r.name)}</td><td>${r.totalHours.toFixed(2)}</td><td>${r.present}</td><td>${r.late}</td><td>${r.absent}</td><td>${r.halfDay}</td></tr>`,
                )
                .join("")}
            </tbody>
          </table>
        </body>
      </html>
    `;
    const win = window.open("", "_blank", "width=1000,height=800");
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.focus();
    win.print();
  }, [hoursReport, hoursFrom, hoursTo]);

  const closeForm = useCallback(() => {
    setShowForm(false);
    setForm(ATTENDANCE_INITIAL_FORM);
  }, []);

  const closeImport = useCallback(() => {
    setShowImport(false);
    setImporting(false);
    setImportError("");
    setImportResult(null);
    setImportFileName("");
    setImportFileBase64("");
    setOverwriteImportedRows(true);
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.userId) return;
    setSaving(true);
    try {
      await apiJson("/api/v1/staff-attendance", {
        method: "POST",
        body: JSON.stringify({
          centerId,
          userId: form.userId,
          date,
          status: form.status,
          clockIn: form.clockIn || null,
          clockOut: form.clockOut || null,
          lateMinutes: parseInt(form.lateMinutes) || 0,
          notes: form.notes || null,
        }),
      });
      closeForm();
      loadRecords();
    } catch {
    } finally {
      setSaving(false);
    }
  };

  const handleImportFile = useCallback(async (file) => {
    if (!file) {
      setImportFileName("");
      setImportFileBase64("");
      return;
    }

    setImportError("");
    setImportResult(null);

    try {
      const base64 = await fileToBase64(file);
      setImportFileName(file.name || "timesheet");
      setImportFileBase64(base64);
    } catch (error) {
      setImportFileName("");
      setImportFileBase64("");
      setImportError(error?.message || "Failed to read file");
    }
  }, []);

  const submitImport = useCallback(async (event) => {
    event.preventDefault();
    if (!importFileBase64) {
      setImportError("Choose a CSV or Excel timesheet first.");
      return;
    }

    setImporting(true);
    setImportError("");
    setImportResult(null);
    try {
      const result = await apiJson("/api/v1/staff-attendance/import", {
        method: "POST",
        body: JSON.stringify({
          centerId,
          fileName: importFileName,
          fileBase64: importFileBase64,
          overwriteExisting: overwriteImportedRows,
        }),
        timeoutMs: 120000,
      });
      setImportResult(result);
      await loadRecords();
      await loadSummary();
    } catch (error) {
      setImportError(error?.message || "Failed to import timesheet");
    } finally {
      setImporting(false);
    }
  }, [centerId, importFileBase64, importFileName, loadRecords, loadSummary, overwriteImportedRows]);

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
          <MiniStat
            icon="✓"
            label="Present"
            value={todayStats.present}
            colorClass="text-emerald-700 bg-emerald-50 border-emerald-200"
          />
          <MiniStat
            icon="⏰"
            label="Late"
            value={todayStats.late}
            colorClass="text-amber-700 bg-amber-50 border-amber-200"
          />
          <MiniStat
            icon="✕"
            label="Absent"
            value={todayStats.absent}
            colorClass="text-red-700 bg-red-50 border-red-200"
          />
          <MiniStat
            icon="½"
            label="Half Day"
            value={todayStats.halfDay}
            colorClass="text-sky-700 bg-sky-50 border-sky-200"
          />
        </div>
      )}

      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <FilterInput
              label="Date"
              type="date"
              value={date}
              onChange={setDate}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <SecondaryButton onClick={() => setShowImport(true)}>
              Import Timesheet
            </SecondaryButton>
            <PrimaryButton onClick={() => setShowForm(true)}>
              + Record Attendance
            </PrimaryButton>
          </div>
        </div>

        {loading ? (
          <Loading />
        ) : records.length === 0 ? (
          <div className="mt-6 py-8 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-xl">
              📋
            </div>
            <p className="mt-3 text-sm font-semibold text-gray-600">
              No attendance records for this date.
            </p>
            <p className="mt-1 text-xs text-gray-400">
              Record attendance using the button above.
            </p>
          </div>
        ) : (
          <div className="mt-4 space-y-2">
            {records.map((r) => {
              const badge =
                ATT_STATUS_BADGE[r.status] || ATT_STATUS_BADGE.PRESENT;
              return (
                <div
                  key={r.id}
                  className="flex flex-wrap items-center gap-4 rounded-xl border border-gray-100 bg-gray-50/50 px-4 py-3 transition hover:border-gray-200 hover:bg-white"
                >
                  {/* Avatar */}
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-800 to-sky-600 text-xs font-bold text-white">
                    {getInitials(r.user?.name)}
                  </div>
                  {/* Name */}
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-bold text-gray-900">
                      {r.user?.name || "—"}
                    </div>
                    <div className="text-xs text-gray-500">
                      {r.clockIn
                        ? new Date(r.clockIn).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "—"}
                      {" → "}
                      {r.clockOut
                        ? new Date(r.clockOut).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "—"}
                    </div>
                  </div>
                  {/* Status */}
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${badge.bg}`}
                  >
                    <span>{badge.icon}</span>
                    {(r.status || "").replace(/_/g, " ")}
                  </span>
                  {/* Late + Notes */}
                  {r.lateMinutes > 0 && (
                    <span className="text-xs font-semibold text-amber-600">
                      {r.lateMinutes}m late
                    </span>
                  )}
                  {r.notes && (
                    <span
                      className="max-w-[200px] truncate text-xs text-gray-400"
                      title={r.notes}
                    >
                      {r.notes}
                    </span>
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
          <FilterSelect
            label="Employee"
            value={summaryUserId}
            onChange={setSummaryUserId}
          >
            <option value="">Select employee…</option>
            {teachers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </FilterSelect>
          <FilterInput
            label="From"
            type="date"
            value={summaryFrom}
            onChange={setSummaryFrom}
          />
          <FilterInput
            label="To"
            type="date"
            value={summaryTo}
            onChange={setSummaryTo}
          />
        </div>
        {summary && (
          <div className="mt-4 space-y-4">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
              <KpiCard
                label="Total Days"
                value={summary.totalDays}
                color="gray"
              />
              <KpiCard
                label="Present"
                value={summary.present}
                color="emerald"
              />
              <KpiCard label="Late" value={summary.late} color="amber" />
              <KpiCard label="Absent" value={summary.absent} color="red" />
              <KpiCard
                label="Late Minutes"
                value={summary.totalLateMinutes}
                color="amber"
              />
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
                  {summaryRecords.length ? (
                    summaryRecords.map((record) => (
                      <tr key={record.id} className="border-b border-gray-50">
                        <td className="px-4 py-3 text-gray-700">
                          {fmtDate(record.date)}
                        </td>
                        <td className="px-4 py-3 font-semibold text-gray-900">
                          {String(record.status || "").replace(/_/g, " ")}
                        </td>
                        <td className="px-4 py-3 text-gray-700">
                          {record.clockIn
                            ? new Date(record.clockIn).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : "—"}
                        </td>
                        <td className="px-4 py-3 text-gray-700">
                          {record.clockOut
                            ? new Date(record.clockOut).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : "—"}
                        </td>
                        <td className="px-4 py-3 text-gray-700">
                          {record.lateMinutes || 0}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-4 py-6 text-center text-sm text-gray-500"
                      >
                        No attendance records in this range.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Card>

      {/* Hours Worked Report */}
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SectionTitle icon="⏱️" title="Hours Worked Report" />
          <SecondaryButton
            onClick={handlePrintHoursReport}
            disabled={!hoursReport.length}
          >
            Print Report
          </SecondaryButton>
        </div>
        <p className="mt-1 text-sm text-gray-500">
          Total hours worked per employee for the selected date range, ranked
          highest to lowest.
        </p>
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
          <FilterInput
            label="From"
            type="date"
            value={hoursFrom}
            onChange={setHoursFrom}
          />
          <FilterInput
            label="To"
            type="date"
            value={hoursTo}
            onChange={setHoursTo}
          />
        </div>
        {hoursLoading ? (
          <Loading />
        ) : (
          <div className="mt-4 overflow-x-auto rounded-xl border border-gray-100">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50/80 text-left text-xs font-bold uppercase tracking-wider text-gray-400">
                  <th className="px-4 py-3">#</th>
                  <th className="px-4 py-3">Employee</th>
                  <th className="px-4 py-3">Total Hours</th>
                  <th className="px-4 py-3">Present</th>
                  <th className="px-4 py-3">Late</th>
                  <th className="px-4 py-3">Absent</th>
                  <th className="px-4 py-3">Half Day</th>
                </tr>
              </thead>
              <tbody>
                {hoursReport.length ? (
                  hoursReport.map((row, idx) => (
                    <tr key={row.userId} className="border-b border-gray-50">
                      <td className="px-4 py-3 text-gray-500">{idx + 1}</td>
                      <td className="px-4 py-3 font-semibold text-gray-900">
                        {row.name}
                      </td>
                      <td className="px-4 py-3 font-bold text-gray-900">
                        {row.totalHours.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-gray-700">
                        {row.present}
                      </td>
                      <td className="px-4 py-3 text-gray-700">{row.late}</td>
                      <td className="px-4 py-3 text-gray-700">
                        {row.absent}
                      </td>
                      <td className="px-4 py-3 text-gray-700">
                        {row.halfDay}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-4 py-6 text-center text-sm text-gray-500"
                    >
                      No attendance records in this range.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
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
              <FilterSelect
                label="Employee"
                value={form.userId}
                onChange={(v) => setForm({ ...form, userId: v })}
              >
                <option value="">Select employee…</option>
                {teachers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </FilterSelect>
              <FilterSelect
                label="Status"
                value={form.status}
                onChange={(v) => setForm({ ...form, status: v })}
              >
                <option value="PRESENT">Present</option>
                <option value="LATE">Late</option>
                <option value="ABSENT">Absent</option>
                <option value="HALF_DAY">Half Day</option>
              </FilterSelect>
              <FilterInput
                label="Clock In"
                type="time"
                value={form.clockIn}
                onChange={(v) => setForm({ ...form, clockIn: v })}
              />
              <FilterInput
                label="Clock Out"
                type="time"
                value={form.clockOut}
                onChange={(v) => setForm({ ...form, clockOut: v })}
              />
              <FilterInput
                label="Late Minutes"
                type="number"
                value={form.lateMinutes}
                onChange={(v) => setForm({ ...form, lateMinutes: v })}
              />
              <FilterInput
                label="Notes"
                type="text"
                value={form.notes}
                onChange={(v) => setForm({ ...form, notes: v })}
              />
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
      {showImport && (
        <ModalShell
          title="Import Staff Timesheet"
          subtitle="Upload a CSV, XLSX, or XLS file from your kiosk or payroll export."
          onClose={closeImport}
        >
          <form onSubmit={submitImport} className="space-y-5">
            <div className="rounded-xl border border-blue-100 bg-blue-50/40 p-4 text-sm text-gray-700">
              <div className="font-semibold text-gray-900">
                Accepted columns
              </div>
              <div className="mt-2">
                <code>Employee Name</code> or <code>Email</code>, <code>Date</code>, <code>Clock In</code> or <code>Sign In</code>, <code>Clock Out</code> or <code>Sign Out</code>, optional <code>Status</code>, optional <code>Late Minutes</code>, and optional <code>Notes</code>.
              </div>
            </div>

            <label className="block">
              <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                Timesheet File
              </div>
              <input
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={(event) => handleImportFile(event.target.files?.[0] || null)}
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm font-medium text-gray-900 focus:border-blue-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100"
                disabled={importing}
              />
              {importFileName ? (
                <div className="mt-2 text-xs text-gray-500">
                  Selected: {importFileName}
                </div>
              ) : null}
            </label>

            <label className="flex items-start gap-3 rounded-xl border border-gray-200 bg-gray-50/60 px-4 py-3 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={overwriteImportedRows}
                onChange={(event) => setOverwriteImportedRows(event.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                disabled={importing}
              />
              <span>
                Overwrite existing attendance rows when the employee and date already exist.
              </span>
            </label>

            {importError ? (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {importError}
              </div>
            ) : null}

            {importResult ? (
              <div className="space-y-3 rounded-xl border border-emerald-200 bg-emerald-50/40 p-4">
                <div className="text-sm font-semibold text-emerald-900">
                  Import complete from {importResult.worksheet || "worksheet"}.
                </div>
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                  <KpiCard label="Imported" value={importResult.importedCount || 0} color="emerald" />
                  <KpiCard label="Created" value={importResult.createdCount || 0} color="blue" />
                  <KpiCard label="Updated" value={importResult.updatedCount || 0} color="sky" />
                  <KpiCard label="Skipped" value={importResult.skippedCount || 0} color="gray" />
                </div>
                {Array.isArray(importResult.errors) && importResult.errors.length ? (
                  <div className="rounded-xl border border-amber-200 bg-white px-4 py-3 text-sm text-amber-900">
                    <div className="font-semibold">Rows needing review</div>
                    <div className="mt-2 space-y-1 text-xs text-amber-800">
                      {importResult.errors.map((message, index) => (
                        <div key={`${message}-${index}`}>{message}</div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="flex flex-wrap justify-end gap-3 border-t border-gray-100 pt-4">
              <button
                type="button"
                onClick={closeImport}
                className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-600 transition hover:bg-gray-50"
                disabled={importing}
              >
                Close
              </button>
              <button
                type="submit"
                className="rounded-xl bg-gradient-to-r from-blue-800 to-sky-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:from-blue-900 hover:to-sky-700 disabled:opacity-50"
                disabled={importing || !importFileBase64}
              >
                {importing ? "Importing…" : "Import Timesheet"}
              </button>
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
  const [requestFrom, setRequestFrom] = useState(() => today());
  const [requestTo, setRequestTo] = useState(() => addDays(today(), 60));
  const [loading, setLoading] = useState(false);
  const [reviewTarget, setReviewTarget] = useState(null);
  const [reviewStatus, setReviewStatus] = useState("");
  const [reviewNotes, setReviewNotes] = useState("");
  const [coverageName, setCoverageName] = useState("");
  const [reviewSaving, setReviewSaving] = useState(false);
  const [reviewError, setReviewError] = useState("");
  const [balanceUserId, setBalanceUserId] = useState("");
  const [balanceData, setBalanceData] = useState(null);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [balanceError, setBalanceError] = useState("");
  const [bulkEarnedDate, setBulkEarnedDate] = useState(() => today());
  const [bulkNote, setBulkNote] = useState("");
  const [bulkHours, setBulkHours] = useState({});
  const [bulkSaving, setBulkSaving] = useState(false);
  const [bulkError, setBulkError] = useState("");
  const [bulkSuccess, setBulkSuccess] = useState("");
  const [calYear, setCalYear] = useState(() => new Date().getFullYear());
  const [calMonth, setCalMonth] = useState(() => new Date().getMonth());
  const [calEvents, setCalEvents] = useState([]);
  const [selectedDay, setSelectedDay] = useState(null);
  const [unexcusedOpen, setUnexcusedOpen] = useState(false);
  const [unexcusedForm, setUnexcusedForm] = useState({
    userId: "",
    date: today(),
    startTime: "08:00",
    endTime: "17:00",
    coverageName: "",
    notes: "",
  });
  const [unexcusedSaving, setUnexcusedSaving] = useState(false);
  const [unexcusedError, setUnexcusedError] = useState("");
  const [expandedGroups, setExpandedGroups] = useState({});

  const toggleGroupExpanded = useCallback((key) => {
    setExpandedGroups((current) => ({ ...current, [key]: !current[key] }));
  }, []);

  useEffect(() => {
    if (!teachers.length) {
      setBalanceUserId("");
      return;
    }
    setBalanceUserId((current) =>
      current && teachers.some((teacher) => teacher.id === current)
        ? current
        : teachers[0].id,
    );
  }, [teachers]);

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

  const calDayItems = useMemo(() => {
    if (!selectedDay) return [];
    const day = new Date(calYear, calMonth, selectedDay);
    return calEvents.filter((evt) => {
      const start = toCalendarDay(evt.startDate, { allDay: !!evt.allDay });
      const end = toCalendarDay(evt.endDate, { allDay: !!evt.allDay });
      if (!start || !end) return false;
      return day >= start && day <= end;
    });
  }, [calEvents, calYear, calMonth, selectedDay]);

  const loadRequests = useCallback(async () => {
    if (!centerId) {
      setRequests([]);
      return;
    }
    setLoading(true);
    try {
      const qs = new URLSearchParams({
        centerId,
        ...(statusFilter ? { status: statusFilter } : {}),
        ...(requestFrom ? { from: requestFrom } : {}),
        ...(requestTo ? { to: requestTo } : {}),
      });
      const data = await apiJson(`/api/v1/time-off?${qs.toString()}`);
      setRequests(Array.isArray(data) ? data : []);
    } catch {
      setRequests([]);
    } finally {
      setLoading(false);
    }
  }, [centerId, requestFrom, requestTo, statusFilter]);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  const loadBalanceData = useCallback(async () => {
    if (!centerId || !balanceUserId) {
      setBalanceData(null);
      return;
    }
    setBalanceLoading(true);
    setBalanceError("");
    try {
      const qs = new URLSearchParams({
        centerId,
        userId: balanceUserId,
      });
      const data = await apiJson(`/api/v1/time-off/balances?${qs.toString()}`);
      setBalanceData(data);
    } catch (error) {
      setBalanceData(null);
      setBalanceError(error?.message || "Failed to load time-off balances");
    } finally {
      setBalanceLoading(false);
    }
  }, [balanceUserId, centerId]);

  useEffect(() => {
    loadBalanceData();
  }, [loadBalanceData]);

  const openReview = useCallback((request, status) => {
    setReviewTarget(request);
    setReviewStatus(status);
    setReviewNotes(status === "APPROVED" ? request?.reviewNotes || "" : "");
    setCoverageName(
      status === "APPROVED" || status === "EDIT_COVERAGE"
        ? request?.coverageName || ""
        : "",
    );
    setReviewError("");
  }, []);

  const closeReview = useCallback(() => {
    setReviewTarget(null);
    setReviewStatus("");
    setReviewNotes("");
    setCoverageName("");
    setReviewSaving(false);
    setReviewError("");
  }, []);

  const handleAction = async () => {
    if (!reviewTarget?.id || !reviewStatus) return;
    setReviewSaving(true);
    setReviewError("");
    try {
      const body =
        reviewStatus === "EDIT_COVERAGE"
          ? { coverageName }
          : {
              status: reviewStatus,
              reviewNotes,
              coverageName: reviewStatus === "APPROVED" ? coverageName : "",
            };
      await apiJson(`/api/v1/time-off/${reviewTarget.id}`, {
        method: "PUT",
        body: JSON.stringify(body),
      });
      const reviewedUserId = reviewTarget?.user?.id || "";
      closeReview();
      await loadRequests();
      if (reviewedUserId && reviewedUserId === balanceUserId) {
        await loadBalanceData();
      }
    } catch (error) {
      setReviewError(error?.message || "Failed to update request");
      setReviewSaving(false);
    }
  };

  const updateBulkHour = useCallback((userId, field, value) => {
    setBulkHours((current) => ({
      ...current,
      [userId]: { ...current[userId], [field]: value },
    }));
  }, []);

  const handleBulkSave = async () => {
    if (!centerId) return;
    const entries = teachers
      .map((teacher) => ({
        userId: teacher.id,
        paidHours: bulkHours[teacher.id]?.paid || "",
        unpaidHours: bulkHours[teacher.id]?.unpaid || "",
      }))
      .filter((entry) => Number(entry.paidHours) > 0 || Number(entry.unpaidHours) > 0);

    if (!entries.length) {
      setBulkError("Enter paid hours, unpaid hours, or both for at least one employee.");
      setBulkSuccess("");
      return;
    }

    setBulkSaving(true);
    setBulkError("");
    setBulkSuccess("");
    try {
      await apiJson("/api/v1/time-off/balances", {
        method: "POST",
        body: JSON.stringify({
          centerId,
          earnedDate: bulkEarnedDate,
          note: bulkNote || null,
          entries,
        }),
      });
      setBulkHours({});
      setBulkNote("");
      setBulkSuccess(
        `Added balance hours for ${entries.length} employee${entries.length === 1 ? "" : "s"}.`,
      );
      if (balanceUserId) {
        await loadBalanceData();
      }
    } catch (error) {
      setBulkError(error?.message || "Failed to save time-off balances");
    } finally {
      setBulkSaving(false);
    }
  };

  const openUnexcusedForm = useCallback(() => {
    setUnexcusedForm({
      userId: teachers[0]?.id || "",
      date: today(),
      startTime: "08:00",
      endTime: "17:00",
      coverageName: "",
      notes: "",
    });
    setUnexcusedError("");
    setUnexcusedOpen(true);
  }, [teachers]);

  const closeUnexcusedForm = useCallback(() => {
    setUnexcusedOpen(false);
    setUnexcusedSaving(false);
    setUnexcusedError("");
  }, []);

  const handleUnexcusedSave = async () => {
    if (!centerId || !unexcusedForm.userId) {
      setUnexcusedError("Select an employee.");
      return;
    }
    const start = new Date(`${unexcusedForm.date}T${unexcusedForm.startTime}`);
    const end = new Date(`${unexcusedForm.date}T${unexcusedForm.endTime}`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      setUnexcusedError("Enter a valid date and time range.");
      return;
    }
    if (end <= start) {
      setUnexcusedError("End time must be after start time.");
      return;
    }

    setUnexcusedSaving(true);
    setUnexcusedError("");
    try {
      await apiJson("/api/v1/time-off", {
        method: "POST",
        body: JSON.stringify({
          centerId,
          userId: unexcusedForm.userId,
          type: "UNEXCUSED",
          startDate: start.toISOString(),
          endDate: end.toISOString(),
          coverageName: unexcusedForm.coverageName || null,
          reason: unexcusedForm.notes || null,
        }),
      });
      const savedUserId = unexcusedForm.userId;
      closeUnexcusedForm();
      await loadRequests();
      await loadCalendarEvents();
      if (savedUserId === balanceUserId) {
        await loadBalanceData();
      }
    } catch (error) {
      setUnexcusedError(error?.message || "Failed to save unexcused time off");
      setUnexcusedSaving(false);
    }
  };

  const pending = requests.filter((r) => r.status === "PENDING");
  const rest = requests.filter((r) => r.status !== "PENDING");
  const tableRows = statusFilter ? requests : rest;
  const fullGroupSizeByKey = useMemo(() => {
    const map = new Map();
    for (const r of requests) {
      const key = r.requestGroupId || r.id;
      map.set(key, (map.get(key) || 0) + 1);
    }
    return map;
  }, [requests]);
  const pendingGroups = useMemo(
    () => groupTimeOffRequests(pending, fullGroupSizeByKey),
    [pending, fullGroupSizeByKey],
  );
  const groupDayLabelById = useMemo(() => {
    const byKey = new Map();
    for (const r of requests) {
      const key = r.requestGroupId || r.id;
      if (!byKey.has(key)) byKey.set(key, []);
      byKey.get(key).push(r);
    }
    const labels = new Map();
    for (const items of byKey.values()) {
      if (items.length < 2) continue;
      const sorted = [...items].sort(
        (a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime(),
      );
      sorted.forEach((item, idx) => {
        labels.set(item.id, `Day ${idx + 1} of ${sorted.length}`);
      });
    }
    return labels;
  }, [requests]);
  const selectedBalanceUser =
    teachers.find((teacher) => teacher.id === balanceUserId) || null;
  const balanceSummary = balanceData?.summary || null;
  const balanceEntries = Array.isArray(balanceData?.entries)
    ? balanceData.entries
    : [];

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={openUnexcusedForm}
          disabled={!teachers.length}
          className="rounded-xl bg-red-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-red-700 disabled:opacity-50"
        >
          + Enter Unexcused Time Off
        </button>
      </div>
      <Card>
        <SectionTitle icon="🗓️" title="Calendar" />
        <p className="mt-1 text-sm text-gray-500">
          Center events plus pending and approved time-off requests for all staff.
        </p>
        <div className="mt-3 grid grid-cols-1 gap-4 lg:grid-cols-[1fr_minmax(0,280px)]">
          <MonthlyCalendar
            year={calYear}
            month={calMonth}
            events={calEvents}
            legendItems={TIMEOFF_CALENDAR_LEGEND}
            selectedDay={selectedDay}
            onDayClick={setSelectedDay}
            onMonthChange={(nextYear, nextMonth) => {
              setCalYear(nextYear);
              setCalMonth(nextMonth);
              setSelectedDay(null);
            }}
          />

          {selectedDay ? (
            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-extrabold text-gray-900">
                  {new Date(calYear, calMonth, selectedDay).toLocaleDateString(undefined, {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                  })}
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedDay(null)}
                  aria-label="Close day detail"
                  className="text-gray-400 hover:text-gray-600"
                >
                  &#10005;
                </button>
              </div>

              {calDayItems.length === 0 ? (
                <div className="mt-3 text-sm text-gray-500">No items this day.</div>
              ) : (
                <div className="mt-3 space-y-2">
                  {calDayItems.map((item) => (
                    <div key={item.id} className="rounded-xl border border-gray-200 bg-white p-3">
                      <div className="flex items-center gap-2">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold ${
                            item._source === "event"
                              ? "bg-indigo-100 text-indigo-700"
                              : item.isUnexcused
                                ? "bg-red-100 text-red-700"
                                : "bg-emerald-100 text-emerald-700"
                          }`}
                        >
                          {item._source === "event"
                            ? "EVENT"
                            : item.isUnexcused
                              ? "UNEXCUSED"
                              : "TIME OFF"}
                        </span>
                        <span className="text-sm font-semibold text-gray-900">{item.label}</span>
                      </div>
                      {item._source === "event" && item.description ? (
                        <div className="mt-1 text-xs text-gray-600">{item.description}</div>
                      ) : null}
                      {item._source === "timeoff" ? (
                        <>
                          <div className="mt-1 text-xs text-gray-600">
                            Status: {item.status}
                            {!item.isUnexcused && item.reason ? ` • ${item.reason}` : ""}
                          </div>
                          <div className="mt-1 text-xs text-gray-600">
                            {fmtTimeOffRange(item.startDate, item.endDate)}
                          </div>
                          {item.isUnexcused ? (
                            <div className="mt-1 text-xs text-gray-600">
                              Cover: {item.coverageName || "Unassigned"}
                            </div>
                          ) : null}
                        </>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : null}
        </div>
      </Card>

      <Card>
        <SectionTitle icon="Hours" title="Time-Off Balances" />
        <p className="mt-1 text-sm text-gray-500">
          Enter the earned date once, then fill in paid and/or unpaid hours for anyone who earned time this round. Leave an employee's fields blank to skip them.
        </p>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 md:max-w-lg">
          <FilterInput label="Earned Date" type="date" value={bulkEarnedDate} onChange={setBulkEarnedDate} />
          <FilterInput label="Admin Note (optional)" type="text" value={bulkNote} onChange={setBulkNote} />
        </div>

        {bulkError ? (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {bulkError}
          </div>
        ) : null}
        {bulkSuccess ? (
          <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {bulkSuccess}
          </div>
        ) : null}

        <div className="mt-4 max-h-[480px] overflow-y-auto overflow-x-auto rounded-xl border border-gray-100">
          <table className="min-w-full text-sm">
            <thead className="sticky top-0">
              <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-bold uppercase tracking-wider text-gray-400">
                <th className="px-4 py-3">Employee</th>
                <th className="px-4 py-3">Paid Hours</th>
                <th className="px-4 py-3">Unpaid Hours</th>
              </tr>
            </thead>
            <tbody>
              {teachers.length ? (
                teachers.map((teacher) => (
                  <tr key={teacher.id} className="border-b border-gray-50">
                    <td className="px-4 py-2 font-semibold text-gray-900">
                      {teacher.name || teacher.email}
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="number"
                        min="0"
                        step="0.25"
                        placeholder="—"
                        value={bulkHours[teacher.id]?.paid || ""}
                        onChange={(e) => updateBulkHour(teacher.id, "paid", e.target.value)}
                        className="w-28 rounded-lg border border-gray-200 bg-gray-50 px-2 py-1.5 text-sm font-medium text-gray-900 focus:border-blue-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="number"
                        min="0"
                        step="0.25"
                        placeholder="—"
                        value={bulkHours[teacher.id]?.unpaid || ""}
                        onChange={(e) => updateBulkHour(teacher.id, "unpaid", e.target.value)}
                        className="w-28 rounded-lg border border-gray-200 bg-gray-50 px-2 py-1.5 text-sm font-medium text-gray-900 focus:border-blue-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100"
                      />
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="px-4 py-6 text-sm text-gray-500" colSpan={3}>
                    No employees found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={handleBulkSave}
            disabled={bulkSaving || !teachers.length}
            className="rounded-xl bg-gradient-to-r from-blue-800 to-sky-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:from-blue-900 hover:to-sky-700 disabled:opacity-50"
          >
            {bulkSaving ? "Saving..." : "Save Balance Hours"}
          </button>
        </div>

        <div className="mt-6 border-t border-gray-100 pt-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm font-extrabold text-gray-900">Employee History</div>
            <div className="w-full max-w-xs">
              <FilterSelect
                label="Employee"
                value={balanceUserId}
                onChange={setBalanceUserId}
                disabled={!teachers.length}
              >
                <option value="">Select employee</option>
                {teachers.map((teacher) => (
                  <option key={teacher.id} value={teacher.id}>
                    {teacher.name || teacher.email}
                  </option>
                ))}
              </FilterSelect>
            </div>
          </div>

          {balanceError ? (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {balanceError}
            </div>
          ) : null}

          {!selectedBalanceUser ? (
            <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
              Select an employee to view their paid and unpaid time-off balances.
            </div>
          ) : (
            <>
              <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                <KpiCard
                  label="Paid Available"
                  value={balanceLoading ? "..." : balanceSummary?.paidAvailable ?? 0}
                  color="emerald"
                />
                <KpiCard
                  label="Unpaid Available"
                  value={balanceLoading ? "..." : balanceSummary?.unpaidAvailable ?? 0}
                  color="sky"
                />
              </div>

              <div className="mt-4 overflow-x-auto rounded-xl border border-gray-100">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50/80 text-left text-xs font-bold uppercase tracking-wider text-gray-400">
                      <th className="px-4 py-3">Type</th>
                      <th className="px-4 py-3">Hours</th>
                      <th className="px-4 py-3">Earned Date</th>
                      <th className="px-4 py-3">Added By</th>
                      <th className="px-4 py-3">Note</th>
                    </tr>
                  </thead>
                  <tbody>
                    {balanceEntries.length ? (
                      balanceEntries.map((entry) => (
                        <tr
                          key={entry.id}
                          className="border-b border-gray-50 transition hover:bg-blue-50/30"
                        >
                          <td className="px-4 py-3 font-semibold text-gray-900">
                            {getTimeOffTypeLabel(entry.balanceType)}
                          </td>
                          <td className="px-4 py-3 text-gray-600">{entry.hours}</td>
                          <td className="px-4 py-3 text-gray-600">
                            {fmtDate(entry.earnedDate)}
                          </td>
                          <td className="px-4 py-3 text-gray-500">
                            {entry.createdBy?.name || entry.createdBy?.email || ""}
                          </td>
                          <td className="px-4 py-3 text-gray-500">{entry.note || ""}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td className="px-4 py-6 text-sm text-gray-500" colSpan={5}>
                          No balance entries have been added for {selectedBalanceUser.name || selectedBalanceUser.email}.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </Card>

      {/* Pending Requests */}
      {pending.length > 0 && (
        <div className="rounded-2xl border-2 border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50/30 p-6">
          <div className="flex items-center gap-2 text-sm font-extrabold text-amber-800">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-200/60 text-sm">
              🔔
            </span>
            Pending Requests
            <span className="ml-1 rounded-full bg-amber-200 px-2 py-0.5 text-xs font-bold text-amber-900">
              {pending.length}
            </span>
          </div>
          <div className="mt-4 space-y-3">
            {pendingGroups.map((group) => {
              const r = group.items[0];
              const expanded = !!expandedGroups[group.key];
              return (
                <div
                  key={group.key}
                  className="rounded-xl border border-amber-200 bg-white p-4 shadow-sm"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-800 to-sky-600 text-xs font-bold text-white">
                        {getInitials(r.user?.name)}
                      </div>
                      <div>
                        <div className="text-sm font-bold text-gray-900">
                          {r.user?.name}
                        </div>
                        <div className="text-xs text-gray-500">
                          <span className="font-semibold text-gray-700">
                            {r.typeLabel || getTimeOffTypeLabel(r.type)}
                          </span>
                          {" · "}
                          {fmtTimeOffRange(group.rangeStart, group.rangeEnd)}
                          {r.reason && (
                            <span className="ml-2 text-gray-400">({r.reason})</span>
                          )}
                          {group.isGrouped && (
                            <button
                              type="button"
                              onClick={() => toggleGroupExpanded(group.key)}
                              className="ml-2 font-semibold text-amber-700 underline decoration-dotted"
                            >
                              {group.items.length} of {group.fullGroupSize} day
                              {group.fullGroupSize === 1 ? "" : "s"} pending
                              {expanded ? " (hide days)" : " (review by day)"}
                            </button>
                          )}
                        </div>
                        <div className="mt-1 text-[11px] text-gray-400">
                          Submitted {fmtDateTime(r.createdAt)}
                        </div>
                      </div>
                    </div>
                    {!group.isGrouped && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => openReview(r, "APPROVED")}
                          className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 transition"
                        >
                          ✓ Approve
                        </button>
                        <button
                          onClick={() => openReview(r, "DENIED")}
                          className="rounded-lg bg-red-500 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-red-600 transition"
                        >
                          ✕ Deny
                        </button>
                      </div>
                    )}
                  </div>
                  {group.isGrouped && expanded && (
                    <div className="mt-3 space-y-2 border-t border-amber-100 pt-3">
                      {group.items.map((item) => (
                        <div
                          key={item.id}
                          className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-amber-50/60 px-3 py-2"
                        >
                          <span className="text-xs font-semibold text-gray-700">
                            {fmtTimeOffRange(item.startDate, item.endDate)}
                          </span>
                          <div className="flex gap-2">
                            <button
                              onClick={() => openReview(item, "APPROVED")}
                              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 transition"
                            >
                              ✓ Approve
                            </button>
                            <button
                              onClick={() => openReview(item, "DENIED")}
                              className="rounded-lg bg-red-500 px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-red-600 transition"
                            >
                              ✕ Deny
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* All Requests */}
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SectionTitle icon="📑" title="All Requests" />
          <FilterSelect
            label="Status"
            value={statusFilter}
            onChange={setStatusFilter}
          >
            <option value="">All</option>
            <option value="PENDING">Pending</option>
            <option value="APPROVED">Approved</option>
            <option value="DENIED">Denied</option>
            <option value="CANCELLED">Cancelled</option>
          </FilterSelect>
          <FilterInput label="From" type="date" value={requestFrom} onChange={setRequestFrom} />
          <FilterInput label="To" type="date" value={requestTo} onChange={setRequestTo} />
        </div>
        {loading ? (
          <Loading />
        ) : tableRows.length === 0 && pending.length === 0 ? (
          <div className="mt-6 py-8 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-xl">
              🏖️
            </div>
            <p className="mt-3 text-sm font-semibold text-gray-600">
              No time-off requests in this time frame.
            </p>
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-xl border border-gray-100">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50/80 text-left text-xs font-bold uppercase tracking-wider text-gray-400">
                  <th className="px-4 py-3">Employee</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Dates / Times</th>
                  <th className="px-4 py-3">Submitted At</th>
                  <th className="px-4 py-3">Reason</th>
                  <th className="px-4 py-3">Coverage</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Reviewed By</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {tableRows.map((r) => (
                  <tr
                    key={r.id}
                    className="border-b border-gray-50 transition hover:bg-blue-50/30"
                  >
                    <td className="px-4 py-3 font-semibold text-gray-900">
                      {r.user?.name || "—"}
                    </td>
                    <td className="px-4 py-3">
                      {r.isUnexcused ? (
                        <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700">
                          {r.typeLabel || getTimeOffTypeLabel(r.type)}
                        </span>
                      ) : (
                        r.typeLabel || getTimeOffTypeLabel(r.type)
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {fmtTimeOffRange(r.startDate, r.endDate)}
                      {groupDayLabelById.has(r.id) && (
                        <span className="ml-2 rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-bold text-indigo-700">
                          {groupDayLabelById.get(r.id)}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {fmtDateTime(r.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {r.reason || ""}
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {r.coverageName || ""}
                    </td>
                    <td className="px-4 py-3">
                      <Badge map={TIMEOFF_STATUS_BADGE} value={r.status} />
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {r.reviewedBy?.name || ""}
                    </td>
                    <td className="px-4 py-3">
                      {r.status === "APPROVED" ? (
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => openReview(r, "EDIT_COVERAGE")}
                            className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700 shadow-sm transition hover:bg-blue-100"
                          >
                            Edit Coverage
                          </button>
                          <button
                            onClick={() => openReview(r, "CANCELLED")}
                            className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-700 shadow-sm transition hover:bg-amber-100"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        ""
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      {reviewTarget ? (
        <ModalShell
          title={
            reviewStatus === "APPROVED"
              ? "Approve Time-Off Request"
              : reviewStatus === "DENIED"
                ? "Deny Time-Off Request"
                : reviewStatus === "CANCELLED"
                  ? "Cancel Approved Time-Off"
                  : "Edit Coverage"
          }
          subtitle={`${reviewTarget.user?.name || "Employee"} · ${fmtTimeOffRange(reviewTarget.startDate, reviewTarget.endDate)}`}
          onClose={closeReview}
        >
          <div className="space-y-5">
            {reviewError ? (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {reviewError}
              </div>
            ) : null}

            {reviewStatus === "CANCELLED" ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                Cancelling this approved request will return{" "}
                <strong>{reviewTarget.hoursRequested || 0} hours</strong> to{" "}
                {reviewTarget.user?.name || "this employee"}&apos;s{" "}
                {(reviewTarget.typeLabel || getTimeOffTypeLabel(reviewTarget.type)).toLowerCase()}{" "}
                balance.
              </div>
            ) : null}

            {reviewStatus === "APPROVED" || reviewStatus === "EDIT_COVERAGE" ? (
              <label className="block">
                <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                  Coverage Name
                </div>
                <input
                  type="text"
                  value={coverageName}
                  onChange={(event) => setCoverageName(event.target.value)}
                  list="timeoff-coverage-options"
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm font-medium text-gray-900 focus:border-blue-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100"
                  placeholder="Who is covering this shift?"
                  disabled={reviewSaving}
                />
                <datalist id="timeoff-coverage-options">
                  {teachers.map((teacher) => (
                    <option key={teacher.id} value={teacher.name || teacher.email || ""} />
                  ))}
                </datalist>
              </label>
            ) : null}

            {reviewStatus !== "EDIT_COVERAGE" ? (
              <label className="block">
                <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                  Review Notes
                </div>
                <textarea
                  value={reviewNotes}
                  onChange={(event) => setReviewNotes(event.target.value)}
                  rows={4}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm font-medium text-gray-900 focus:border-blue-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100"
                  placeholder={
                    reviewStatus === "APPROVED"
                      ? "Optional notes for the approval"
                      : reviewStatus === "CANCELLED"
                        ? "Optional reason for cancelling this approved time off"
                        : "Optional reason for denying this request"
                  }
                  disabled={reviewSaving}
                />
              </label>
            ) : null}

            <div className="flex flex-wrap justify-end gap-3 border-t border-gray-100 pt-4">
              <button
                type="button"
                onClick={closeReview}
                className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-600 transition hover:bg-gray-50"
                disabled={reviewSaving}
              >
                Close
              </button>
              <button
                type="button"
                onClick={handleAction}
                className={`rounded-xl px-5 py-2.5 text-sm font-bold text-white shadow-sm transition disabled:opacity-50 ${
                  reviewStatus === "APPROVED"
                    ? "bg-emerald-600 hover:bg-emerald-700"
                    : reviewStatus === "EDIT_COVERAGE"
                      ? "bg-blue-600 hover:bg-blue-700"
                      : reviewStatus === "CANCELLED"
                        ? "bg-amber-600 hover:bg-amber-700"
                        : "bg-red-600 hover:bg-red-700"
                }`}
                disabled={reviewSaving}
              >
                {reviewSaving
                  ? reviewStatus === "APPROVED"
                    ? "Approving..."
                    : reviewStatus === "EDIT_COVERAGE"
                      ? "Saving..."
                      : reviewStatus === "CANCELLED"
                        ? "Cancelling..."
                        : "Denying..."
                  : reviewStatus === "APPROVED"
                    ? "Approve Request"
                    : reviewStatus === "EDIT_COVERAGE"
                      ? "Save Coverage"
                      : reviewStatus === "CANCELLED"
                        ? "Cancel Time Off"
                        : "Deny Request"}
              </button>
            </div>
          </div>
        </ModalShell>
      ) : null}
      {unexcusedOpen ? (
        <ModalShell
          title="Enter Unexcused Time Off"
          subtitle="Records an absence directly and immediately reduces the employee's unpaid hours balance — even below zero."
          onClose={closeUnexcusedForm}
        >
          <div className="space-y-5">
            {unexcusedError ? (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {unexcusedError}
              </div>
            ) : null}

            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              This will immediately reduce the employee&apos;s unpaid hours balance, even into the negative.
            </div>

            <FilterSelect
              label="Employee Name"
              value={unexcusedForm.userId}
              onChange={(value) =>
                setUnexcusedForm((current) => ({ ...current, userId: value }))
              }
              disabled={!teachers.length}
            >
              <option value="">Select employee</option>
              {teachers.map((teacher) => (
                <option key={teacher.id} value={teacher.id}>
                  {teacher.name || teacher.email}
                </option>
              ))}
            </FilterSelect>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <FilterInput
                label="Date"
                type="date"
                value={unexcusedForm.date}
                onChange={(value) =>
                  setUnexcusedForm((current) => ({ ...current, date: value }))
                }
              />
              <FilterInput
                label="Start Time"
                type="time"
                value={unexcusedForm.startTime}
                onChange={(value) =>
                  setUnexcusedForm((current) => ({ ...current, startTime: value }))
                }
              />
              <FilterInput
                label="End Time"
                type="time"
                value={unexcusedForm.endTime}
                onChange={(value) =>
                  setUnexcusedForm((current) => ({ ...current, endTime: value }))
                }
              />
            </div>

            <label className="block">
              <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                Cover
              </div>
              <input
                type="text"
                value={unexcusedForm.coverageName}
                onChange={(event) =>
                  setUnexcusedForm((current) => ({ ...current, coverageName: event.target.value }))
                }
                list="timeoff-coverage-options"
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm font-medium text-gray-900 focus:border-blue-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100"
                placeholder="Who is covering this shift?"
                disabled={unexcusedSaving}
              />
              <datalist id="timeoff-coverage-options">
                {teachers.map((teacher) => (
                  <option key={teacher.id} value={teacher.name || teacher.email || ""} />
                ))}
              </datalist>
            </label>

            <TextArea
              label="Notes"
              value={unexcusedForm.notes}
              onChange={(value) =>
                setUnexcusedForm((current) => ({ ...current, notes: value }))
              }
            />

            <div className="flex flex-wrap justify-end gap-3 border-t border-gray-100 pt-4">
              <button
                type="button"
                onClick={closeUnexcusedForm}
                className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-600 transition hover:bg-gray-50"
                disabled={unexcusedSaving}
              >
                Close
              </button>
              <button
                type="button"
                onClick={handleUnexcusedSave}
                className="rounded-xl bg-red-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-red-700 disabled:opacity-50"
                disabled={unexcusedSaving}
              >
                {unexcusedSaving ? "Saving..." : "Save Unexcused Time Off"}
              </button>
            </div>
          </div>
        </ModalShell>
      ) : null}
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
  const [form, setForm] = useState({
    userIds: [],
    topic: "",
    description: "",
    hours: "",
    date: today(),
    category: "Other",
    performedBy: "",
  });
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
    } catch {
    } finally {
      setLoading(false);
    }
  }, [centerId, reportFrom, reportTo, userId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

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
      setForm({
        userIds: [],
        topic: "",
        description: "",
        hours: "",
        date: today(),
        category: "Other",
        performedBy: "",
      });
      loadData();
    } catch {
    } finally {
      setSaving(false);
    }
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
              {teachers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </FilterSelect>
            <FilterInput
              label="From"
              type="date"
              value={reportFrom}
              onChange={setReportFrom}
            />
            <FilterInput
              label="To"
              type="date"
              value={reportTo}
              onChange={setReportTo}
            />
          </div>
          <PrimaryButton onClick={() => setShowForm(!showForm)}>
            {showForm ? "Cancel" : "+ Log Training"}
          </PrimaryButton>
        </div>

        {false && (
          <>
            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
              <FilterSelect
                label="Teacher"
                value={filterTeacherId}
                onChange={setFilterTeacherId}
              >
                <option value="">All teachers</option>
                {teachers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </FilterSelect>
              <FilterInput
                label="From"
                type="date"
                value={filterFrom}
                onChange={setFilterFrom}
              />
              <FilterInput
                label="To"
                type="date"
                value={filterTo}
                onChange={setFilterTo}
              />
            </div>

            {evaluations.length > 0 && (
              <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3">
                <KpiCard
                  label="Evaluations"
                  value={evaluationSummary.total}
                  color="gray"
                />
                <KpiCard
                  label="Submitted"
                  value={evaluationSummary.submitted}
                  color="sky"
                />
                <KpiCard
                  label="Average Score"
                  value={
                    evaluationSummary.scored
                      ? Math.round(
                          evaluationSummary.scoreTotal /
                            evaluationSummary.scored,
                        )
                      : "â€”"
                  }
                  color="emerald"
                />
              </div>
            )}
          </>
        )}

        {showForm && (
          <form
            onSubmit={handleSave}
            className="mt-4 space-y-4 rounded-xl border border-blue-100 bg-blue-50/30 p-5"
          >
            <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
              <FilterInput
                label="Performed By"
                type="text"
                value={form.performedBy}
                onChange={(v) => setForm({ ...form, performedBy: v })}
              />
              <FilterInput
                label="Topic"
                type="text"
                value={form.topic}
                onChange={(v) => setForm({ ...form, topic: v })}
              />
              <FilterInput
                label="Hours"
                type="number"
                value={form.hours}
                onChange={(v) => setForm({ ...form, hours: v })}
              />
              <FilterInput
                label="Date"
                type="date"
                value={form.date}
                onChange={(v) => setForm({ ...form, date: v })}
              />
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <FilterSelect
                label="Category"
                value={form.category}
                onChange={(v) => setForm({ ...form, category: v })}
              >
                {TRAINING_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </FilterSelect>
              <FilterInput
                label="Description"
                type="text"
                value={form.description}
                onChange={(v) => setForm({ ...form, description: v })}
              />
            </div>

            <div>
              <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                Apply To Employees
              </div>
              <div className="grid grid-cols-1 gap-2 rounded-xl border border-blue-100 bg-white p-4 md:grid-cols-2">
                {teachers.map((teacher) => {
                  const selected = form.userIds.includes(teacher.id);
                  return (
                    <label
                      key={teacher.id}
                      className={`flex items-center gap-3 rounded-lg border px-3 py-2 text-sm ${selected ? "border-blue-200 bg-blue-50 text-blue-900" : "border-gray-200 bg-white text-gray-700"}`}
                    >
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() =>
                          setForm((current) => ({
                            ...current,
                            userIds: selected
                              ? current.userIds.filter(
                                  (id) => id !== teacher.id,
                                )
                              : [...current.userIds, teacher.id],
                          }))
                        }
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
              <KpiCard
                label="Total Hours"
                value={summary.totalHours}
                color="sky"
              />
              <KpiCard
                label="Entries"
                value={summary.totalEntries || 0}
                color="gray"
              />
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
                  {(summary.reportByUser || []).length ? (
                    summary.reportByUser.map((reportRow) => (
                      <tr
                        key={reportRow.userId || reportRow.name}
                        className="border-b border-gray-50"
                      >
                        <td className="px-4 py-3 font-semibold text-gray-900">
                          {reportRow.name || "Unknown employee"}
                        </td>
                        <td className="px-4 py-3 text-gray-700">
                          {reportRow.entries}
                        </td>
                        <td className="px-4 py-3 text-gray-700">
                          {reportRow.totalHours}
                        </td>
                        <td className="px-4 py-3 text-gray-700">
                          {reportRow.lastCompletedAt
                            ? fmtDate(reportRow.lastCompletedAt)
                            : "—"}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-4 py-6 text-center text-sm text-gray-500"
                      >
                        No employee training records in this range.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {loading ? (
          <Loading />
        ) : logs.length === 0 ? (
          <div className="mt-6 py-8 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-xl">
              📚
            </div>
            <p className="mt-3 text-sm font-semibold text-gray-600">
              No training logs found.
            </p>
          </div>
        ) : (
          <div className="mt-4 space-y-2">
            {logs.map((l) => (
              <div
                key={l.id}
                className="flex flex-wrap items-center gap-4 rounded-xl border border-gray-100 bg-gray-50/50 px-4 py-3 transition hover:border-gray-200 hover:bg-white"
              >
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-800 to-sky-600 text-xs font-bold text-white">
                  {getInitials(l.user?.name)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-bold text-gray-900">
                    {l.topic}
                  </div>
                  <div className="text-xs text-gray-500">
                    {l.user?.name || "—"} · {fmtDate(l.date)}
                    {l.performedBy ? ` · Performed by ${l.performedBy}` : ""}
                  </div>
                </div>
                <span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-bold text-blue-800">
                  {l.category}
                </span>
                <span className="text-sm font-extrabold text-sky-700">
                  {l.hours}h
                </span>
                <button
                  onClick={() => handleDelete(l.id)}
                  className="rounded-lg border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-600 hover:bg-red-100 transition"
                >
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
    } catch {
    } finally {
      setLoading(false);
    }
  }, [centerId, reportFrom, reportTo, userId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const visibleTeachers = useMemo(() => {
    const query = employeeSearch.trim().toLowerCase();
    if (!query) return teachers;
    return teachers.filter((teacher) =>
      [teacher?.name || "", teacher?.email || "", teacher?.role || ""]
        .join(" ")
        .toLowerCase()
        .includes(query),
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
    () => [
      ...new Set(
        teachers.map((teacher) => (teacher?.name || "").trim()).filter(Boolean),
      ),
    ],
    [teachers],
  );

  const topTrainingCategories = useMemo(
    () =>
      Object.entries(summary?.byCategory || {})
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3),
    [summary],
  );
  const reportRows = summary?.reportByUser || [];
  const reportRangeLabel =
    [
      reportFrom ? fmtDate(reportFrom) : null,
      reportTo ? fmtDate(reportTo) : null,
    ]
      .filter(Boolean)
      .join(" - ") || "All recorded dates";

  const selectedVisibleCount = visibleTeacherIds.filter((id) =>
    form.userIds.includes(id),
  ).length;
  const allVisibleSelected =
    visibleTeacherIds.length > 0 &&
    selectedVisibleCount === visibleTeacherIds.length;

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
    } catch {
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Delete this training log entry?")) return;
    try {
      await apiJson(`/api/v1/training-logs/${id}`, { method: "DELETE" });
      loadData();
    } catch {}
  };

  const handleExportReport = () => {
    if (
      !reportRows.length ||
      typeof document === "undefined" ||
      typeof window === "undefined"
    )
      return;
    const escapeCell = (value) =>
      `"${String(value ?? "").replace(/"/g, '""')}"`;
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
      ...reportRows.map((row) =>
        [
          escapeCell(row.name || "Unknown employee"),
          row.entries ?? 0,
          row.totalHours ?? 0,
          row.entries
            ? Math.round(((row.totalHours || 0) / row.entries) * 100) / 100
            : 0,
          escapeCell(row.lastCompletedAt ? fmtDate(row.lastCompletedAt) : "-"),
          escapeCell(reportFrom || ""),
          escapeCell(reportTo || ""),
        ].join(","),
      ),
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
              Log one training session, record who facilitated it, and apply it
              to the employees who attended.
            </p>
          </div>
          <PrimaryButton
            onClick={() => {
              if (showForm) setEmployeeSearch("");
              setShowForm((current) => !current);
            }}
          >
            {showForm ? "Close Composer" : "+ New Training Session"}
          </PrimaryButton>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1fr)_280px] xl:items-end">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <FilterSelect label="Employee" value={userId} onChange={setUserId}>
              <option value="">All employees</option>
              {teachers.map((teacher) => (
                <option key={teacher.id} value={teacher.id}>
                  {teacher.name || teacher.email}
                </option>
              ))}
            </FilterSelect>
            <FilterInput
              label="From"
              type="date"
              value={reportFrom}
              onChange={setReportFrom}
            />
            <FilterInput
              label="To"
              type="date"
              value={reportTo}
              onChange={setReportTo}
            />
          </div>
          <div className="rounded-2xl border border-sky-100 bg-sky-50/80 px-4 py-3">
            <div className="text-sm font-extrabold text-sky-900">
              {logs.length} training record{logs.length === 1 ? "" : "s"} in
              view
            </div>
            <p className="mt-1 text-xs text-sky-700">
              Narrow the list by employee or date range when you need to audit
              specific staff training history.
            </p>
          </div>
        </div>

        {showForm && (
          <form
            onSubmit={handleSave}
            className="mt-6 overflow-hidden rounded-[28px] border border-sky-100 bg-gradient-to-br from-sky-50 via-white to-blue-50 shadow-sm"
          >
            <div className="border-b border-sky-100 bg-gradient-to-r from-sky-100/80 to-white px-5 py-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="text-lg font-black tracking-tight text-gray-900">
                    Bulk Training Composer
                  </div>
                  <p className="mt-1 text-sm text-gray-600">
                    Capture the training once, then select the exact employees
                    who attended so you do not have to log duplicate entries
                    manually.
                  </p>
                </div>
                <div className="grid min-w-[240px] grid-cols-2 gap-3">
                  <MiniStat
                    icon="👥"
                    label="Selected Staff"
                    value={selectedTeachers.length}
                    colorClass="border-blue-200 bg-white text-blue-900"
                  />
                  <MiniStat
                    icon="⏱"
                    label="Hours Each"
                    value={form.hours ? `${form.hours}h` : "--"}
                    colorClass="border-sky-200 bg-white text-sky-900"
                  />
                </div>
              </div>
            </div>

            <div className="grid gap-6 p-5 xl:grid-cols-[minmax(0,1fr)_340px]">
              <div className="space-y-5">
                <div className="rounded-2xl border border-white bg-white p-5 shadow-sm">
                  <div className="text-sm font-extrabold text-gray-900">
                    Session Details
                  </div>
                  <p className="mt-1 text-sm text-gray-500">
                    Record the training topic, category, trainer, and any notes
                    staff may need to reference later.
                  </p>

                  <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <FilterInput
                      label="Topic"
                      type="text"
                      value={form.topic}
                      onChange={(value) => updateForm({ topic: value })}
                    />
                    <FilterSelect
                      label="Category"
                      value={form.category}
                      onChange={(value) => updateForm({ category: value })}
                    >
                      {TRAINING_CATEGORIES.map((category) => (
                        <option key={category} value={category}>
                          {category}
                        </option>
                      ))}
                    </FilterSelect>
                    <label className="block">
                      <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                        Hours
                      </div>
                      <input
                        type="number"
                        min="0.25"
                        step="0.25"
                        value={form.hours}
                        onChange={(e) => updateForm({ hours: e.target.value })}
                        className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm font-medium text-gray-900 focus:border-blue-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100"
                      />
                    </label>
                    <FilterInput
                      label="Date"
                      type="date"
                      value={form.date}
                      onChange={(value) => updateForm({ date: value })}
                    />
                  </div>

                  <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                    <label className="block">
                      <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                        Trainer / Facilitator
                      </div>
                      <input
                        type="text"
                        list="training-facilitator-options"
                        value={form.performedBy}
                        onChange={(e) =>
                          updateForm({ performedBy: e.target.value })
                        }
                        placeholder="Use a staff member or outside provider"
                        className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm font-medium text-gray-900 focus:border-blue-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100"
                      />
                      <datalist id="training-facilitator-options">
                        {facilitatorSuggestions.map((name) => (
                          <option key={name} value={name} />
                        ))}
                      </datalist>
                      <p className="mt-1 text-xs text-gray-500">
                        Enter who performed the training, even if it was an
                        external organization.
                      </p>
                    </label>
                    <TextArea
                      label="Description / Notes"
                      value={form.description}
                      onChange={(value) => updateForm({ description: value })}
                    />
                  </div>
                </div>

                <div className="rounded-2xl border border-white bg-white p-5 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-extrabold text-gray-900">
                        Attendees
                      </div>
                      <p className="mt-1 text-sm text-gray-500">
                        Search the employee list, then click the staff members
                        who attended this training session.
                      </p>
                    </div>
                    <div className="rounded-2xl border border-sky-100 bg-sky-50 px-4 py-3 text-right">
                      <div className="text-lg font-extrabold text-sky-900">
                        {selectedVisibleCount}/{visibleTeacherIds.length || 0}
                      </div>
                      <div className="text-[10px] font-bold uppercase tracking-wider text-sky-700">
                        Visible Selected
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
                    <label className="block">
                      <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                        Search Employees
                      </div>
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
                          if (allVisibleSelected)
                            removeTeacherIds(visibleTeacherIds);
                          else addTeacherIds(visibleTeacherIds);
                        }}
                        className="rounded-xl border border-blue-200 bg-white px-3 py-2 text-xs font-bold text-blue-700 transition hover:bg-blue-50"
                      >
                        {allVisibleSelected
                          ? "Remove Visible"
                          : "Select Visible"}
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          addTeacherIds(teachers.map((teacher) => teacher.id))
                        }
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
                      <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                        Selected Employees
                      </div>
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
                      No employees selected yet. Choose at least one attendee
                      before saving this training session.
                    </div>
                  )}

                  <div className="mt-4 max-h-[360px] overflow-y-auto rounded-2xl border border-gray-100 bg-slate-50/70 p-3">
                    {visibleTeachers.length ? (
                      <div className="grid grid-cols-1 gap-2 xl:grid-cols-2">
                        {visibleTeachers.map((teacher) => {
                          const selected = form.userIds.includes(teacher.id);
                          const displayName =
                            teacher.name || teacher.email || "Unknown employee";
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
                              <div
                                className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl text-sm font-extrabold ${selected ? "bg-blue-700 text-white" : "bg-gray-100 text-gray-700"}`}
                              >
                                {getInitials(displayName)}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="truncate text-sm font-bold">
                                    {displayName}
                                  </span>
                                  {teacher.role ? (
                                    <span className="rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-gray-500">
                                      {formatRole(teacher.role)}
                                    </span>
                                  ) : null}
                                </div>
                                <div className="mt-1 truncate text-xs text-gray-500">
                                  {teacher.email || "No email on file"}
                                </div>
                              </div>
                              <div
                                className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${selected ? "bg-blue-700 text-white" : "bg-gray-100 text-gray-500"}`}
                              >
                                {selected ? "Selected" : "Select"}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-dashed border-gray-200 bg-white px-4 py-8 text-center">
                        <div className="text-sm font-bold text-gray-700">
                          No employees match this search.
                        </div>
                        <p className="mt-1 text-xs text-gray-500">
                          Try a different name, email, or role filter.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="rounded-2xl border border-sky-100 bg-white p-5 shadow-sm">
                  <div className="text-sm font-extrabold text-gray-900">
                    Review Before Saving
                  </div>
                  <p className="mt-1 text-sm text-gray-500">
                    This creates one training record per selected employee using
                    the shared session details below.
                  </p>

                  <div className="mt-4 space-y-3">
                    <div className="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                        Topic
                      </div>
                      <div className="mt-1 text-sm font-semibold text-gray-900">
                        {form.topic.trim() || "Add a topic"}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                          Date
                        </div>
                        <div className="mt-1 text-sm font-semibold text-gray-900">
                          {form.date ? fmtDate(form.date) : "Choose a date"}
                        </div>
                      </div>
                      <div className="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                          Category
                        </div>
                        <div className="mt-1 text-sm font-semibold text-gray-900">
                          {form.category}
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                          Hours
                        </div>
                        <div className="mt-1 text-sm font-semibold text-gray-900">
                          {form.hours ? `${form.hours} hours` : "Add hours"}
                        </div>
                      </div>
                      <div className="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                          Trainer
                        </div>
                        <div className="mt-1 text-sm font-semibold text-gray-900">
                          {form.performedBy.trim() || "Optional"}
                        </div>
                      </div>
                    </div>
                    <div className="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                        Attendees
                      </div>
                      <div className="mt-1 text-sm font-semibold text-gray-900">
                        {selectedTeachers.length} employee
                        {selectedTeachers.length === 1 ? "" : "s"} selected
                      </div>
                      {selectedTeachers.length > 0 ? (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {selectedTeachers.slice(0, 8).map((teacher) => (
                            <span
                              key={teacher.id}
                              className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-gray-700 shadow-sm"
                            >
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
                      disabled={
                        !form.topic.trim() ||
                        !form.hours ||
                        !form.userIds.length
                      }
                      label={
                        selectedTeachers.length
                          ? `Log Training for ${selectedTeachers.length} Employee${selectedTeachers.length === 1 ? "" : "s"}`
                          : "Select Employees"
                      }
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
                  <div className="text-xs font-bold uppercase tracking-wider text-amber-700">
                    Workflow Tip
                  </div>
                  <p className="mt-2 text-sm text-amber-900">
                    Use search plus "Select Visible" when most staff attended
                    the same training and you only need to exclude a few
                    employees.
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
                  <div className="text-lg font-black tracking-tight text-gray-900">
                    Employee Training Report
                  </div>
                  <p className="mt-1 text-sm text-gray-500">
                    Use the employee and date-range filters above, then run or
                    export the current report for completed training hours.
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
                  <KpiCard
                    label="Total Hours"
                    value={summary.totalHours}
                    color="sky"
                  />
                  <KpiCard
                    label="Entries"
                    value={summary.totalEntries || 0}
                    color="gray"
                  />
                  <KpiCard
                    label="Employees"
                    value={reportRows.length}
                    color="blue"
                  />
                  {topTrainingCategories.map(([category, hours]) => (
                    <KpiCard
                      key={category}
                      label={category}
                      value={hours}
                      color="blue"
                    />
                  ))}
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Report Window
                  </div>
                  <div className="mt-1 text-sm font-bold text-slate-900">
                    {reportRangeLabel}
                  </div>
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
                    {reportRows.length ? (
                      reportRows.map((reportRow) => {
                        const averageHours = reportRow.entries
                          ? Math.round(
                              (reportRow.totalHours / reportRow.entries) * 100,
                            ) / 100
                          : 0;
                        return (
                          <tr
                            key={reportRow.userId || reportRow.name}
                            className="border-b border-gray-50"
                          >
                            <td className="px-4 py-3 font-semibold text-gray-900">
                              {reportRow.name || "Unknown employee"}
                            </td>
                            <td className="px-4 py-3 text-gray-700">
                              {reportRow.entries}
                            </td>
                            <td className="px-4 py-3 font-semibold text-sky-700">
                              {reportRow.totalHours}
                            </td>
                            <td className="px-4 py-3 text-gray-700">
                              {averageHours}h
                            </td>
                            <td className="px-4 py-3 text-gray-700">
                              {reportRow.lastCompletedAt
                                ? fmtDate(reportRow.lastCompletedAt)
                                : "-"}
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td
                          colSpan={5}
                          className="px-4 py-6 text-center text-sm text-gray-500"
                        >
                          No employee training records in this range.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <Loading />
        ) : logs.length === 0 ? (
          <div className="mt-6 py-8 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-xl">
              📚
            </div>
            <p className="mt-3 text-sm font-semibold text-gray-600">
              No training logs found.
            </p>
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {logs.map((log) => (
              <div
                key={log.id}
                className="rounded-2xl border border-gray-100 bg-gray-50/60 px-4 py-4 transition hover:border-gray-200 hover:bg-white"
              >
                <div className="flex flex-wrap items-start gap-4">
                  <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-800 to-sky-600 text-xs font-bold text-white">
                    {getInitials(log.user?.name || log.user?.email)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="text-sm font-bold text-gray-900">
                        {log.topic}
                      </div>
                      <span className="rounded-full bg-blue-100 px-2.5 py-1 text-[11px] font-bold text-blue-800">
                        {log.category}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
                      <span>
                        {log.user?.name ||
                          log.user?.email ||
                          "Unknown employee"}
                      </span>
                      <span>{fmtDate(log.date)}</span>
                      {log.performedBy ? (
                        <span>Facilitated by {log.performedBy}</span>
                      ) : null}
                      {log.recordedBy?.name ? (
                        <span>Logged by {log.recordedBy.name}</span>
                      ) : null}
                    </div>
                    {log.description ? (
                      <p className="mt-2 text-sm text-gray-600">
                        {log.description}
                      </p>
                    ) : null}
                  </div>
                  <div className="ml-auto flex items-center gap-2">
                    <span className="rounded-full bg-sky-100 px-2.5 py-1 text-sm font-extrabold text-sky-800">
                      {log.hours}h
                    </span>
                    <button
                      onClick={() => handleDelete(log.id)}
                      className="rounded-lg border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-600 transition hover:bg-red-100"
                    >
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
  const [budgetForm, setBudgetForm] = useState({
    classRoomId: "",
    allocatedAmount: "",
    notes: "",
  });
  const [expenseForm, setExpenseForm] = useState(null);
  const [saving, setSaving] = useState(false);

  const loadBudgets = useCallback(async () => {
    setLoading(true);
    try {
      const qs = `centerId=${centerId}&month=${month}${classRoomId ? `&classRoomId=${classRoomId}` : ""}`;
      const data = await apiJson(`/api/v1/classroom-budgets?${qs}`);
      setBudgets(Array.isArray(data) ? data : []);
    } catch {
    } finally {
      setLoading(false);
    }
  }, [centerId, month, classRoomId]);

  useEffect(() => {
    loadBudgets();
  }, [loadBudgets]);

  const handleSetBudget = async (e) => {
    e.preventDefault();
    if (!budgetForm.classRoomId || !budgetForm.allocatedAmount) return;
    setSaving(true);
    try {
      await apiJson("/api/v1/classroom-budgets", {
        method: "POST",
        body: JSON.stringify({
          centerId,
          classRoomId: budgetForm.classRoomId,
          month,
          allocatedAmount: parseFloat(budgetForm.allocatedAmount),
          notes: budgetForm.notes || null,
        }),
      });
      setShowBudgetForm(false);
      setBudgetForm({ classRoomId: "", allocatedAmount: "", notes: "" });
      loadBudgets();
    } catch {
    } finally {
      setSaving(false);
    }
  };

  const handleAddExpense = async (e) => {
    e.preventDefault();
    if (!expenseForm || !expenseForm.description || !expenseForm.amount) return;
    setSaving(true);
    try {
      await apiJson(
        `/api/v1/classroom-budgets/${expenseForm.budgetId}/expenses`,
        {
          method: "POST",
          body: JSON.stringify({
            description: expenseForm.description,
            amount: parseFloat(expenseForm.amount),
            date: expenseForm.date || today(),
            category: expenseForm.category || "Other",
          }),
        },
      );
      setExpenseForm(null);
      loadBudgets();
    } catch {
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteExpense = async (budgetId, expenseId) => {
    if (!confirm("Delete this expense?")) return;
    try {
      await apiJson(
        `/api/v1/classroom-budgets/${budgetId}/expenses/${expenseId}`,
        { method: "DELETE" },
      );
      loadBudgets();
    } catch {}
  };

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <FilterInput
              label="Month"
              type="month"
              value={month}
              onChange={setMonth}
            />
            <FilterSelect
              label="Classroom"
              value={classRoomId}
              onChange={setClassRoomId}
            >
              <option value="">All classrooms</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </FilterSelect>
          </div>
          <PrimaryButton onClick={() => setShowBudgetForm(!showBudgetForm)}>
            {showBudgetForm ? "Cancel" : "+ Set Budget"}
          </PrimaryButton>
        </div>

        {showBudgetForm && (
          <form
            onSubmit={handleSetBudget}
            className="mt-4 grid grid-cols-1 gap-3 rounded-xl border border-blue-100 bg-blue-50/30 p-5 md:grid-cols-3"
          >
            <FilterSelect
              label="Classroom"
              value={budgetForm.classRoomId}
              onChange={(v) => setBudgetForm({ ...budgetForm, classRoomId: v })}
            >
              <option value="">Select classroom…</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </FilterSelect>
            <FilterInput
              label="Allocated Amount ($)"
              type="number"
              value={budgetForm.allocatedAmount}
              onChange={(v) =>
                setBudgetForm({ ...budgetForm, allocatedAmount: v })
              }
            />
            <FilterInput
              label="Notes"
              type="text"
              value={budgetForm.notes}
              onChange={(v) => setBudgetForm({ ...budgetForm, notes: v })}
            />
            <div className="flex items-end">
              <SaveButton saving={saving} label="Save Budget" />
            </div>
          </form>
        )}
      </Card>

      {loading ? (
        <Loading />
      ) : budgets.length === 0 ? (
        <EmptyCard
          icon="💰"
          title="No budgets set"
          msg="No budgets for this month. Set one using the button above."
        />
      ) : (
        budgets.map((b) => {
          const pct =
            b.allocatedAmount > 0
              ? Math.min(100, Math.round((b.spent / b.allocatedAmount) * 100))
              : 0;
          const barColor =
            pct > 90
              ? "bg-red-500"
              : pct > 70
                ? "bg-amber-500"
                : "bg-emerald-500";

          return (
            <Card key={b.id}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-lg">
                    🏫
                  </div>
                  <div>
                    <div className="text-sm font-bold text-gray-900">
                      {b.classRoom?.name || "Classroom"}
                    </div>
                    <div className="text-xs text-gray-500">{b.month}</div>
                  </div>
                </div>
                <PrimaryButton
                  size="sm"
                  onClick={() =>
                    setExpenseForm({
                      budgetId: b.id,
                      description: "",
                      amount: "",
                      date: today(),
                      category: "Other",
                    })
                  }
                >
                  + Add Expense
                </PrimaryButton>
              </div>

              {/* Budget Overview */}
              <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
                <KpiCard
                  label="Allocated"
                  value={`$${b.allocatedAmount.toFixed(2)}`}
                  color="sky"
                />
                <KpiCard
                  label="Spent"
                  value={`$${(b.spent || 0).toFixed(2)}`}
                  color={pct > 90 ? "red" : "amber"}
                />
                <KpiCard
                  label="Remaining"
                  value={`$${(b.remaining || 0).toFixed(2)}`}
                  color="emerald"
                />
                <div className="flex flex-col justify-center rounded-xl border border-gray-200 bg-gray-50 p-4">
                  <div className="text-xs font-bold uppercase tracking-wider text-gray-400">
                    Usage
                  </div>
                  <div className="mt-2 h-3 w-full overflow-hidden rounded-full bg-gray-200">
                    <div
                      className={`h-3 rounded-full transition-all ${barColor}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="mt-1.5 text-lg font-extrabold text-gray-900">
                    {pct}%
                  </div>
                </div>
              </div>

              {expenseForm && expenseForm.budgetId === b.id && (
                <form
                  onSubmit={handleAddExpense}
                  className="mt-4 grid grid-cols-1 gap-3 rounded-xl border border-blue-100 bg-blue-50/30 p-4 md:grid-cols-3"
                >
                  <FilterInput
                    label="Description"
                    type="text"
                    value={expenseForm.description}
                    onChange={(v) =>
                      setExpenseForm({ ...expenseForm, description: v })
                    }
                  />
                  <FilterInput
                    label="Amount ($)"
                    type="number"
                    value={expenseForm.amount}
                    onChange={(v) =>
                      setExpenseForm({ ...expenseForm, amount: v })
                    }
                  />
                  <FilterInput
                    label="Date"
                    type="date"
                    value={expenseForm.date}
                    onChange={(v) =>
                      setExpenseForm({ ...expenseForm, date: v })
                    }
                  />
                  <FilterSelect
                    label="Category"
                    value={expenseForm.category}
                    onChange={(v) =>
                      setExpenseForm({ ...expenseForm, category: v })
                    }
                  >
                    {EXPENSE_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </FilterSelect>
                  <div className="flex items-end gap-2">
                    <SaveButton saving={saving} label="Add" />
                    <button
                      type="button"
                      onClick={() => setExpenseForm(null)}
                      className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}

              {b.expenses && b.expenses.length > 0 && (
                <div className="mt-4 overflow-x-auto rounded-xl border border-gray-100">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 bg-gray-50/80 text-left text-xs font-bold uppercase tracking-wider text-gray-400">
                        <th className="px-4 py-3">Description</th>
                        <th className="px-4 py-3">Amount</th>
                        <th className="px-4 py-3">Date</th>
                        <th className="px-4 py-3">Category</th>
                        <th className="px-4 py-3"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {b.expenses.map((exp) => (
                        <tr
                          key={exp.id}
                          className="border-b border-gray-50 transition hover:bg-blue-50/30"
                        >
                          <td className="px-4 py-3 font-medium text-gray-900">
                            {exp.description}
                          </td>
                          <td className="px-4 py-3 font-bold text-gray-900">
                            ${exp.amount.toFixed(2)}
                          </td>
                          <td className="px-4 py-3 text-gray-500">
                            {fmtDate(exp.date)}
                          </td>
                          <td className="px-4 py-3">
                            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-600">
                              {exp.category}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              onClick={() => handleDeleteExpense(b.id, exp.id)}
                              className="text-xs font-semibold text-red-500 hover:text-red-700 transition"
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          );
        })
      )}
    </div>
  );
}

// ─── Evaluations Tab ─────────────────────────────────────────

function EvaluationsTab({ centerId, teachers }) {
  const [evaluations, setEvaluations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [filterTeacherId, setFilterTeacherId] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");
  const [form, setForm] = useState(createDefaultEvaluationForm());
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [categories, setCategories] = useState(EVAL_CATEGORIES);
  const [showCategoryManager, setShowCategoryManager] = useState(false);

  const loadCategories = useCallback(async () => {
    if (!centerId) {
      setCategories(EVAL_CATEGORIES);
      return;
    }
    try {
      const data = await apiJson(
        `/api/v1/evaluation-category-config?centerId=${centerId}`,
      );
      setCategories(
        Array.isArray(data?.categories) && data.categories.length
          ? data.categories
          : EVAL_CATEGORIES,
      );
    } catch {
      setCategories(EVAL_CATEGORIES);
    }
  }, [centerId]);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  useEffect(() => {
    if (!showForm) {
      setForm((prev) => createDefaultEvaluationForm(prev.teacherId, categories));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categories]);

  const startEvaluationForTeacher = useCallback((teacherId) => {
    setForm(createDefaultEvaluationForm(teacherId, categories));
    setFormError("");
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [categories]);

  const loadEvaluations = useCallback(async () => {
    if (!centerId) {
      setEvaluations([]);
      setLoadError("");
      setLoading(false);
      return;
    }

    setLoading(true);
    setLoadError("");
    try {
      const qs = new URLSearchParams({
        centerId,
        ...(filterTeacherId ? { teacherId: filterTeacherId } : {}),
        ...(filterStatus ? { status: filterStatus } : {}),
        ...(filterFrom ? { from: filterFrom } : {}),
        ...(filterTo ? { to: filterTo } : {}),
      });
      const data = await apiJson(`/api/v1/evaluations?${qs.toString()}`);
      setEvaluations(Array.isArray(data) ? data : []);
    } catch (error) {
      setLoadError(error.message || "Failed to load evaluations");
    } finally {
      setLoading(false);
    }
  }, [centerId, filterFrom, filterStatus, filterTeacherId, filterTo]);

  useEffect(() => {
    if (!centerId) {
      setEvaluations([]);
      setLoadError("");
      return;
    }
    loadEvaluations();
  }, [centerId, loadEvaluations]);

  const overallScore = (cats) => {
    const vals = Object.values(cats || {}).filter((v) => typeof v === "number" && v !== null);
    if (vals.length === 0) return null;
    return Math.round((vals.reduce((s, v) => s + v, 0) / vals.length) * 20);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setFormError("");
    if (!form.teacherId) {
      setFormError("Select an employee before saving the evaluation.");
      return;
    }
    if (!form.periodStart || !form.periodEnd) {
      setFormError("Start and end dates are required for each evaluation period.");
      return;
    }
    if (new Date(form.periodEnd) < new Date(form.periodStart)) {
      setFormError("End date must be on or after the start date.");
      return;
    }
    setSaving(true);
    try {
      await apiJson("/api/v1/evaluations", {
        method: "POST",
        body: JSON.stringify({
          centerId,
          teacherId: form.teacherId,
          period: form.evaluationType || undefined,
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
      setForm(createDefaultEvaluationForm(undefined, categories));
      await loadEvaluations();
    } catch (error) {
      setFormError(error.message || "Failed to save evaluation");
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async (id) => {
    try {
      await apiJson(`/api/v1/evaluations/${id}`, {
        method: "PUT",
        body: JSON.stringify({ status: "SUBMITTED" }),
      });
      await loadEvaluations();
    } catch (error) {
      setLoadError(error.message || "Failed to submit evaluation");
    }
  };

  const scoreColor = (score) => {
    if (score >= 80) return "text-emerald-700 bg-emerald-50";
    if (score >= 60) return "text-amber-700 bg-amber-50";
    return "text-red-700 bg-red-50";
  };

  const evaluationSummary = evaluations.reduce(
    (acc, evaluation) => {
      acc.total += 1;
      if (
        evaluation.status === "SUBMITTED" ||
        evaluation.status === "ACKNOWLEDGED"
      )
        acc.submitted += 1;
      if (typeof evaluation.overallScore === "number") {
        acc.scored += 1;
        acc.scoreTotal += evaluation.overallScore;
      }
      return acc;
    },
    { total: 0, submitted: 0, scored: 0, scoreTotal: 0 },
  );

  const hasActiveFilters = Boolean(
    filterTeacherId || filterStatus || filterFrom || filterTo,
  );

  const selectedEmployeeLabel =
    teachers.find((teacher) => teacher.id === filterTeacherId)?.name ||
    "All employees";

  const selectedStatusLabel =
    EVALUATION_STATUS_OPTIONS.find((option) => option.value === filterStatus)
      ?.label || "All statuses";

  const handleClearFilters = () => {
    setFilterTeacherId("");
    setFilterStatus("");
    setFilterFrom("");
    setFilterTo("");
  };

  const handlePrint = () => {
    const rows = evaluations.map((ev) => ({
      teacher: ev.teacher?.name || ev.teacher?.email || "",
      periodStart: fmtDate(ev.periodStart) || "",
      periodEnd: fmtDate(ev.periodEnd) || "",
      evaluator: ev.evaluator?.name || "",
      status: ev.status || "",
      score: typeof ev.overallScore === "number" ? `${ev.overallScore}%` : "",
      createdAt: fmtDate(ev.createdAt) || "",
      strengths: ev.strengths || "",
      improvement: ev.areasForImprovement || "",
      goals: ev.goals || "",
      notes: ev.notes || "",
    }));
    const html = `
      <html>
        <head>
          <title>Employee Evaluations</title>
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
          <h1>Employee Evaluations</h1>
          <div class="meta">Employee: ${escapeHtml(selectedEmployeeLabel)} | Status: ${escapeHtml(selectedStatusLabel)} | Period: ${escapeHtml(filterFrom || "Any")} to ${escapeHtml(filterTo || "Any")} | Results: ${rows.length}</div>
          <table>
            <thead><tr><th>Employee</th><th>Start Date</th><th>End Date</th><th>Status</th><th>Score</th><th>Evaluator</th><th>Created</th><th>Strengths</th><th>Improvement</th><th>Goals</th><th>Notes</th></tr></thead>
            <tbody>
              ${rows.map((row) => `<tr><td>${escapeHtml(row.teacher)}</td><td>${escapeHtml(row.periodStart || "Open")}</td><td>${escapeHtml(row.periodEnd || "Open")}</td><td>${escapeHtml(row.status)}</td><td>${escapeHtml(row.score)}</td><td>${escapeHtml(row.evaluator)}</td><td>${escapeHtml(row.createdAt)}</td><td>${escapeHtml(row.strengths)}</td><td>${escapeHtml(row.improvement)}</td><td>${escapeHtml(row.goals)}</td><td>${escapeHtml(row.notes)}</td></tr>`).join("")}
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
          <SectionTitle icon="⭐" title="Employee Evaluations" />
          <div className="flex flex-wrap gap-2">
            <SecondaryButton onClick={() => setShowCategoryManager((v) => !v)}>
              {showCategoryManager ? "Close Categories" : "Manage Categories"}
            </SecondaryButton>
            <PrimaryButton
              onClick={() => {
                setFormError("");
                setShowForm(!showForm);
              }}
            >
              {showForm ? "Cancel" : "+ Create Evaluation"}
            </PrimaryButton>
          </div>
        </div>

        {showCategoryManager && (
          <EvaluationCategoryManager
            centerId={centerId}
            categories={categories}
            onSaved={(next) => {
              setCategories(next);
              setShowCategoryManager(false);
            }}
          />
        )}

        <div className="mt-4 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-900">
          Use a start date and end date for each evaluation period so shorter
          cycles, including two-week reviews, are tracked correctly. Submitted
          evaluations continue to appear on the employee side under{" "}
          <span className="font-bold">
            My Performance &amp; Training &gt; Evaluations
          </span>
          .
        </div>

        {teachers.length > 0 && !showForm && (
          <div className="mt-4 rounded-2xl border border-gray-200 bg-white p-4">
            <div className="mb-3 text-xs font-bold uppercase tracking-wider text-gray-400">
              Quick Evaluate — Click an employee to start
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
              {teachers.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => startEvaluationForTeacher(t.id)}
                  className="flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-left text-sm hover:border-blue-300 hover:bg-blue-50 transition"
                >
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-800 to-sky-600 text-xs font-bold text-white">
                    {getInitials(t.name)}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-xs font-semibold text-gray-800">{t.name}</div>
                    <div className="text-xs text-blue-600">Evaluate →</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="mt-4 rounded-2xl border border-gray-200 bg-gray-50 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-sm font-bold text-gray-900">
                Previous Evaluations
              </div>
              <div className="mt-1 text-sm text-gray-500">
                Filter the evaluation history by employee, status, and date
                range, then print the same filtered report when needed.
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {hasActiveFilters ? (
                <SecondaryButton onClick={handleClearFilters}>
                  Clear Filters
                </SecondaryButton>
              ) : null}
              <SecondaryButton
                onClick={handlePrint}
                disabled={!evaluations.length}
              >
                Print Filtered Report
              </SecondaryButton>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-4">
            <FilterSelect
              label="Employee"
              value={filterTeacherId}
              onChange={setFilterTeacherId}
            >
              <option value="">All employees</option>
              {teachers.map((teacher) => (
                <option key={teacher.id} value={teacher.id}>
                  {teacher.name}
                </option>
              ))}
            </FilterSelect>
            <FilterSelect
              label="Status"
              value={filterStatus}
              onChange={setFilterStatus}
            >
              {EVALUATION_STATUS_OPTIONS.map((option) => (
                <option key={option.value || "all"} value={option.value}>
                  {option.label}
                </option>
              ))}
            </FilterSelect>
            <FilterInput
              label="Start Date"
              type="date"
              value={filterFrom}
              onChange={setFilterFrom}
            />
            <FilterInput
              label="End Date"
              type="date"
              value={filterTo}
              onChange={setFilterTo}
            />
          </div>
        </div>

        {evaluations.length > 0 && (
          <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3">
            <KpiCard
              label="Evaluations"
              value={evaluationSummary.total}
              color="gray"
            />
            <KpiCard
              label="Submitted"
              value={evaluationSummary.submitted}
              color="sky"
            />
            <KpiCard
              label="Average Score"
              value={
                evaluationSummary.scored
                  ? Math.round(
                      evaluationSummary.scoreTotal / evaluationSummary.scored,
                    )
                  : "â€”"
              }
              color="emerald"
            />
          </div>
        )}

        {showForm && (
          <form
            onSubmit={handleCreate}
            className="mt-4 space-y-5 rounded-xl border border-blue-100 bg-blue-50/30 p-5"
          >
            {formError ? (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {formError}
              </div>
            ) : null}

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <FilterSelect
                label="Employee"
                value={form.teacherId}
                onChange={(v) => setForm({ ...form, teacherId: v })}
              >
                <option value="">Select employee…</option>
                {teachers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </FilterSelect>
              <FilterSelect
                label="Evaluation Type"
                value={form.evaluationType}
                onChange={(v) => setForm({ ...form, evaluationType: v })}
              >
                <option value="">Select type…</option>
                {EVAL_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </FilterSelect>
              <FilterInput
                label="Start Date"
                type="date"
                value={form.periodStart}
                onChange={(v) => setForm({ ...form, periodStart: v })}
              />
              <FilterInput
                label="End Date"
                type="date"
                value={form.periodEnd}
                onChange={(v) => setForm({ ...form, periodEnd: v })}
              />
            </div>

            <div className="rounded-xl border border-blue-100 bg-white px-4 py-3 text-sm text-gray-600">
              The selected period will be saved as{" "}
              <span className="font-semibold text-gray-900">
                {form.periodStart || "Open"} to {form.periodEnd || "Open"}
              </span>
              .
            </div>

            <div>
              <div className="mb-3 text-xs font-bold uppercase tracking-wider text-gray-400">
                Category Scores (1-5) — check &ldquo;Not Evaluated&rdquo; to skip a category without affecting the score
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                {categories.map((cat) => {
                  const notEval = form.categories[cat] === null;
                  return (
                    <div
                      key={cat}
                      className={`rounded-xl border p-3 ${notEval ? "border-gray-200 bg-gray-50 opacity-60" : "border-gray-200 bg-white"}`}
                    >
                      <div className="mb-1 flex items-center justify-between">
                        <div className="text-xs font-semibold text-gray-600">{cat}</div>
                        <label className="flex cursor-pointer items-center gap-1.5 text-xs text-gray-500">
                          <input
                            type="checkbox"
                            checked={notEval}
                            onChange={(e) =>
                              setForm({
                                ...form,
                                categories: {
                                  ...form.categories,
                                  [cat]: e.target.checked ? null : 3,
                                },
                              })
                            }
                            className="h-3.5 w-3.5 rounded"
                          />
                          Not Evaluated
                        </label>
                      </div>
                      {notEval ? (
                        <div className="mt-2 text-center text-xs text-gray-400 italic">Not scored</div>
                      ) : (
                        <>
                          <input
                            type="range"
                            min="1"
                            max="5"
                            step="1"
                            value={form.categories[cat] ?? 3}
                            onChange={(e) =>
                              setForm({
                                ...form,
                                categories: {
                                  ...form.categories,
                                  [cat]: parseInt(e.target.value),
                                },
                              })
                            }
                            className="mt-1 w-full accent-blue-600"
                          />
                          <div className="mt-1 text-center text-lg font-extrabold text-blue-800">
                            {form.categories[cat]}/5
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <TextArea
                label="Strengths"
                value={form.strengths}
                onChange={(v) => setForm({ ...form, strengths: v })}
              />
              <TextArea
                label="Areas for Improvement"
                value={form.areasForImprovement}
                onChange={(v) => setForm({ ...form, areasForImprovement: v })}
              />
              <TextArea
                label="Goals"
                value={form.goals}
                onChange={(v) => setForm({ ...form, goals: v })}
              />
              <TextArea
                label="Notes"
                value={form.notes}
                onChange={(v) => setForm({ ...form, notes: v })}
              />
            </div>

            <div className="flex items-center justify-between rounded-xl bg-white px-4 py-3 border border-gray-200">
              <div className="text-sm text-gray-600">
                Overall Score:{" "}
                <span className="text-lg font-extrabold text-blue-800">
                  {overallScore(form.categories) !== null ? `${overallScore(form.categories)}%` : "—"}
                </span>
                {Object.values(form.categories).some((v) => v === null) && (
                  <span className="ml-2 text-xs text-gray-400">
                    ({Object.values(form.categories).filter((v) => v === null).length} category not evaluated)
                  </span>
                )}
              </div>
              <SaveButton saving={saving} label="Save as Draft" />
            </div>
          </form>
        )}

        {loadError ? (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {loadError}
          </div>
        ) : null}
      </Card>

      {loading ? (
        <Loading />
      ) : evaluations.length === 0 ? (
        <EmptyCard
          icon="⭐"
          title={
            hasActiveFilters
              ? "No evaluations match these filters"
              : "No evaluations yet"
          }
          msg={
            hasActiveFilters
              ? "Adjust the employee, status, or date-range filters above to widen the history view."
              : "Create your first evaluation using the button above."
          }
        />
      ) : (
        <div className="space-y-3">
          {evaluations.map((ev) => {
            const expanded = expandedId === ev.id;
            return (
              <div
                key={ev.id}
                className={`rounded-2xl border bg-white transition ${expanded ? "border-blue-200 shadow-sm" : "border-gray-200"}`}
              >
                <div
                  className="flex flex-wrap items-center justify-between gap-3 cursor-pointer p-5"
                  onClick={() => setExpandedId(expanded ? null : ev.id)}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-800 to-sky-600 text-xs font-bold text-white">
                      {getInitials(ev.teacher?.name)}
                    </div>
                    <div>
                      <div className="text-sm font-bold text-gray-900">
                        {ev.teacher?.name}
                      </div>
                      <div className="text-xs text-gray-500">
                        Period: {formatEvaluationPeriod(ev)} - By:{" "}
                        {ev.evaluator?.name}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {ev.overallScore !== null && (
                      <span
                        className={`rounded-lg px-3 py-1.5 text-sm font-extrabold ${scoreColor(ev.overallScore)}`}
                      >
                        {ev.overallScore}%
                      </span>
                    )}
                    <Badge map={EVAL_STATUS_BADGE} value={ev.status} />
                    {ev.status === "DRAFT" && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSubmit(ev.id);
                        }}
                        className="rounded-lg bg-gradient-to-r from-blue-800 to-sky-600 px-3 py-1.5 text-xs font-bold text-white hover:from-blue-900 hover:to-sky-700 transition"
                      >
                        Submit
                      </button>
                    )}
                    <svg
                      className={`h-5 w-5 text-gray-400 transition ${expanded ? "rotate-180" : ""}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  </div>
                </div>

                {expanded && (
                  <div className="space-y-4 border-t border-gray-100 px-5 pb-5 pt-4">
                    {ev.categories && Object.keys(ev.categories).length > 0 && (
                      <div>
                        <div className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">
                          Category Scores
                        </div>
                        <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
                          {Object.entries(ev.categories).map(([cat, score]) => (
                            <div
                              key={cat}
                              className="rounded-xl border border-gray-100 bg-gray-50 p-3 text-center"
                            >
                              <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                                {cat}
                              </div>
                              <div className="mt-1 text-xl font-extrabold text-gray-800">
                                {score}
                                <span className="text-sm text-gray-400">
                                  /5
                                </span>
                              </div>
                              {/* Mini bar */}
                              <div className="mx-auto mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-gray-200">
                                <div
                                  className="h-1.5 rounded-full bg-blue-500"
                                  style={{ width: `${(score / 5) * 100}%` }}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {ev.strengths && (
                      <TextBlock label="Strengths" value={ev.strengths} />
                    )}
                    {ev.areasForImprovement && (
                      <TextBlock
                        label="Areas for Improvement"
                        value={ev.areasForImprovement}
                      />
                    )}
                    {ev.goals && <TextBlock label="Goals" value={ev.goals} />}
                    {ev.notes && <TextBlock label="Notes" value={ev.notes} />}
                    {ev.teacherAcknowledgedAt && (
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600">
                        <span>✓</span> Acknowledged on{" "}
                        {fmtDateTime(ev.teacherAcknowledgedAt)}
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
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function formatRole(role) {
  return String(role || "")
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function Badge({ map, value }) {
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-1 text-xs font-bold ${map[value] || "bg-gray-100 text-gray-600"}`}
    >
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
    <div
      className={`rounded-xl border p-4 ${colorMap[color] || colorMap.gray}`}
    >
      <div className="text-2xl font-extrabold">{String(value)}</div>
      <div className="mt-0.5 text-[10px] font-bold uppercase tracking-wider">
        {label}
      </div>
    </div>
  );
}

function MiniStat({ icon, label, value, colorClass }) {
  return (
    <div
      className={`flex items-center gap-3 rounded-xl border p-4 ${colorClass}`}
    >
      <span className="text-lg">{icon}</span>
      <div>
        <div className="text-xl font-extrabold">{value}</div>
        <div className="text-[10px] font-bold uppercase tracking-wider">
          {label}
        </div>
      </div>
    </div>
  );
}

function Card({ children }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6">
      {children}
    </div>
  );
}

function SectionTitle({ icon, title }) {
  return (
    <div className="flex items-center gap-2 text-sm font-extrabold text-gray-900">
      <span className="text-base">{icon}</span>
      {title}
    </div>
  );
}

function EvaluationCategoryManager({ centerId, categories, onSaved }) {
  const [draft, setDraft] = useState(categories);
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setDraft(categories);
  }, [categories]);

  function renameAt(index, value) {
    setDraft((prev) => prev.map((c, i) => (i === index ? value : c)));
  }

  function removeAt(index) {
    setDraft((prev) => prev.filter((_, i) => i !== index));
  }

  function addCategory() {
    const name = newName.trim();
    if (!name) return;
    if (draft.some((c) => c.toLowerCase() === name.toLowerCase())) {
      setError("That category already exists.");
      return;
    }
    setDraft((prev) => [...prev, name]);
    setNewName("");
    setError("");
  }

  async function save() {
    const cleaned = draft.map((c) => c.trim()).filter(Boolean);
    if (cleaned.length === 0) {
      setError("Keep at least one category.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const data = await apiJson(
        `/api/v1/evaluation-category-config?centerId=${centerId}`,
        { method: "PUT", body: JSON.stringify({ categories: cleaned }) },
      );
      onSaved(data.categories);
    } catch (e) {
      setError(e.message || "Failed to save categories");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-4 rounded-2xl border border-gray-200 bg-gray-50 p-4">
      <div className="mb-2 text-xs font-bold uppercase tracking-wider text-gray-400">
        Evaluation categories for this center — rename, remove, or add as many as you need
      </div>
      <div className="space-y-2">
        {draft.map((cat, index) => (
          <div key={index} className="flex items-center gap-2">
            <input
              value={cat}
              onChange={(e) => renameAt(index, e.target.value)}
              className="flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm shadow-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
            />
            <button
              type="button"
              onClick={() => removeAt(index)}
              className="rounded-xl border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50"
            >
              Remove
            </button>
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-2">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addCategory();
            }
          }}
          placeholder="New category name..."
          className="flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm shadow-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
        />
        <SecondaryButton onClick={addCategory}>+ Add</SecondaryButton>
      </div>
      {error ? <div className="mt-2 text-sm text-red-600">{error}</div> : null}
      <div className="mt-3 flex justify-end">
        <button
          type="button"
          onClick={save}
          disabled={saving || !centerId}
          className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50 transition"
        >
          {saving ? "Saving…" : "Save Categories"}
        </button>
      </div>
    </div>
  );
}

function PrimaryButton({ onClick, children, size = "md" }) {
  const sizeClass =
    size === "sm" ? "px-3 py-1.5 text-xs" : "px-5 py-2.5 text-sm";
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
      <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">
        {label}
      </div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm font-medium text-gray-900 focus:border-blue-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100"
        disabled={disabled}
      >
        {children}
      </select>
    </label>
  );
}

function FilterInput({ label, type, value, onChange }) {
  return (
    <label className="block">
      <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">
        {label}
      </div>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm font-medium text-gray-900 focus:border-blue-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100"
      />
    </label>
  );
}

function TextArea({ label, value, onChange }) {
  return (
    <label className="block">
      <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">
        {label}
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm font-medium text-gray-900 focus:border-blue-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100"
      />
    </label>
  );
}

function TextBlock({ label, value }) {
  return (
    <div className="rounded-xl bg-gray-50 p-4">
      <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
        {label}
      </div>
      <p className="mt-1.5 text-sm text-gray-700 whitespace-pre-wrap">
        {value}
      </p>
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
            <div className="text-xl font-black tracking-tight text-gray-900">
              {title}
            </div>
            {subtitle ? (
              <p className="mt-1 text-sm text-gray-500">{subtitle}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-gray-200 text-gray-500 transition hover:bg-gray-50 hover:text-gray-700"
            aria-label="Close modal"
          >
            <svg
              viewBox="0 0 24 24"
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 6l12 12M18 6L6 18"
              />
            </svg>
          </button>
        </div>
        <div className="mt-5">{children}</div>
      </div>
    </div>
  );
}

function Loading() {
  return (
    <div className="mt-4 rounded-xl border border-gray-100 bg-gray-50/50 p-6">
      <SkeletonTable rows={4} cols={4} />
    </div>
  );
}

function EmptyCard({ icon, title, msg }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white py-12 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-gray-100 text-2xl">
        {icon}
      </div>
      <p className="mt-4 text-sm font-bold text-gray-700">{title}</p>
      <p className="mt-1 text-xs text-gray-500">{msg}</p>
    </div>
  );
}
