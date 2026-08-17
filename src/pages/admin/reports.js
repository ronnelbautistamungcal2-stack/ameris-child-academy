import AdminLayout from "@/components/admin/AdminLayout";
import { SkeletonTable } from "@/components/ui/Skeleton";
import { apiJson } from "@/lib/api";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useState, useCallback } from "react";
import { useRouter } from "next/router";
import { AGE_GROUPS } from "@/lib/ageUtils";

// Lazy-load chart components (no SSR for recharts)
const ProgressPieChart = dynamic(() => import("@/components/analytics/charts/ProgressPieChart"), { ssr: false });
const DomainBarChart = dynamic(() => import("@/components/analytics/charts/DomainBarChart"), { ssr: false });
const DomainRadarChart = dynamic(() => import("@/components/analytics/charts/DomainRadarChart"), { ssr: false });
const TrendLineChart = dynamic(() => import("@/components/analytics/charts/TrendLineChart"), { ssr: false });
const CategoryBarChart = dynamic(() => import("@/components/analytics/charts/CategoryBarChart"), { ssr: false });
const BehaviorFlowChart = dynamic(() => import("@/components/analytics/charts/BehaviorFlowChart"), { ssr: false });

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "students", label: "Student Performance" },
  { key: "teachers", label: "Teacher Performance" },
  { key: "class-performance", label: "Class Performance" },
  { key: "coach-performance", label: "Coach Performance" },
  { key: "other-staff", label: "Other Staff Performance" },
  { key: "query", label: "Custom Query" },
];

const DOMAIN_META = {
  cognitive: { label: "Cognitive", color: "text-blue-800 bg-blue-50" },
  social: { label: "Social-Emotional", color: "text-sky-700 bg-sky-50" },
  physical: { label: "Physical", color: "text-emerald-700 bg-emerald-50" },
  language: { label: "Language", color: "text-amber-700 bg-amber-50" },
  creative: { label: "Creative", color: "text-rose-700 bg-rose-50" },
};

const STATUS_BADGE = {
  NOT_STARTED: "bg-gray-100 text-gray-700",
  IN_PROGRESS: "bg-amber-100 text-amber-800",
  COMPLETED: "bg-emerald-100 text-emerald-800",
  PASSED: "bg-emerald-100 text-emerald-800",
  FAILED: "bg-red-100 text-red-800",
  ACTIVE: "bg-sky-100 text-sky-800",
  ARCHIVED: "bg-gray-100 text-gray-600",
  MET: "bg-emerald-100 text-emerald-800",
  NOT_MET: "bg-red-100 text-red-800",
};

const GOAL_STATUS_LABEL = { NOT_STARTED: "Not Started", IN_PROGRESS: "In Progress", MET: "Met", NOT_MET: "Not Met" };

function fullName(obj) {
  if (!obj) return "";
  return `${obj.firstName || ""}${obj.lastName ? ` ${obj.lastName}` : ""}`.trim();
}

function fmtDate(d) {
  if (!d) return "";
  return new Date(d).toLocaleDateString();
}

function defaultDateFrom() {
  const d = new Date();
  d.setDate(d.getDate() - 90);
  return d.toISOString().split("T")[0];
}
function defaultDateTo() {
  return new Date().toISOString().split("T")[0];
}

function currentPeriod() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

// ─── Main Component ───────────────────────────────────────────

export default function AdminReports() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("overview");

  // Shared filters
  const [centers, setCenters] = useState([]);
  const [centerId, setCenterId] = useState("");
  const [classes, setClasses] = useState([]);
  const [classId, setClassId] = useState("");
  const [ageGroup, setAgeGroup] = useState("");
  const [dateFrom, setDateFrom] = useState(defaultDateFrom());
  const [dateTo, setDateTo] = useState(defaultDateTo());

  const [children, setChildren] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Load centers on mount
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const c = await apiJson("/api/v1/centers");
        const arr = Array.isArray(c) ? c : [];
        setCenters(arr);
        const fromQuery = typeof router.query.centerId === "string" ? router.query.centerId : "";
        setCenterId(fromQuery || (arr.length === 1 ? arr[0].id : ""));
        if (router.query.tab) setActiveTab(router.query.tab);
      } catch (e) {
        setError(e.message || "Failed to load centers");
      } finally {
        setLoading(false);
      }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Load classes + children when center changes
  useEffect(() => {
    if (!centerId) {
      setClasses([]);
      setChildren([]);
      return;
    }
    (async () => {
      try {
        const [cls, kids] = await Promise.all([
          apiJson(`/api/v1/classes?centerId=${encodeURIComponent(centerId)}`).catch(() => []),
          apiJson(`/api/v1/children?centerId=${encodeURIComponent(centerId)}`).catch(() => []),
        ]);
        setClasses(Array.isArray(cls) ? cls : []);
        const sorted = (Array.isArray(kids) ? kids : []).sort((a, b) =>
          (a.firstName || "").localeCompare(b.firstName || "")
        );
        setChildren(sorted);
      } catch {}
    })();
  }, [centerId]);

  function printActiveReport() {
    window.print();
  }

  return (
    <AdminLayout title="Reports & Analytics">
      <div className="space-y-4">
        {/* Header + Filters */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-extrabold text-gray-900">Reporting & Analytics</h2>
              <p className="mt-1 text-sm text-gray-600">
                Charts, behavior tracking, teacher performance, and custom queries.
              </p>
            </div>
            <button
              type="button"
              onClick={printActiveReport}
              className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-800 shadow-sm hover:bg-gray-50"
            >
              Print Report
            </button>
          </div>

          {/* Filters row */}
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-5">
            <FilterSelect label="Center" value={centerId} onChange={setCenterId} disabled={loading}>
              <option value="">Select a center…</option>
              {centers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </FilterSelect>
            <FilterSelect label="Class" value={classId} onChange={setClassId} disabled={!centerId}>
              <option value="">All classes</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </FilterSelect>
            <FilterSelect label="Age Group" value={ageGroup} onChange={setAgeGroup}>
              <option value="">All ages</option>
              {AGE_GROUPS.map((g) => <option key={g.key} value={g.key}>{g.label}</option>)}
            </FilterSelect>
            <FilterInput label="From" type="date" value={dateFrom} onChange={setDateFrom} />
            <FilterInput label="To" type="date" value={dateTo} onChange={setDateTo} />
          </div>

          {/* Tabs */}
          <div className="mt-4 flex gap-1 overflow-x-auto border-b border-gray-200">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={[
                  "whitespace-nowrap px-4 py-2.5 text-sm font-semibold transition",
                  activeTab === tab.key
                    ? "border-b-2 border-sky-600 text-sky-700"
                    : "text-gray-500 hover:text-gray-700",
                ].join(" ")}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>
        )}

        {!centerId ? (
          <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-600">
            Select a center to view analytics.
          </div>
        ) : (
          <>
            {activeTab === "overview" && (
              <OverviewTab centerId={centerId} classId={classId} ageGroup={ageGroup} dateFrom={dateFrom} dateTo={dateTo} />
            )}
            {activeTab === "students" && (
              <StudentsTab centerId={centerId} children={children} />
            )}
            {activeTab === "teachers" && (
              <TeachersTab centerId={centerId} />
            )}
            {activeTab === "class-performance" && (
              <ClassPerformanceTab centerId={centerId} classes={classes} dateFrom={dateFrom} dateTo={dateTo} />
            )}
            {activeTab === "coach-performance" && (
              <CoachPerformanceTab centerId={centerId} dateFrom={dateFrom} dateTo={dateTo} />
            )}
            {activeTab === "other-staff" && (
              <OtherStaffPerformanceTab centerId={centerId} dateFrom={dateFrom} dateTo={dateTo} />
            )}
            {activeTab === "query" && (
              <QueryTab centerId={centerId} children={children} classes={classes} />
            )}
          </>
        )}
      </div>
    </AdminLayout>
  );
}

// ─── Overview Tab ─────────────────────────────────────────────

function OverviewTab({ centerId, classId, ageGroup, dateFrom, dateTo }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ centerId });
        if (classId) params.set("classId", classId);
        if (ageGroup) params.set("ageGroup", ageGroup);
        if (dateFrom) params.set("from", dateFrom);
        if (dateTo) params.set("to", dateTo);
        const r = await apiJson(`/api/v1/analytics/overview?${params}`);
        setData(r);
      } catch {}
      setLoading(false);
    })();
  }, [centerId, classId, ageGroup, dateFrom, dateTo]);

  if (loading) return <Loading />;
  if (!data) return <Empty msg="No data available." />;

  const trendLines = [
    { key: "cognitive", label: "Cognitive", color: "#7c3aed" },
    { key: "social", label: "Social", color: "#0284c7" },
    { key: "physical", label: "Physical", color: "#059669" },
    { key: "language", label: "Language", color: "#d97706" },
    { key: "creative", label: "Creative", color: "#e11d48" },
  ];

  return (
    <div className="space-y-4">
      {/* KPI cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <KpiCard label="Children" value={data.children?.total || 0} color="sky" />
        <KpiCard label="Completion Rate" value={`${data.progress?.completionRate || 0}%`} color="emerald" />
        <KpiCard label="Behavior Avg" value={`${data.behavior?.overallAvg || 0} / 4`} color="violet" />
        <KpiCard label="Attendance Rate" value={`${data.attendance?.avgDailyRate || 0}%`} color="amber" />
        <KpiCard label="Total Goals" value={data.progress?.totalGoals || 0} color="gray" />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard title="Progress Status Distribution">
          <ProgressPieChart data={data.progress?.statusDistribution || {}} />
        </ChartCard>
        <ChartCard title="Behavior Domain Averages">
          <DomainBarChart data={data.behavior?.avgDomainScores || {}} />
        </ChartCard>
      </div>

      {/* Trend chart */}
      <ChartCard title="Behavior Score Trends (Weekly)">
        <TrendLineChart
          data={data.behavior?.trendByWeek || []}
          lines={trendLines}
          yDomain={[0, 4]}
          yLabel="Score"
        />
      </ChartCard>
    </div>
  );
}

// ─── Students Tab (Student Performance Report) ────────────────

const ACTIVITY_TYPE_LABELS = {
  DIAPER_CHANGE: "Diaper Change",
  NAP: "Nap",
  BOTTLE: "Bottle",
  MEAL: "Meal",
  SNACK: "Snack",
  ACTIVITY: "Activity",
  TASK_CHECKLIST: "Task Checklist",
  BEHAVIOR: "Course Correction",
  CITIZENSHIP: "Citizenship",
  ACCOMPLISHMENT: "Accomplishment",
  INCIDENT: "Incident",
  TOILETING: "Toileting",
  CHARACTER_HIGHLIGHT: "Character Highlight",
  OTHER: "Grade",
};

const TOILETING_TYPE_LABELS = {
  SUCCESS: "Success",
  TRIED: "Tried",
  ACCIDENT: "Accident",
};

const CHARACTER_HIGHLIGHT_TYPE_LABELS = {
  BROTHERS_KEEPER: "Brother's Keeper",
  CHAMPION_OF_VIRTUE: "Champion of Virtue",
  FULL_REPENTANCE: "Full Repentance",
  CHAMPION_OF_OBEDIENCE: "Champion of Obedience",
  CHAMPION_OF_RESPECT: "Champion of Respect",
  CHAMPION_OF_HONESTY: "Champion of Honesty",
  OTHER: "Other",
};

function filterByDateRange(items, from, to, field = "createdAt") {
  const f = from ? new Date(from) : null;
  const t = to ? new Date(to) : null;
  return items.filter((item) => {
    const d = item[field] ? new Date(item[field]) : null;
    if (!d) return true;
    if (f && d < f) return false;
    if (t && d > new Date(t.getTime() + 86400000)) return false;
    return true;
  });
}

function StudentsTab({ centerId, children }) {
  const [childId, setChildId] = useState("");
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showPlanForm, setShowPlanForm] = useState(false);

  // Section-specific filters
  const [citizenshipFrom, setCitizenshipFrom] = useState(defaultDateFrom());
  const [citizenshipTo, setCitizenshipTo] = useState(defaultDateTo());
  const [milestonesAgeGroup, setMilestonesAgeGroup] = useState("");
  const [accomplishmentFrom, setAccomplishmentFrom] = useState(defaultDateFrom());
  const [accomplishmentTo, setAccomplishmentTo] = useState(defaultDateTo());
  const [citizenshipLogFrom, setCitizenshipLogFrom] = useState(defaultDateFrom());
  const [citizenshipLogTo, setCitizenshipLogTo] = useState(defaultDateTo());
  const [activityLogFrom, setActivityLogFrom] = useState(defaultDateFrom());
  const [activityLogTo, setActivityLogTo] = useState(defaultDateTo());

  useEffect(() => {
    if (!childId) { setReport(null); return; }
    setLoading(true);
    apiJson(`/api/v1/analytics/child-report?childId=${encodeURIComponent(childId)}`)
      .then((r) => setReport(r))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [childId]);

  function refreshReport() {
    if (!childId) return;
    setLoading(true);
    apiJson(`/api/v1/analytics/child-report?childId=${encodeURIComponent(childId)}`)
      .then((r) => setReport(r))
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  // Derived / filtered data
  const citizenshipGrades = useMemo(() => {
    const all = report?.citizenshipGrades || [];
    return filterByDateRange(all, citizenshipFrom, citizenshipTo);
  }, [report, citizenshipFrom, citizenshipTo]);

  const citizenshipChartData = useMemo(() => citizenshipGrades.map((g) => ({
    label: new Date(g.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    score: g.score || 0,
  })), [citizenshipGrades]);

  const milestonesData = useMemo(() => {
    const all = report?.progress?.milestonesByCategory || [];
    if (!milestonesAgeGroup) return all;
    // Filter by age group — lesson category names that match the selected group
    return all.filter((c) => {
      const name = (c.category || "").toLowerCase();
      const group = AGE_GROUPS.find((g) => g.key === milestonesAgeGroup);
      if (!group) return true;
      return group.tags.some((t) => name.includes(t));
    });
  }, [report, milestonesAgeGroup]);

  const milestoneChartData = useMemo(() => milestonesData.map((c) => ({
    category: c.category,
    "% Passed": c.passRate || 0,
  })), [milestonesData]);

  const activeGoals = useMemo(() => report?.progress?.activeGoals || [], [report]);

  const filteredAccomplishments = useMemo(() => {
    const all = report?.accomplishments || [];
    return filterByDateRange(all, accomplishmentFrom, accomplishmentTo);
  }, [report, accomplishmentFrom, accomplishmentTo]);

  const filteredCitizenshipLogs = useMemo(() => {
    const all = report?.citizenshipLogs || [];
    return filterByDateRange(all, citizenshipLogFrom, citizenshipLogTo);
  }, [report, citizenshipLogFrom, citizenshipLogTo]);

  const filteredActivityLogs = useMemo(() => {
    const all = report?.activityLogs || [];
    return filterByDateRange(all, activityLogFrom, activityLogTo);
  }, [report, activityLogFrom, activityLogTo]);

  const redFlags = useMemo(() => report?.redFlags || [], [report]);
  const behaviorPlans = useMemo(() => report?.behaviorPlans || [], [report]);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-gray-200 bg-white p-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1">
            <FilterSelect label="Select Child" value={childId} onChange={setChildId}>
              <option value="">Choose a child…</option>
              {children.map((c) => <option key={c.id} value={c.id}>{fullName(c)}</option>)}
            </FilterSelect>
          </div>
          {childId && (
            <button
              type="button"
              onClick={() => window.print()}
              className="mt-4 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
            >
              Print Report
            </button>
          )}
        </div>
      </div>

      {loading && <Loading />}
      {!childId && !loading && <Empty msg="Select a child to view their Student Performance Report." />}

      {report && !loading && (
        <div className="space-y-4">

          {/* ── Summary Stats ── */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <KpiCard label="Total Goals" value={report.progress?.totalGoals || 0} color="gray" />
            <KpiCard label="Completed" value={report.progress?.completed || 0} color="emerald" />
            <KpiCard label="Failed" value={report.progress?.failed || 0} color="red" />
            <KpiCard label="Completion Rate" value={`${report.progress?.completionRate || 0}%`} color="sky" />
          </div>

          {/* ── Citizenship Grade + Milestones Grade ── */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {/* Citizenship Grade */}
            <div className="rounded-2xl border border-gray-200 bg-white p-5">
              <div className="text-sm font-extrabold text-gray-900">Citizenship Grade</div>
              <p className="mt-0.5 text-xs text-gray-500">From log activity "grade" — score over time.</p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <FilterInput label="Start Date" type="date" value={citizenshipFrom} onChange={setCitizenshipFrom} />
                <FilterInput label="End Date" type="date" value={citizenshipTo} onChange={setCitizenshipTo} />
              </div>
              <div className="mt-3">
                <TrendLineChart
                  data={citizenshipChartData}
                  lines={[{ key: "score", label: "Score", color: "#0284c7" }]}
                  yLabel="Score"
                />
              </div>
            </div>

            {/* Milestones Grade */}
            <div className="rounded-2xl border border-gray-200 bg-white p-5">
              <div className="text-sm font-extrabold text-gray-900">Milestones Grade</div>
              <p className="mt-0.5 text-xs text-gray-500">From steps of progression completed — % passed by category.</p>
              <div className="mt-3">
                <FilterSelect label="Filter by Age Group" value={milestonesAgeGroup} onChange={setMilestonesAgeGroup}>
                  <option value="">All age groups</option>
                  {AGE_GROUPS.map((g) => <option key={g.key} value={g.key}>{g.label}</option>)}
                </FilterSelect>
              </div>
              <div className="mt-3">
                {milestoneChartData.length > 0 ? (
                  <MilestonesBarChart data={milestoneChartData} />
                ) : (
                  <div className="flex h-48 items-center justify-center text-sm text-gray-500">No milestone data.</div>
                )}
              </div>
            </div>
          </div>

          {/* ── Active Goals ── */}
          <div className="rounded-2xl border border-gray-200 bg-white p-5">
            <div className="text-sm font-extrabold text-gray-900">Active Goals</div>
            <p className="mt-0.5 text-xs text-gray-500">Goals this student is currently working on.</p>
            {activeGoals.length > 0 ? (
              <div className="mt-3 space-y-2">
                {activeGoals.map((g) => (
                  <div key={g.id} className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                    <div>
                      <div className="text-sm font-semibold text-gray-900">{g.lessonTitle || "—"}</div>
                      {g.categoryName && <div className="text-xs text-gray-500">{g.categoryName}</div>}
                    </div>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_BADGE[g.status] || "bg-gray-100 text-gray-700"}`}>
                      {g.status?.replace(/_/g, " ")}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-3 rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm text-gray-500">No active goals.</div>
            )}
          </div>

          {/* ── Accomplishments + Citizenship Log ── */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {/* Accomplishments */}
            <div className="rounded-2xl border border-gray-200 bg-white p-5">
              <div className="text-sm font-extrabold text-gray-900">Accomplishments</div>
              <p className="mt-0.5 text-xs text-gray-500">From log activity "Accomplishments".</p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <FilterInput label="Start Date" type="date" value={accomplishmentFrom} onChange={setAccomplishmentFrom} />
                <FilterInput label="End Date" type="date" value={accomplishmentTo} onChange={setAccomplishmentTo} />
              </div>
              {filteredAccomplishments.length > 0 ? (
                <div className="mt-3 space-y-2">
                  {filteredAccomplishments.map((a) => (
                    <div key={a.id} className="rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2">
                      <div className="text-xs text-emerald-600">{fmtDate(a.createdAt)}</div>
                      <div className="mt-0.5 text-sm text-emerald-900">{a.notes || a.details?.text || "Accomplishment recorded."}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-3 rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm text-gray-500">No accomplishments found.</div>
              )}
            </div>

            {/* Citizenship Log */}
            <div className="rounded-2xl border border-gray-200 bg-white p-5">
              <div className="text-sm font-extrabold text-gray-900">Citizenship Log</div>
              <p className="mt-0.5 text-xs text-gray-500">From log activity "Citizenship".</p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <FilterInput label="Start Date" type="date" value={citizenshipLogFrom} onChange={setCitizenshipLogFrom} />
                <FilterInput label="End Date" type="date" value={citizenshipLogTo} onChange={setCitizenshipLogTo} />
              </div>
              {filteredCitizenshipLogs.length > 0 ? (
                <div className="mt-3 space-y-2">
                  {filteredCitizenshipLogs.map((a) => (
                    <div key={a.id} className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                      <div className="text-xs text-gray-500">{fmtDate(a.createdAt)}</div>
                      <div className="mt-0.5 text-sm text-gray-900">{a.notes || a.details?.text || "Citizenship log entry."}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-3 rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm text-gray-500">No citizenship log entries found.</div>
              )}
            </div>
          </div>

          {/* ── Red Flags ── */}
          <div className="rounded-2xl border border-gray-200 bg-white p-5">
            <div className="text-sm font-extrabold text-gray-900">Red Flags</div>
            <p className="mt-0.5 text-xs text-gray-500">Active flags recorded on this student.</p>
            {redFlags.length > 0 ? (
              <div className="mt-3 space-y-2">
                {redFlags.map((f) => (
                  <div key={f.id} className="flex items-start gap-3 rounded-lg border border-red-100 bg-red-50 px-3 py-2">
                    <div className="mt-0.5 flex-shrink-0 h-2 w-2 rounded-full bg-red-500" />
                    <div className="flex-1">
                      <div className="text-sm font-semibold text-red-900">
                        {f.snapshot?.type === "INDIVIDUAL_PROGRESS_PLAN"
                          ? `Individual Progress Plan: ${f.snapshot.planTitle || "Plan"} (Parent Approved)`
                          : f.flagKey?.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) || "Flag"}
                      </div>
                      <div className="text-xs text-red-600">{fmtDate(f.createdAt)}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-3 rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm text-gray-500">No active red flags.</div>
            )}
          </div>

          {/* ── Individual Progress Plans ── */}
          <div className="rounded-2xl border border-gray-200 bg-white p-5">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-extrabold text-gray-900">Individual Progress Plan</div>
                <p className="mt-0.5 text-xs text-gray-600">Intervention plans for this child. Parent approval required.</p>
              </div>
              <button
                onClick={() => setShowPlanForm(!showPlanForm)}
                className="rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-700"
              >
                {showPlanForm ? "Cancel" : "Create Plan"}
              </button>
            </div>

            {showPlanForm && (
              <BehaviorPlanForm
                childId={childId}
                centerId={centerId}
                onCreated={() => { setShowPlanForm(false); refreshReport(); }}
              />
            )}

            {behaviorPlans.length > 0 ? (
              <div className="mt-3 space-y-3">
                {behaviorPlans.map((plan) => (
                  <BehaviorPlanCard key={plan.id} plan={plan} onUpdated={refreshReport} />
                ))}
              </div>
            ) : !showPlanForm ? (
              <div className="mt-3 rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm text-gray-600">
                No Individual Progress Plans on file.
              </div>
            ) : null}
          </div>

          {/* ── Student Activity Log ── */}
          <div className="rounded-2xl border border-gray-200 bg-white p-5">
            <div className="text-sm font-extrabold text-gray-900">Student Activity Log</div>
            <p className="mt-0.5 text-xs text-gray-500">Daily activity log (similar to Procare).</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <FilterInput label="Start Date" type="date" value={activityLogFrom} onChange={setActivityLogFrom} />
              <FilterInput label="End Date" type="date" value={activityLogTo} onChange={setActivityLogTo} />
            </div>
            {filteredActivityLogs.length > 0 ? (
              <div className="mt-3 space-y-2">
                {filteredActivityLogs.slice(0, 50).map((a) => (
                  <ActivityLogEntry key={a.id} activity={a} />
                ))}
                {filteredActivityLogs.length > 50 && (
                  <div className="text-xs text-gray-500 text-center py-1">Showing 50 of {filteredActivityLogs.length} entries.</div>
                )}
              </div>
            ) : (
              <div className="mt-3 rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm text-gray-500">No activity logs found.</div>
            )}
          </div>

        </div>
      )}
    </div>
  );
}

// ─── Milestones Bar Chart ──────────────────────────────────────

const MilestonesBarChart = dynamic(
  () => import("recharts").then((mod) => {
    const { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } = mod;
    function Chart({ data = [] }) {
      if (!data.length) return <div className="flex h-48 items-center justify-center text-sm text-gray-500">No data.</div>;
      return (
        <ResponsiveContainer width="100%" height={Math.max(200, data.length * 36)}>
          <BarChart data={data} layout="vertical" margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={false} />
            <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11 }} />
            <YAxis dataKey="category" type="category" tick={{ fontSize: 11 }} width={120} />
            <Tooltip formatter={(v) => `${v}%`} contentStyle={{ fontSize: 12 }} />
            <Bar dataKey="% Passed" fill="#059669" radius={[0, 4, 4, 0]} maxBarSize={24} />
          </BarChart>
        </ResponsiveContainer>
      );
    }
    return { default: Chart };
  }),
  { ssr: false }
);

// ─── Activity Log Entry ────────────────────────────────────────

function ActivityLogEntry({ activity: a }) {
  const typeLabel = ACTIVITY_TYPE_LABELS[a.type] || a.type;
  const time = a.createdAt
    ? new Date(a.createdAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
    : "";
  const details = a.details && typeof a.details === "object" ? a.details : {};

  function renderDetails() {
    if (a.type === "NAP") {
      const start = details.start ? new Date(details.start).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : null;
      const end = details.end ? new Date(details.end).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : null;
      if (start && end) return `Slept from ${start} to ${end}`;
      if (start) return `Nap started at ${start}`;
    }
    if (a.type === "BOTTLE") {
      const parts = [];
      if (details.amount) parts.push(`Served ${details.amount}`);
      if (details.consumed) parts.push(`Consumed ${details.consumed}`);
      if (details.formula) parts.push(details.formula);
      if (parts.length) return parts.join(" • ");
    }
    if (a.type === "MEAL" || a.type === "SNACK") {
      const parts = [];
      if (details.food) parts.push(details.food);
      if (details.amount) parts.push(details.amount);
      if (a.notes) parts.push(a.notes);
      return parts.join(" | ") || null;
    }
    if (a.type === "TOILETING") {
      const parts = [];
      if (details.toiletingType) parts.push(TOILETING_TYPE_LABELS[details.toiletingType] || details.toiletingType);
      if (a.notes) parts.push(a.notes);
      return parts.join(" | ") || null;
    }
    if (a.type === "CHARACTER_HIGHLIGHT") {
      const parts = [];
      if (details.characterHighlightType) {
        parts.push(CHARACTER_HIGHLIGHT_TYPE_LABELS[details.characterHighlightType] || details.characterHighlightType);
      }
      if (a.notes) parts.push(a.notes);
      return parts.join(" | ") || null;
    }
    return a.notes || null;
  }

  const detailText = renderDetails();

  return (
    <div className="flex gap-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5">
      <div className="flex-shrink-0 mt-0.5">
        <ActivityIcon type={a.type} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-900">{typeLabel}</span>
          <span className="text-xs text-gray-500">{time}</span>
        </div>
        {detailText && <div className="mt-0.5 text-xs text-gray-600">{detailText}</div>}
      </div>
    </div>
  );
}

function ActivityIcon({ type }) {
  const icons = {
    NAP: "💤", BOTTLE: "🍼", MEAL: "🍽️", SNACK: "🥨",
    DIAPER_CHANGE: "🧷", ACTIVITY: "🎨", CITIZENSHIP: "⭐",
    ACCOMPLISHMENT: "🏆", INCIDENT: "⚠️", BEHAVIOR: "📋",
    TASK_CHECKLIST: "✅", TOILETING: "🚽", OTHER: "📝",
  };
  return <span className="text-base">{icons[type] || "📄"}</span>;
}

// ─── Behavior Tab ─────────────────────────────────────────────

function BehaviorTab({ centerId, classId, children, dateFrom, dateTo }) {
  const [scores, setScores] = useState(null);
  const [selectedChildId, setSelectedChildId] = useState("");
  const [childScores, setChildScores] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ centerId, groupBy: "week" });
        if (classId) params.set("classId", classId);
        if (dateFrom) params.set("from", dateFrom);
        if (dateTo) params.set("to", dateTo);
        const r = await apiJson(`/api/v1/analytics/behavior-scores?${params}`);
        setScores(r);
      } catch {}
      setLoading(false);
    })();
  }, [centerId, classId, dateFrom, dateTo]);

  // Per-child drill-down
  useEffect(() => {
    if (!selectedChildId) { setChildScores(null); return; }
    (async () => {
      try {
        const params = new URLSearchParams({ centerId, childId: selectedChildId, groupBy: "day" });
        if (dateFrom) params.set("from", dateFrom);
        if (dateTo) params.set("to", dateTo);
        const r = await apiJson(`/api/v1/analytics/behavior-scores?${params}`);
        setChildScores(r);
      } catch {}
    })();
  }, [selectedChildId, centerId, dateFrom, dateTo]);

  if (loading) return <Loading />;
  if (!scores) return <Empty msg="No behavior data available." />;

  // Build child summary table from per-child scores
  const childSummary = useMemo(() => {
    const map = {};
    for (const s of scores.scores || []) {
      if (!s.childId) continue;
      if (!map[s.childId]) {
        map[s.childId] = { childId: s.childId, childName: s.childName, _sum: 0, _count: 0 };
      }
      if (typeof s.avg === "number") {
        map[s.childId]._sum += s.avg;
        map[s.childId]._count += 1;
      }
    }
    return Object.values(map)
      .map((c) => ({ ...c, avgScore: c._count > 0 ? Math.round((c._sum / c._count) * 100) / 100 : 0 }))
      .sort((a, b) => a.avgScore - b.avgScore);
  }, [scores]);

  return (
    <div className="space-y-4">
      {/* Aggregate domain bar chart */}
      <ChartCard title="Center-wide Behavior Domain Averages">
        <DomainBarChart data={
          Object.fromEntries(
            Object.entries(scores.aggregated || {}).map(([k, v]) => [k, v.avg || 0])
          )
        } />
      </ChartCard>

      {/* Trend */}
      <ChartCard title="Behavior Score Trends (Weekly)">
        <TrendLineChart
          data={(scores.scores || []).filter((s) => s.label)}
          lines={[
            { key: "cognitive", label: "Cognitive", color: "#7c3aed" },
            { key: "social", label: "Social", color: "#0284c7" },
            { key: "physical", label: "Physical", color: "#059669" },
            { key: "language", label: "Language", color: "#d97706" },
            { key: "creative", label: "Creative", color: "#e11d48" },
          ]}
          yDomain={[0, 4]}
        />
      </ChartCard>

      {/* Domain trend summary */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5">
        <div className="text-sm font-extrabold text-gray-900">Domain Trends</div>
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-5">
          {Object.entries(scores.aggregated || {}).map(([key, val]) => (
            <div key={key} className={`rounded-xl border p-3 ${DOMAIN_META[key]?.color || "bg-gray-50"}`}>
              <div className="text-xs font-semibold uppercase tracking-wide">{DOMAIN_META[key]?.label || key}</div>
              <div className="mt-1 text-xl font-extrabold">{val.avg || 0}</div>
              <div className="text-xs">
                Trend: <span className={val.trend === "improving" ? "text-emerald-700 font-semibold" : val.trend === "declining" ? "text-red-700 font-semibold" : "text-gray-600"}>{val.trend || "stable"}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Children attention table */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5">
        <div className="text-sm font-extrabold text-gray-900">Children by Behavior Score</div>
        <p className="mt-0.5 text-xs text-gray-600">Sorted by lowest average — children needing attention at top.</p>
        {childSummary.length > 0 ? (
          <div className="mt-3 overflow-auto rounded-xl border border-gray-200">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-2 text-left">Child</th>
                  <th className="px-4 py-2 text-left">Avg Score</th>
                  <th className="px-4 py-2 text-left">Assessments</th>
                  <th className="px-4 py-2 text-left">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {childSummary.map((c) => (
                  <tr key={c.childId} className={c.avgScore < 2 ? "bg-red-50" : ""}>
                    <td className="px-4 py-2 font-semibold text-gray-900">{c.childName}</td>
                    <td className="px-4 py-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${c.avgScore >= 3 ? "bg-emerald-100 text-emerald-800" : c.avgScore >= 2 ? "bg-amber-100 text-amber-800" : "bg-red-100 text-red-800"}`}>
                        {c.avgScore} / 4
                      </span>
                    </td>
                    <td className="px-4 py-2 text-gray-600">{c._count}</td>
                    <td className="px-4 py-2">
                      <button
                        onClick={() => setSelectedChildId(c.childId === selectedChildId ? "" : c.childId)}
                        className="text-xs font-semibold text-sky-600 hover:text-sky-800"
                      >
                        {c.childId === selectedChildId ? "Hide" : "View Details"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="mt-3 rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm text-gray-600">
            No behavior assessments found in this period.
          </div>
        )}
      </div>

      {/* Child drill-down */}
      {selectedChildId && childScores && (
        <ChartCard title={`Behavior Flow — ${childSummary.find((c) => c.childId === selectedChildId)?.childName || "Child"}`}>
          <BehaviorFlowChart
            data={(childScores.scores || []).map((s) => ({
              label: s.date,
              ...(s.domains || {}),
            }))}
          />
        </ChartCard>
      )}
    </div>
  );
}

// ─── Teachers Tab ─────────────────────────────────────────────

function gradeColor(g) {
  if (g == null) return "text-gray-400";
  if (g >= 80) return "text-emerald-700";
  if (g >= 60) return "text-amber-700";
  return "text-red-700";
}
function gradeBg(g) {
  if (g == null) return "bg-gray-50 border-gray-200 text-gray-500";
  if (g >= 80) return "bg-emerald-50 border-emerald-200 text-emerald-800";
  if (g >= 60) return "bg-amber-50 border-amber-200 text-amber-800";
  return "bg-red-50 border-red-200 text-red-800";
}
function gradeLetter(g) {
  if (g == null) return "N/A";
  if (g >= 90) return "A";
  if (g >= 80) return "B";
  if (g >= 70) return "C";
  if (g >= 60) return "D";
  return "F";
}

function TeachersTab({ centerId }) {
  const [teacherList, setTeacherList] = useState([]);
  const [teacherId, setTeacherId] = useState("");
  const [dateFrom, setDateFrom] = useState(defaultDateFrom());
  const [dateTo, setDateTo] = useState(defaultDateTo());
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingTeachers, setLoadingTeachers] = useState(true);

  // Grade config editor
  const [gradeConfig, setGradeConfig] = useState(null);
  const [editingConfig, setEditingConfig] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [configDraft, setConfigDraft] = useState({});

  // Commendation / Citation forms
  const [newCommendation, setNewCommendation] = useState("");
  const [newCitation, setNewCitation] = useState("");
  const [savingComm, setSavingComm] = useState(false);
  const [savingCit, setSavingCit] = useState(false);

  useEffect(() => {
    if (!centerId) return;
    setLoadingTeachers(true);
    apiJson(`/api/v1/users?centerId=${encodeURIComponent(centerId)}&roles=TEACHER`)
      .then((r) => {
        const arr = Array.isArray(r) ? r : [];
        setTeacherList(arr);
        if (arr.length === 1) setTeacherId(arr[0].id);
      })
      .catch(() => {})
      .finally(() => setLoadingTeachers(false));
  }, [centerId]);

  useEffect(() => {
    if (!centerId) return;
    apiJson(`/api/v1/performance-grade-config?centerId=${encodeURIComponent(centerId)}`)
      .then((r) => { setGradeConfig(r); setConfigDraft(r); })
      .catch(() => {});
  }, [centerId]);

  const loadReport = useCallback(async () => {
    if (!centerId || !teacherId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ centerId, teacherId, from: dateFrom, to: dateTo });
      const r = await apiJson(`/api/v1/analytics/teacher-perf-report?${params}`);
      setReport(r);
    } catch {}
    setLoading(false);
  }, [centerId, teacherId, dateFrom, dateTo]);

  useEffect(() => { loadReport(); }, [loadReport]);

  async function saveConfig() {
    setSavingConfig(true);
    try {
      const r = await apiJson(`/api/v1/performance-grade-config?centerId=${encodeURIComponent(centerId)}`, {
        method: "PUT",
        body: JSON.stringify(configDraft),
      });
      setGradeConfig(r);
      setEditingConfig(false);
      await loadReport();
    } catch {}
    setSavingConfig(false);
  }

  async function addCommendation() {
    if (!newCommendation.trim() || !teacherId) return;
    setSavingComm(true);
    try {
      await apiJson("/api/v1/teacher-commendations", {
        method: "POST",
        body: JSON.stringify({ centerId, teacherId, text: newCommendation.trim() }),
      });
      setNewCommendation("");
      await loadReport();
    } catch {}
    setSavingComm(false);
  }

  async function deleteCommendation(id) {
    try {
      await apiJson(`/api/v1/teacher-commendations/${id}`, { method: "DELETE" });
      await loadReport();
    } catch {}
  }

  async function addCitation() {
    if (!newCitation.trim() || !teacherId) return;
    setSavingCit(true);
    try {
      await apiJson("/api/v1/teacher-citations", {
        method: "POST",
        body: JSON.stringify({ centerId, teacherId, text: newCitation.trim() }),
      });
      setNewCitation("");
      await loadReport();
    } catch {}
    setSavingCit(false);
  }

  async function deleteCitation(id) {
    try {
      await apiJson(`/api/v1/teacher-citations/${id}`, { method: "DELETE" });
      await loadReport();
    } catch {}
  }

  const milestoneChartData = (report?.milestones?.byCategory || []).map((c) => ({
    category: c.category,
    "% Passed": c["% Passed"] || 0,
  }));

  return (
    <div className="space-y-4">
      {/* Header + Selectors */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-sm font-extrabold text-gray-900">Teacher Performance Report</div>
            <p className="mt-0.5 text-xs text-gray-600">Select a teacher and date range — all metrics filter by the same period.</p>
          </div>
          <button onClick={() => window.print()} className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-extrabold text-gray-800 hover:bg-gray-50">Print</button>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-4">
          <FilterSelect label="Select Teacher" value={teacherId} onChange={setTeacherId} disabled={loadingTeachers}>
            <option value="">Choose a teacher…</option>
            {teacherList.map((t) => <option key={t.id} value={t.id}>{t.name || t.email}</option>)}
          </FilterSelect>
          <FilterInput label="Start Date" type="date" value={dateFrom} onChange={setDateFrom} />
          <FilterInput label="End Date" type="date" value={dateTo} onChange={setDateTo} />
        </div>
      </div>

      {/* Grade Formula Config */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-extrabold text-gray-900">Overall Grade Formula</div>
            <p className="mt-0.5 text-xs text-gray-600">
              {gradeConfig
                ? `${gradeConfig.citizenshipWeight}% citizenship · ${gradeConfig.evaluationWeight}% evaluation · ${gradeConfig.checklistWeight}% checklist · −${gradeConfig.lateDeductionPct}pt/late · −${gradeConfig.absenceDeductionPct}pt/absence`
                : "Loading…"}
            </p>
          </div>
          <button
            onClick={() => { setEditingConfig(!editingConfig); setConfigDraft(gradeConfig || {}); }}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
          >
            {editingConfig ? "Cancel" : "Edit Formula"}
          </button>
        </div>
        {editingConfig && (
          <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-5 border-t border-gray-100 pt-4">
            {[
              { key: "citizenshipWeight", label: "Citizenship %" },
              { key: "evaluationWeight", label: "Evaluation %" },
              { key: "checklistWeight", label: "Checklist %" },
              { key: "lateDeductionPct", label: "Late deduction (pts)" },
              { key: "absenceDeductionPct", label: "Absence deduction (pts)" },
            ].map(({ key, label }) => (
              <label key={key} className="block">
                <div className="mb-1 text-xs font-semibold text-gray-500">{label}</div>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.5"
                  value={configDraft[key] ?? ""}
                  onChange={(e) => setConfigDraft((d) => ({ ...d, [key]: Number(e.target.value) }))}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                />
              </label>
            ))}
            <div className="flex items-end col-span-2 md:col-span-5">
              <button
                onClick={saveConfig}
                disabled={savingConfig}
                className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-60"
              >
                {savingConfig ? "Saving…" : "Save Formula"}
              </button>
            </div>
          </div>
        )}
      </div>

      {!teacherId && <Empty msg="Select a teacher to view their performance report." />}
      {teacherId && loading && <Loading />}

      {report && !loading && (
        <div className="space-y-4">
          {/* Overall Grade */}
          <div className={`rounded-2xl border p-6 ${gradeBg(report.overallGrade)}`}>
            <div className="flex flex-wrap items-center gap-6">
              <div className="text-center">
                <div className={`text-6xl font-extrabold ${gradeColor(report.overallGrade)}`}>
                  {gradeLetter(report.overallGrade)}
                </div>
                <div className="mt-1 text-xs font-semibold uppercase tracking-wide opacity-70">Overall Grade</div>
              </div>
              <div className="flex-1">
                <div className={`text-3xl font-extrabold ${gradeColor(report.overallGrade)}`}>
                  {report.overallGrade != null ? `${report.overallGrade}%` : "Insufficient Data"}
                </div>
                <div className="mt-1 text-sm font-semibold text-gray-700">{report.teacher?.name || "—"}</div>
                <div className="text-xs text-gray-500">
                  {report.teacher?.classes?.length > 0 ? `Classes: ${report.teacher.classes.join(", ")}` : "No classes assigned"}
                  {report.teacher?.hireDate && ` · Hire date: ${new Date(report.teacher.hireDate).toLocaleDateString()}`}
                </div>
                <div className="mt-2 text-xs text-gray-500">
                  Period: {new Date(report.dateRange.from).toLocaleDateString()} – {new Date(report.dateRange.to).toLocaleDateString()}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3 text-center text-xs">
                {[
                  { label: "Citizenship", val: report.citizenship?.normalized != null ? `${report.citizenship.normalized}%` : "—" },
                  { label: "Evaluation", val: report.evaluation?.normalized != null ? `${report.evaluation.normalized}%` : "—" },
                  { label: "Checklist", val: report.checklist?.pct != null ? `${report.checklist.pct}%` : "—" },
                ].map((s) => (
                  <div key={s.label} className="rounded-lg border border-white/60 bg-white/50 px-3 py-2">
                    <div className="text-lg font-extrabold text-gray-800">{s.val}</div>
                    <div className="font-semibold text-gray-600">{s.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Citizenship Grade + Milestones Grade */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-gray-200 bg-white p-5">
              <div className="text-sm font-extrabold text-gray-900">Class Citizenship Grade</div>
              <p className="mt-0.5 text-xs text-gray-500">Average citizenship score of the class over time.</p>
              <div className="mt-1 text-xs text-gray-600">
                Class avg: <span className="font-bold text-gray-900">{report.citizenship?.avg != null ? report.citizenship.avg : "—"}</span>
              </div>
              <div className="mt-3">
                <TrendLineChart
                  data={report.citizenship?.trend || []}
                  lines={[{ key: "score", label: "Class Avg Score", color: "#0284c7" }]}
                  yLabel="Score"
                />
              </div>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-5">
              <div className="text-sm font-extrabold text-gray-900">Milestones Grade</div>
              <p className="mt-0.5 text-xs text-gray-500">Average class steps of progression completed — % passed by category.</p>
              <div className="mt-1 text-xs text-gray-600">
                Avg: <span className="font-bold text-gray-900">{report.milestones?.avgPct != null ? `${report.milestones.avgPct}%` : "—"}</span>
              </div>
              <div className="mt-3">
                {milestoneChartData.length > 0
                  ? <MilestonesBarChart data={milestoneChartData} />
                  : <div className="flex h-48 items-center justify-center text-sm text-gray-500">No milestone data.</div>}
              </div>
            </div>
          </div>

          {/* Evaluation Grade + Checklist Grade */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-gray-200 bg-white p-5">
              <div className="text-sm font-extrabold text-gray-900">Evaluation Grade</div>
              <p className="mt-0.5 text-xs text-gray-500">Evaluation scores filled out by admin — score over time.</p>
              <div className="mt-1 text-xs text-gray-600">
                Most recent: <span className="font-bold text-gray-900">{report.evaluation?.mostRecentScore != null ? `${report.evaluation.mostRecentScore}/10` : "—"}</span>
              </div>
              <div className="mt-3">
                <TrendLineChart
                  data={report.evaluation?.trend || []}
                  lines={[{ key: "score", label: "Evaluation Score", color: "#7c3aed" }]}
                  yDomain={[0, 10]}
                  yLabel="Score"
                />
              </div>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-5">
              <div className="text-sm font-extrabold text-gray-900">Checklist Grade</div>
              <p className="mt-0.5 text-xs text-gray-500">Percentage of assigned daily checklist items completed in this period.</p>
              <div className="mt-4 flex items-center gap-4">
                <div className={`flex h-24 w-24 items-center justify-center rounded-full border-4 font-extrabold text-2xl ${report.checklist?.pct != null ? gradeBg(report.checklist.pct) : "border-gray-200 text-gray-400"}`}>
                  {report.checklist?.pct != null ? `${report.checklist.pct}%` : "—"}
                </div>
                <div className="text-sm text-gray-600">
                  <div>{report.checklist?.completedCount ?? 0} items completed</div>
                  <div className="text-xs text-gray-400">out of ~{report.checklist?.assignedCount ?? 0} assigned items × days in range</div>
                </div>
              </div>
            </div>
          </div>

          {/* Commendations + Citations */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-gray-200 bg-white p-5">
              <div className="text-sm font-extrabold text-gray-900">Commendations</div>
              <div className="mt-3 flex gap-2">
                <input
                  type="text"
                  value={newCommendation}
                  onChange={(e) => setNewCommendation(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addCommendation()}
                  placeholder="Add commendation…"
                  className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm"
                />
                <button
                  onClick={addCommendation}
                  disabled={savingComm || !newCommendation.trim()}
                  className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  {savingComm ? "…" : "Add"}
                </button>
              </div>
              {(report.commendations?.length ?? 0) === 0
                ? <div className="mt-3 text-sm text-gray-400 italic">None</div>
                : (
                  <div className="mt-3 space-y-2">
                    {report.commendations.map((c) => (
                      <div key={c.id} className="flex items-start gap-2 rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2">
                        <div className="flex-1">
                          <div className="text-sm text-emerald-900">{c.text}</div>
                          <div className="text-xs text-emerald-600">{new Date(c.date).toLocaleDateString()}{c.createdBy?.name && ` · ${c.createdBy.name}`}</div>
                        </div>
                        <button onClick={() => deleteCommendation(c.id)} className="text-xs text-emerald-400 hover:text-red-500">✕</button>
                      </div>
                    ))}
                  </div>
                )}
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-5">
              <div className="text-sm font-extrabold text-gray-900">Citations</div>
              <div className="mt-3 flex gap-2">
                <input
                  type="text"
                  value={newCitation}
                  onChange={(e) => setNewCitation(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addCitation()}
                  placeholder="Add citation…"
                  className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm"
                />
                <button
                  onClick={addCitation}
                  disabled={savingCit || !newCitation.trim()}
                  className="rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                >
                  {savingCit ? "…" : "Add"}
                </button>
              </div>
              {(report.citations?.length ?? 0) === 0
                ? <div className="mt-3 text-sm text-gray-400 italic">None</div>
                : (
                  <div className="mt-3 space-y-2">
                    {report.citations.map((c) => (
                      <div key={c.id} className="flex items-start gap-2 rounded-lg border border-red-100 bg-red-50 px-3 py-2">
                        <div className="flex-1">
                          <div className="text-sm text-red-900">{c.text}</div>
                          <div className="text-xs text-red-500">{new Date(c.date).toLocaleDateString()}{c.createdBy?.name && ` · ${c.createdBy.name}`}</div>
                        </div>
                        <button onClick={() => deleteCitation(c.id)} className="text-xs text-red-400 hover:text-red-600">✕</button>
                      </div>
                    ))}
                  </div>
                )}
            </div>
          </div>

          {/* HR Section */}
          <div className="rounded-2xl border border-gray-200 bg-white p-5">
            <div className="text-sm font-extrabold text-gray-900">HR</div>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-5">
              {[
                { label: "Hours Worked", value: report.hr?.hoursWorked ?? "—", color: "bg-sky-50 text-sky-800 border-sky-200" },
                { label: "Lates", value: report.hr?.lates ?? "—", color: "bg-amber-50 text-amber-800 border-amber-200" },
                { label: "Absences", value: report.hr?.absences ?? "—", color: "bg-red-50 text-red-800 border-red-200" },
                { label: "PTO Available (hrs)", value: report.hr?.ptoAvailable ?? "—", color: "bg-emerald-50 text-emerald-800 border-emerald-200" },
                { label: "UTO Available (hrs)", value: report.hr?.utoAvailable ?? "—", color: "bg-gray-50 text-gray-800 border-gray-200" },
              ].map((s) => (
                <div key={s.label} className={`rounded-xl border p-4 ${s.color}`}>
                  <div className="text-2xl font-extrabold">{String(s.value)}</div>
                  <div className="mt-0.5 text-xs font-semibold uppercase tracking-wide opacity-70">{s.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Training Hours + Training Pathway */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-gray-200 bg-white p-5">
              <div className="text-sm font-extrabold text-gray-900">Training Hours</div>
              <p className="mt-0.5 text-xs text-gray-500">From training hours recorded in this period.</p>
              <div className="mt-3 text-3xl font-extrabold text-sky-700">{report.training?.totalHours ?? 0} hrs</div>
              {(report.training?.logs?.length ?? 0) > 0 && (
                <div className="mt-3 space-y-1.5">
                  {report.training.logs.map((l) => (
                    <div key={l.id} className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-xs">
                      <span className="font-semibold text-gray-800">{l.topic}</span>
                      <span className="text-gray-500">{l.hours} hrs · {new Date(l.date).toLocaleDateString()}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-5">
              <div className="text-sm font-extrabold text-gray-900">Training Pathway</div>
              <p className="mt-0.5 text-xs text-gray-500">From the Staff Advancement page.</p>
              {(report.trainingPathways?.length ?? 0) === 0
                ? <div className="mt-3 text-sm text-gray-400 italic">No training pathways configured.</div>
                : (
                  <div className="mt-3 space-y-2">
                    {report.trainingPathways.map((p) => (
                      <div key={p.id} className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-semibold text-gray-900">{p.title}</span>
                          {p.category && <span className="rounded-full bg-sky-100 px-2 py-0.5 text-xs text-sky-700">{p.category}</span>}
                        </div>
                        <div className="text-xs text-gray-500">{p.steps?.length ?? 0} steps</div>
                      </div>
                    ))}
                  </div>
                )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Class Performance Tab ────────────────────────────────────

const BEHAVIOR_TYPE_LABELS = {
  OTHER: "Other",
  HITTING: "Hitting",
  BITING: "Biting",
  KICKING: "Kicking",
  SCRATCHING: "Scratching",
  PUSHING: "Pushing",
  THROWING: "Throwing",
  TANTRUM: "Tantrum",
  NOT_FOLLOWING_DIRECTIONS: "Not Following Directions",
  RESPECT: "Respect",
  SHARING: "Sharing",
  HELPING: "Helping",
  EMPATHY: "Empathy",
  COMMUNICATION: "Communication",
};

function behaviorTypeLabel(type) {
  if (!type) return "—";
  return BEHAVIOR_TYPE_LABELS[type] || type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

const CLASS_ACTIVITY_ICONS = {
  NAP: "💤", BOTTLE: "🍼", MEAL: "🍽️", SNACK: "🥨",
  DIAPER_CHANGE: "🧷", ACTIVITY: "🎨", CITIZENSHIP: "⭐",
  ACCOMPLISHMENT: "🏆", INCIDENT: "⚠️", BEHAVIOR: "📋",
  TASK_CHECKLIST: "✅", TOILETING: "🚽", CHARACTER_HIGHLIGHT: "🌟", OTHER: "📝",
};

function ClassPerformanceTab({ centerId, classes, dateFrom, dateTo }) {
  const [classId, setClassId] = useState("");
  const [reportFrom, setReportFrom] = useState(dateFrom);
  const [reportTo, setReportTo] = useState(dateTo);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [expandedIPP, setExpandedIPP] = useState(null);
  const [expandedLog, setExpandedLog] = useState(null);

  useEffect(() => { setReportFrom(dateFrom); }, [dateFrom]);
  useEffect(() => { setReportTo(dateTo); }, [dateTo]);

  const loadReport = useCallback(async () => {
    if (!classId || !centerId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ classId, centerId, from: reportFrom, to: reportTo });
      const r = await apiJson(`/api/v1/analytics/class-report?${params}`);
      setReport(r);
    } catch {}
    setLoading(false);
  }, [classId, centerId, reportFrom, reportTo]);

  useEffect(() => { loadReport(); }, [loadReport]);

  const milestoneChartData = (report?.milestonesGrade || []).map((c) => ({
    category: c.category,
    "% Passed": c["% Passed"] || 0,
  }));

  return (
    <div className="space-y-4">
      {/* Selector */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-sm font-extrabold text-gray-900">Class Performance Report</div>
            <p className="mt-0.5 text-xs text-gray-600">Select a classroom — all metrics filter by the same date range.</p>
          </div>
          <button onClick={() => window.print()} className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-extrabold text-gray-800 hover:bg-gray-50">Print</button>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-4">
          <FilterSelect label="Select Classroom" value={classId} onChange={setClassId} disabled={!centerId}>
            <option value="">Choose a classroom…</option>
            {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </FilterSelect>
          <FilterInput label="Start Date" type="date" value={reportFrom} onChange={setReportFrom} />
          <FilterInput label="End Date" type="date" value={reportTo} onChange={setReportTo} />
        </div>
      </div>

      {!classId && <Empty msg="Select a classroom to view the class performance report." />}
      {classId && loading && <Loading />}

      {report && !loading && (
        <div className="space-y-4">

          {/* Class Citizenship Grade + Milestones Grade */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-gray-200 bg-white p-5">
              <div className="text-sm font-extrabold text-gray-900">Class Citizenship Grade</div>
              <p className="mt-0.5 text-xs text-gray-500">Average citizenship score of the class over time.</p>
              {report.citizenshipAvg != null && (
                <div className="mt-1 text-xs text-gray-600">Class avg: <span className="font-bold text-gray-900">{report.citizenshipAvg} / 4</span></div>
              )}
              <div className="mt-3">
                <TrendLineChart
                  data={report.citizenshipTrend || []}
                  lines={[{ key: "score", label: "Class Avg Score", color: "#0284c7" }]}
                  yLabel="Score"
                />
              </div>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-5">
              <div className="text-sm font-extrabold text-gray-900">Milestones Grade</div>
              <p className="mt-0.5 text-xs text-gray-500">Average class steps of progression completed — % passed by category.</p>
              {report.milestonesAvgPct != null && (
                <div className="mt-1 text-xs text-gray-600">Class avg: <span className="font-bold text-gray-900">{report.milestonesAvgPct}%</span></div>
              )}
              <div className="mt-3">
                {milestoneChartData.length > 0
                  ? <MilestonesBarChart data={milestoneChartData} />
                  : <div className="flex h-48 items-center justify-center text-sm text-gray-500">No milestone data.</div>}
              </div>
            </div>
          </div>

          {/* Course Correction Logs (level 2 or 3) */}
          <div className="rounded-2xl border border-gray-200 bg-white p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="text-sm font-extrabold text-gray-900">Course Correction Logs</div>
                <p className="mt-0.5 text-xs text-gray-500">Course Correction activity entries at level 2 or level 3.</p>
              </div>
            </div>
            {(report.citizenshipLogs?.length ?? 0) === 0 ? (
              <div className="mt-3 rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm text-gray-500">No Course Correction logs at level 2 or 3 in this period.</div>
            ) : (
              <div className="mt-3 overflow-auto rounded-xl border border-gray-200">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                    <tr>
                      <th className="px-4 py-2 text-left">Student</th>
                      <th className="px-4 py-2 text-left">Type</th>
                      <th className="px-4 py-2 text-left">Level</th>
                      <th className="px-4 py-2 text-left">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {report.citizenshipLogs.map((log) => (
                      <>
                        <tr
                          key={log.id}
                          className="cursor-pointer hover:bg-gray-50"
                          onClick={() => setExpandedLog(expandedLog === log.id ? null : log.id)}
                        >
                          <td className="px-4 py-2 font-semibold text-sky-700 hover:underline">{log.childName}</td>
                          <td className="px-4 py-2 text-gray-700">{behaviorTypeLabel(log.type)}</td>
                          <td className="px-4 py-2">
                            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${log.level === "3" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>
                              Level {log.level}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-gray-500 text-xs">{new Date(log.createdAt).toLocaleDateString()}</td>
                        </tr>
                        {expandedLog === log.id && log.notes && (
                          <tr key={`${log.id}-detail`}>
                            <td colSpan={4} className="bg-amber-50 px-4 py-2 text-xs text-amber-900">
                              <span className="font-semibold">Note: </span>{log.notes}
                            </td>
                          </tr>
                        )}
                      </>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Red Flags */}
          <div className="rounded-2xl border border-gray-200 bg-white p-5">
            <div className="text-sm font-extrabold text-gray-900">Red Flags</div>
            <p className="mt-0.5 text-xs text-gray-500">Active flags for children in this class.</p>
            {(report.redFlags?.length ?? 0) === 0 ? (
              <div className="mt-3 rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm text-gray-500">None</div>
            ) : (
              <div className="mt-3 overflow-auto rounded-xl border border-gray-200">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                    <tr>
                      <th className="px-4 py-2 text-left">Student</th>
                      <th className="px-4 py-2 text-left">Alert</th>
                      <th className="px-4 py-2 text-left">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {report.redFlags.map((f) => (
                      <tr key={f.id}>
                        <td className="px-4 py-2 font-semibold text-gray-900">{f.childName}</td>
                        <td className="px-4 py-2 text-gray-700">
                          {f.snapshot?.type === "INDIVIDUAL_PROGRESS_PLAN"
                            ? `IPP: ${f.snapshot.planTitle || "Plan"}`
                            : f.flagKey?.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) || "Flag"}
                        </td>
                        <td className="px-4 py-2 text-xs text-gray-500">{new Date(f.createdAt).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Class IPP Plans */}
          <div className="rounded-2xl border border-gray-200 bg-white p-5">
            <div className="text-sm font-extrabold text-gray-900">Class IPP Plans</div>
            <p className="mt-0.5 text-xs text-gray-500">Open Individual Progress Plans for children in this class.</p>
            {(report.ippPlans?.length ?? 0) === 0 ? (
              <div className="mt-3 rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm text-gray-500">None</div>
            ) : (
              <div className="mt-3 overflow-auto rounded-xl border border-gray-200">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                    <tr>
                      <th className="px-4 py-2 text-left">Student</th>
                      <th className="px-4 py-2 text-left">Title</th>
                      <th className="px-4 py-2 text-left">Date</th>
                      <th className="px-4 py-2 text-left"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {report.ippPlans.map((plan) => (
                      <>
                        <tr
                          key={plan.id}
                          className="cursor-pointer hover:bg-gray-50"
                          onClick={() => setExpandedIPP(expandedIPP === plan.id ? null : plan.id)}
                        >
                          <td className="px-4 py-2 font-semibold text-sky-700 hover:underline">{plan.childName}</td>
                          <td className="px-4 py-2 font-semibold text-gray-900">{plan.title}</td>
                          <td className="px-4 py-2 text-xs text-gray-500">{new Date(plan.startDate || plan.createdAt).toLocaleDateString()}</td>
                          <td className="px-4 py-2 text-xs text-sky-600">{expandedIPP === plan.id ? "Hide" : "Details"}</td>
                        </tr>
                        {expandedIPP === plan.id && (
                          <tr key={`${plan.id}-detail`}>
                            <td colSpan={4} className="bg-sky-50 px-4 py-3">
                              <div className="space-y-1.5 text-xs">
                                {plan.description && <div><span className="font-semibold text-gray-700">Description: </span><span className="text-gray-600">{plan.description}</span></div>}
                                {plan.teacherTactics && <div><span className="font-semibold text-gray-700">Teacher Tactics: </span><span className="text-gray-600">{plan.teacherTactics}</span></div>}
                                {(plan.goals || []).length > 0 && (
                                  <div>
                                    <div className="font-semibold text-gray-700 mb-1">Goals:</div>
                                    <div className="space-y-1">
                                      {plan.goals.map((g) => (
                                        <div key={g.id} className="flex items-center gap-2">
                                          <span className={`rounded-full px-2 py-0.5 font-semibold text-xs ${g.status === "MET" ? "bg-emerald-100 text-emerald-700" : g.status === "NOT_MET" ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-600"}`}>{g.status?.replace(/_/g, " ")}</span>
                                          <span className="text-gray-700">{g.title}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                {plan.createdBy?.name && <div className="text-gray-400">Created by {plan.createdBy.name}</div>}
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Class Daily Logs */}
          <div className="rounded-2xl border border-gray-200 bg-white p-5">
            <div className="text-sm font-extrabold text-gray-900">Class Daily Logs</div>
            <p className="mt-0.5 text-xs text-gray-500">Activity logs for all children in this class — similar to Procare.</p>
            {(report.activityLogs?.length ?? 0) === 0 ? (
              <div className="mt-3 rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm text-gray-500">No activity logs in this period.</div>
            ) : (
              <div className="mt-3 space-y-2">
                {report.activityLogs.map((child) => (
                  <div key={child.childId} className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-sky-500 to-blue-600 text-xs font-bold text-white flex-shrink-0">
                        {(child.childName || "?")[0].toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-sm text-gray-900">{child.childName}</div>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {child.logs.slice(0, 12).map((log) => (
                          <span key={log.id} title={`${log.type.replace(/_/g, " ")} — ${new Date(log.createdAt).toLocaleDateString()}`} className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-white text-base cursor-default">
                            {CLASS_ACTIVITY_ICONS[log.type] || "📄"}
                          </span>
                        ))}
                        {child.logs.length > 12 && (
                          <span className="flex h-8 items-center rounded-lg border border-gray-200 bg-white px-2 text-xs text-gray-500">+{child.logs.length - 12}</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      )}
    </div>
  );
}

// ─── Other Staff Performance Tab ──────────────────────────────

function staffGradeColor(g) {
  if (g == null) return "text-gray-400";
  if (g >= 80) return "text-emerald-700";
  if (g >= 60) return "text-amber-700";
  return "text-red-700";
}
function staffGradeBg(g) {
  if (g == null) return "bg-gray-50 border-gray-200 text-gray-500";
  if (g >= 80) return "bg-emerald-50 border-emerald-200 text-emerald-800";
  if (g >= 60) return "bg-amber-50 border-amber-200 text-amber-800";
  return "bg-red-50 border-red-200 text-red-800";
}
function staffGradeLetter(g) {
  if (g == null) return "N/A";
  if (g >= 90) return "A";
  if (g >= 80) return "B";
  if (g >= 70) return "C";
  if (g >= 60) return "D";
  return "F";
}

function OtherStaffPerformanceTab({ centerId, dateFrom, dateTo }) {
  const [staffList, setStaffList] = useState([]);
  const [staffId, setStaffId] = useState("");
  const [reportFrom, setReportFrom] = useState(dateFrom);
  const [reportTo, setReportTo] = useState(dateTo);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingStaff, setLoadingStaff] = useState(true);

  const [gradeConfig, setGradeConfig] = useState(null);
  const [editingConfig, setEditingConfig] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [configDraft, setConfigDraft] = useState({});

  const [newCommendation, setNewCommendation] = useState("");
  const [newCitation, setNewCitation] = useState("");
  const [savingComm, setSavingComm] = useState(false);
  const [savingCit, setSavingCit] = useState(false);

  useEffect(() => { setReportFrom(dateFrom); }, [dateFrom]);
  useEffect(() => { setReportTo(dateTo); }, [dateTo]);

  useEffect(() => {
    if (!centerId) return;
    setLoadingStaff(true);
    apiJson(`/api/v1/users?centerId=${encodeURIComponent(centerId)}&roles=OTHER_STAFF`)
      .then((r) => {
        const arr = Array.isArray(r) ? r : [];
        setStaffList(arr);
        if (arr.length === 1) setStaffId(arr[0].id);
      })
      .catch(() => {})
      .finally(() => setLoadingStaff(false));
  }, [centerId]);

  useEffect(() => {
    if (!centerId) return;
    apiJson(`/api/v1/other-staff-grade-config?centerId=${encodeURIComponent(centerId)}`)
      .then((r) => { setGradeConfig(r); setConfigDraft(r); })
      .catch(() => {});
  }, [centerId]);

  const loadReport = useCallback(async () => {
    if (!centerId || !staffId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ centerId, staffId, from: reportFrom, to: reportTo });
      const r = await apiJson(`/api/v1/analytics/staff-perf-report?${params}`);
      setReport(r);
    } catch {}
    setLoading(false);
  }, [centerId, staffId, reportFrom, reportTo]);

  useEffect(() => { loadReport(); }, [loadReport]);

  async function saveConfig() {
    setSavingConfig(true);
    try {
      const r = await apiJson(`/api/v1/other-staff-grade-config?centerId=${encodeURIComponent(centerId)}`, {
        method: "PUT",
        body: JSON.stringify(configDraft),
      });
      setGradeConfig(r);
      setEditingConfig(false);
      await loadReport();
    } catch {}
    setSavingConfig(false);
  }

  async function addCommendation() {
    if (!newCommendation.trim() || !staffId) return;
    setSavingComm(true);
    try {
      await apiJson("/api/v1/staff-commendations", {
        method: "POST",
        body: JSON.stringify({ centerId, staffId, text: newCommendation.trim() }),
      });
      setNewCommendation("");
      await loadReport();
    } catch {}
    setSavingComm(false);
  }

  async function deleteCommendation(id) {
    try { await apiJson(`/api/v1/staff-commendations/${id}`, { method: "DELETE" }); await loadReport(); } catch {}
  }

  async function addCitation() {
    if (!newCitation.trim() || !staffId) return;
    setSavingCit(true);
    try {
      await apiJson("/api/v1/staff-citations", {
        method: "POST",
        body: JSON.stringify({ centerId, staffId, text: newCitation.trim() }),
      });
      setNewCitation("");
      await loadReport();
    } catch {}
    setSavingCit(false);
  }

  async function deleteCitation(id) {
    try { await apiJson(`/api/v1/staff-citations/${id}`, { method: "DELETE" }); await loadReport(); } catch {}
  }

  return (
    <div className="space-y-4">
      {/* Selectors */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-sm font-extrabold text-gray-900">Other Staff Performance Report</div>
            <p className="mt-0.5 text-xs text-gray-600">Select a staff member and date range — all metrics filter by the same period.</p>
          </div>
          <button onClick={() => window.print()} className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-extrabold text-gray-800 hover:bg-gray-50">Print</button>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-4">
          <FilterSelect label="Select Staff" value={staffId} onChange={setStaffId} disabled={loadingStaff}>
            <option value="">Choose a staff member…</option>
            {staffList.map((s) => <option key={s.id} value={s.id}>{s.name || s.email}</option>)}
          </FilterSelect>
          <FilterInput label="Start Date" type="date" value={reportFrom} onChange={setReportFrom} />
          <FilterInput label="End Date" type="date" value={reportTo} onChange={setReportTo} />
        </div>
      </div>

      {/* Grade Formula Config */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-extrabold text-gray-900">Overall Grade Formula</div>
            <p className="mt-0.5 text-xs text-gray-600">
              {gradeConfig
                ? `${gradeConfig.evaluationWeight}% evaluation · ${gradeConfig.checklistWeight}% checklist · −${gradeConfig.lateDeductionPct}pt/late · −${gradeConfig.absenceDeductionPct}pt/absence`
                : "Loading…"}
            </p>
          </div>
          <button
            onClick={() => { setEditingConfig(!editingConfig); setConfigDraft(gradeConfig || {}); }}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
          >
            {editingConfig ? "Cancel" : "Edit Formula"}
          </button>
        </div>
        {editingConfig && (
          <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4 border-t border-gray-100 pt-4">
            {[
              { key: "evaluationWeight", label: "Evaluation %" },
              { key: "checklistWeight", label: "Checklist %" },
              { key: "lateDeductionPct", label: "Late deduction (pts)" },
              { key: "absenceDeductionPct", label: "Absence deduction (pts)" },
            ].map(({ key, label }) => (
              <label key={key} className="block">
                <div className="mb-1 text-xs font-semibold text-gray-500">{label}</div>
                <input
                  type="number" min="0" max="100" step="0.5"
                  value={configDraft[key] ?? ""}
                  onChange={(e) => setConfigDraft((d) => ({ ...d, [key]: Number(e.target.value) }))}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                />
              </label>
            ))}
            <div className="flex items-end col-span-2 md:col-span-4">
              <button onClick={saveConfig} disabled={savingConfig} className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-60">
                {savingConfig ? "Saving…" : "Save Formula"}
              </button>
            </div>
          </div>
        )}
      </div>

      {!staffId && <Empty msg="Select a staff member to view their performance report." />}
      {staffId && loading && <Loading />}

      {report && !loading && (
        <div className="space-y-4">
          {/* Overall Grade */}
          <div className={`rounded-2xl border p-6 ${staffGradeBg(report.overallGrade)}`}>
            <div className="flex flex-wrap items-center gap-6">
              <div className="text-center">
                <div className={`text-6xl font-extrabold ${staffGradeColor(report.overallGrade)}`}>{staffGradeLetter(report.overallGrade)}</div>
                <div className="mt-1 text-xs font-semibold uppercase tracking-wide opacity-70">Overall Grade</div>
              </div>
              <div className="flex-1">
                <div className={`text-3xl font-extrabold ${staffGradeColor(report.overallGrade)}`}>
                  {report.overallGrade != null ? `${report.overallGrade}%` : "Insufficient Data"}
                </div>
                <div className="mt-1 text-sm font-semibold text-gray-700">{report.staff?.name || "—"}</div>
                <div className="mt-1 text-xs text-gray-500">
                  Period: {new Date(report.dateRange.from).toLocaleDateString()} – {new Date(report.dateRange.to).toLocaleDateString()}
                </div>
                <div className="mt-1 text-xs text-gray-500">
                  Formula: {report.gradeConfig.evaluationWeight}% evaluation · {report.gradeConfig.checklistWeight}% checklist
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-center text-xs">
                {[
                  { label: "Evaluation", val: report.evaluation?.normalized != null ? `${report.evaluation.normalized}%` : "—" },
                  { label: "Checklist", val: report.checklist?.pct != null ? `${report.checklist.pct}%` : "—" },
                ].map((s) => (
                  <div key={s.label} className="rounded-lg border border-white/60 bg-white/50 px-3 py-2">
                    <div className="text-lg font-extrabold text-gray-800">{s.val}</div>
                    <div className="font-semibold text-gray-600">{s.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Evaluation Grade + Checklist Grade */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-gray-200 bg-white p-5">
              <div className="text-sm font-extrabold text-gray-900">Evaluation Grade</div>
              <p className="mt-0.5 text-xs text-gray-500">Evaluation scores filled out by admin — score over time.</p>
              {report.evaluation?.mostRecentScore != null && (
                <div className="mt-1 text-xs text-gray-600">Most recent: <span className="font-bold text-gray-900">{report.evaluation.mostRecentScore}/10</span></div>
              )}
              <div className="mt-3">
                <TrendLineChart
                  data={report.evaluation?.trend || []}
                  lines={[{ key: "score", label: "Evaluation Score", color: "#7c3aed" }]}
                  yDomain={[0, 10]}
                  yLabel="Score"
                />
              </div>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-5">
              <div className="text-sm font-extrabold text-gray-900">Checklist Grade</div>
              <p className="mt-0.5 text-xs text-gray-500">Percentage of assigned daily checklist items completed.</p>
              <div className="mt-4 flex items-center gap-4">
                <div className={`flex h-24 w-24 items-center justify-center rounded-full border-4 font-extrabold text-2xl ${report.checklist?.pct != null ? staffGradeBg(report.checklist.pct) : "border-gray-200 text-gray-400"}`}>
                  {report.checklist?.pct != null ? `${report.checklist.pct}%` : "—"}
                </div>
                <div className="text-sm text-gray-600">
                  <div>{report.checklist?.completedCount ?? 0} items completed</div>
                  <div className="text-xs text-gray-400">out of ~{report.checklist?.assignedCount ?? 0} assigned × days</div>
                </div>
              </div>
            </div>
          </div>

          {/* Commendations + Citations */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-gray-200 bg-white p-5">
              <div className="text-sm font-extrabold text-gray-900">Commendations</div>
              <div className="mt-3 flex gap-2">
                <input
                  type="text" value={newCommendation} onChange={(e) => setNewCommendation(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addCommendation()}
                  placeholder="Add commendation…" className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm"
                />
                <button onClick={addCommendation} disabled={savingComm || !newCommendation.trim()}
                  className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
                  {savingComm ? "…" : "Add"}
                </button>
              </div>
              {(report.commendations?.length ?? 0) === 0
                ? <div className="mt-3 text-sm text-gray-400 italic">None</div>
                : (
                  <div className="mt-3 space-y-2">
                    {report.commendations.map((c) => (
                      <div key={c.id} className="flex items-start gap-2 rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2">
                        <div className="flex-1">
                          <div className="text-sm text-emerald-900">{c.text}</div>
                          <div className="text-xs text-emerald-600">{new Date(c.date).toLocaleDateString()}{c.createdBy?.name && ` · ${c.createdBy.name}`}</div>
                        </div>
                        <button onClick={() => deleteCommendation(c.id)} className="text-xs text-emerald-400 hover:text-red-500">✕</button>
                      </div>
                    ))}
                  </div>
                )}
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-5">
              <div className="text-sm font-extrabold text-gray-900">Citations</div>
              <div className="mt-3 flex gap-2">
                <input
                  type="text" value={newCitation} onChange={(e) => setNewCitation(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addCitation()}
                  placeholder="Add citation…" className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm"
                />
                <button onClick={addCitation} disabled={savingCit || !newCitation.trim()}
                  className="rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50">
                  {savingCit ? "…" : "Add"}
                </button>
              </div>
              {(report.citations?.length ?? 0) === 0
                ? <div className="mt-3 text-sm text-gray-400 italic">None</div>
                : (
                  <div className="mt-3 space-y-2">
                    {report.citations.map((c) => (
                      <div key={c.id} className="flex items-start gap-2 rounded-lg border border-red-100 bg-red-50 px-3 py-2">
                        <div className="flex-1">
                          <div className="text-sm text-red-900">{c.text}</div>
                          <div className="text-xs text-red-500">{new Date(c.date).toLocaleDateString()}{c.createdBy?.name && ` · ${c.createdBy.name}`}</div>
                        </div>
                        <button onClick={() => deleteCitation(c.id)} className="text-xs text-red-400 hover:text-red-600">✕</button>
                      </div>
                    ))}
                  </div>
                )}
            </div>
          </div>

          {/* HR */}
          <div className="rounded-2xl border border-gray-200 bg-white p-5">
            <div className="text-sm font-extrabold text-gray-900">HR</div>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-5">
              {[
                { label: "Hours Worked", value: report.hr?.hoursWorked ?? "—", color: "bg-sky-50 text-sky-800 border-sky-200" },
                { label: "Lates", value: report.hr?.lates ?? "—", color: "bg-amber-50 text-amber-800 border-amber-200" },
                { label: "Absences", value: report.hr?.absences ?? "—", color: "bg-red-50 text-red-800 border-red-200" },
                { label: "PTO Available (hrs)", value: report.hr?.ptoAvailable ?? "—", color: "bg-emerald-50 text-emerald-800 border-emerald-200" },
                { label: "UTO Available (hrs)", value: report.hr?.utoAvailable ?? "—", color: "bg-gray-50 text-gray-800 border-gray-200" },
              ].map((s) => (
                <div key={s.label} className={`rounded-xl border p-4 ${s.color}`}>
                  <div className="text-2xl font-extrabold">{String(s.value)}</div>
                  <div className="mt-0.5 text-xs font-semibold uppercase tracking-wide opacity-70">{s.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Training Hours + Training Pathway */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-gray-200 bg-white p-5">
              <div className="text-sm font-extrabold text-gray-900">Training Hours</div>
              <p className="mt-0.5 text-xs text-gray-500">From training hours recorded in this period.</p>
              <div className="mt-3 text-3xl font-extrabold text-sky-700">{report.training?.totalHours ?? 0} hrs</div>
              {(report.training?.logs?.length ?? 0) > 0 && (
                <div className="mt-3 space-y-1.5">
                  {report.training.logs.map((l) => (
                    <div key={l.id} className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-xs">
                      <span className="font-semibold text-gray-800">{l.topic}</span>
                      <span className="text-gray-500">{l.hours} hrs · {new Date(l.date).toLocaleDateString()}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-5">
              <div className="text-sm font-extrabold text-gray-900">Training Pathway</div>
              <p className="mt-0.5 text-xs text-gray-500">From the Staff Advancement page.</p>
              {(report.trainingPathways?.length ?? 0) === 0
                ? <div className="mt-3 text-sm text-gray-400 italic">No training pathways configured.</div>
                : (
                  <div className="mt-3 space-y-2">
                    {report.trainingPathways.map((p) => (
                      <div key={p.id} className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-semibold text-gray-900">{p.title}</span>
                          {p.category && <span className="rounded-full bg-sky-100 px-2 py-0.5 text-xs text-sky-700">{p.category}</span>}
                        </div>
                        <div className="text-xs text-gray-500">{p.steps?.length ?? 0} steps</div>
                      </div>
                    ))}
                  </div>
                )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Query Tab ────────────────────────────────────────────────

function QueryTab({ centerId, children, classes }) {
  const [queryType, setQueryType] = useState("progress");
  const [groupBy, setGroupBy] = useState("child");
  const [status, setStatus] = useState("");
  const [domain, setDomain] = useState("");
  const [childId, setChildId] = useState("");
  const [classId, setClassId] = useState("");
  const [from, setFrom] = useState(defaultDateFrom());
  const [to, setTo] = useState(defaultDateTo());
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [chartType, setChartType] = useState("bar");

  async function runQuery() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ centerId, type: queryType, groupBy });
      if (childId) params.set("childId", childId);
      if (classId) params.set("classId", classId);
      if (status) params.set("status", status);
      if (domain) params.set("domain", domain);
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      const r = await apiJson(`/api/v1/analytics/query?${params}`);
      setResults(r);
    } catch {}
    setLoading(false);
  }

  const chartData = useMemo(() => {
    if (!results?.results) return [];
    return results.results.map((r) => ({
      name: r.label || r.groupKey || "",
      value: r.avgScore ?? r.count ?? 0,
    }));
  }, [results]);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-gray-200 bg-white p-5">
        <div className="text-sm font-extrabold text-gray-900">Custom Query Builder</div>
        <p className="mt-0.5 text-xs text-gray-600">Filter and group data by any dimension.</p>

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
          <FilterSelect label="Data Type" value={queryType} onChange={setQueryType}>
            <option value="progress">Progress</option>
            <option value="behavior">Behavior</option>
            <option value="attendance">Attendance</option>
            <option value="activity">Activity</option>
          </FilterSelect>
          <FilterSelect label="Group By" value={groupBy} onChange={setGroupBy}>
            <option value="child">Child</option>
            <option value="class">Class</option>
            <option value="ageGroup">Age Group</option>
            <option value="domain">Domain</option>
            <option value="week">Week</option>
            <option value="month">Month</option>
          </FilterSelect>
          <FilterSelect label="Child" value={childId} onChange={setChildId}>
            <option value="">All children</option>
            {children.map((c) => <option key={c.id} value={c.id}>{fullName(c)}</option>)}
          </FilterSelect>
          <FilterSelect label="Class" value={classId} onChange={setClassId}>
            <option value="">All classes</option>
            {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </FilterSelect>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
          {queryType === "progress" && (
            <FilterSelect label="Status" value={status} onChange={setStatus}>
              <option value="">All</option>
              <option value="NOT_STARTED">Not Started</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="COMPLETED">Completed</option>
              <option value="PASSED">Passed</option>
              <option value="FAILED">Failed</option>
            </FilterSelect>
          )}
          {queryType === "behavior" && (
            <FilterSelect label="Domain" value={domain} onChange={setDomain}>
              <option value="">All domains</option>
              {Object.entries(DOMAIN_META).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </FilterSelect>
          )}
          <FilterInput label="From" type="date" value={from} onChange={setFrom} />
          <FilterInput label="To" type="date" value={to} onChange={setTo} />
          <div className="flex items-end">
            <button
              onClick={runQuery}
              disabled={loading}
              className="w-full rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-60"
            >
              {loading ? "Querying…" : "Run Query"}
            </button>
          </div>
        </div>
      </div>

      {results && (
        <>
          {/* Chart type toggle */}
          <div className="flex gap-2">
            {["bar", "line", "pie"].map((ct) => (
              <button
                key={ct}
                onClick={() => setChartType(ct)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${chartType === ct ? "bg-sky-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}
              >
                {ct.charAt(0).toUpperCase() + ct.slice(1)} Chart
              </button>
            ))}
          </div>

          {/* Chart */}
          <ChartCard title={`Results — ${results.total || 0} groups`}>
            {chartType === "pie" ? (
              <ProgressPieChart
                data={Object.fromEntries(chartData.map((d) => [d.name, d.value]))}
              />
            ) : chartType === "line" ? (
              <TrendLineChart
                data={chartData.map((d) => ({ label: d.name, value: d.value }))}
                lines={[{ key: "value", label: queryType === "behavior" ? "Avg Score" : "Count", color: "#7c3aed" }]}
              />
            ) : (
              <GenericBarChart data={chartData} />
            )}
          </ChartCard>

          {/* Results table */}
          <div className="rounded-2xl border border-gray-200 bg-white overflow-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-2 text-left">Group</th>
                  <th className="px-4 py-2 text-left">Count</th>
                  {queryType === "behavior" && <th className="px-4 py-2 text-left">Avg Score</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {(results.results || []).map((r, i) => (
                  <tr key={i}>
                    <td className="px-4 py-2 font-semibold text-gray-900">{r.label || r.groupKey}</td>
                    <td className="px-4 py-2 text-gray-700">{r.count}</td>
                    {queryType === "behavior" && (
                      <td className="px-4 py-2 text-gray-700">{r.avgScore ?? "—"}</td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Generic Bar Chart for Query Tab ──────────────────────────

const GenericBarChart = dynamic(
  () => import("recharts").then((mod) => {
    const { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } = mod;
    function GenericBar({ data = [] }) {
      if (!data.length) return <div className="flex h-64 items-center justify-center text-sm text-gray-500">No data.</div>;
      return (
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip contentStyle={{ fontSize: 12 }} />
            <Bar dataKey="value" fill="#7c3aed" radius={[6, 6, 0, 0]} maxBarSize={48} />
          </BarChart>
        </ResponsiveContainer>
      );
    }
    return { default: GenericBar };
  }),
  { ssr: false }
);

// ─── Individual Progress Plan Components ──────────────────────

function BehaviorPlanCard({ plan, onUpdated }) {
  const [expanded, setExpanded] = useState(false);
  const [closing, setClosing] = useState(false);

  async function toggleClose() {
    setClosing(true);
    try {
      await apiJson(`/api/v1/behavior-plans/${plan.id}`, {
        method: "PUT",
        body: JSON.stringify({ close: plan.status !== "CLOSED" }),
      });
      if (onUpdated) onUpdated();
    } catch {}
    setClosing(false);
  }

  const isClosed = plan.status === "CLOSED";

  return (
    <div className={`rounded-xl border p-4 ${isClosed ? "border-gray-200 bg-gray-50" : "border-sky-100 bg-sky-50"}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-sm font-extrabold text-gray-900">{plan.title}</div>
            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_BADGE[plan.status] || "bg-gray-100 text-gray-700"}`}>
              {plan.status === "CLOSED" ? "Closed" : plan.status}
            </span>
            {plan.parentApproved && (
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                Parent Approved
              </span>
            )}
          </div>
          <div className="mt-1 text-xs text-gray-500">
            Plan Start: {fmtDate(plan.startDate)}
            {plan.closedAt && ` • Closed: ${fmtDate(plan.closedAt)}`}
            {plan.closedBy?.name && ` by ${plan.closedBy.name}`}
            {plan.createdBy?.name && ` • Created by: ${plan.createdBy.name}`}
          </div>
          {plan.parentApproved && plan.parentSignatureName && (
            <div className="mt-0.5 text-xs text-emerald-700">
              Approved by: {plan.parentSignatureName} on {fmtDate(plan.parentApprovedAt)}
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={toggleClose}
            disabled={closing}
            className={`rounded-lg px-3 py-1 text-xs font-semibold transition ${isClosed ? "bg-sky-100 text-sky-700 hover:bg-sky-200" : "bg-gray-200 text-gray-700 hover:bg-gray-300"}`}
          >
            {closing ? "…" : isClosed ? "Reopen" : "Close Plan"}
          </button>
          <button onClick={() => setExpanded(!expanded)} className="text-xs font-semibold text-sky-600 hover:text-sky-800">
            {expanded ? "Collapse" : "View Details"}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="mt-3 space-y-3 border-t border-gray-200 pt-3">
          {plan.description && (
            <div>
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Description</div>
              <p className="mt-1 text-sm text-gray-700">{plan.description}</p>
            </div>
          )}
          {plan.teacherTactics && (
            <div>
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Teacher Tactics</div>
              <p className="mt-1 text-sm text-gray-700">{plan.teacherTactics}</p>
            </div>
          )}
          {plan.parentTactics && (
            <div>
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Parent Tactics</div>
              <p className="mt-1 text-sm text-gray-700">{plan.parentTactics}</p>
            </div>
          )}
          {plan.coachTactics && (
            <div>
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Coach Tactics</div>
              <p className="mt-1 text-sm text-gray-700">{plan.coachTactics}</p>
            </div>
          )}
          {plan.disciplinaryAction && (
            <div>
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Disciplinary Action</div>
              <p className="mt-1 text-sm text-gray-700">{plan.disciplinaryAction}</p>
            </div>
          )}
          {plan.notes && (
            <div>
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Notes</div>
              <p className="mt-1 text-sm text-gray-700">{plan.notes}</p>
            </div>
          )}
          {(plan.goals || []).length > 0 && (
            <div>
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Goals</div>
              <div className="space-y-2">
                {plan.goals.map((goal) => (
                  <div key={goal.id} className="rounded-lg border border-gray-200 bg-white p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-xs font-semibold text-gray-900">{goal.title}</div>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_BADGE[goal.status] || "bg-gray-100 text-gray-700"}`}>
                        {GOAL_STATUS_LABEL[goal.status] || goal.status}
                      </span>
                    </div>
                    {goal.strategies?.length > 0 && (
                      <ul className="mt-1 ml-3 list-disc text-xs text-gray-600">
                        {goal.strategies.map((s, i) => <li key={i}>{s}</li>)}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function BehaviorPlanForm({ childId, centerId, onCreated }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [teacherTactics, setTeacherTactics] = useState("");
  const [parentTactics, setParentTactics] = useState("");
  const [coachTactics, setCoachTactics] = useState("");
  const [disciplinaryAction, setDisciplinaryAction] = useState("");
  const [startDate, setStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    try {
      await apiJson("/api/v1/behavior-plans", {
        method: "POST",
        body: JSON.stringify({
          childId,
          centerId,
          title: title.trim(),
          description: description.trim() || null,
          teacherTactics: teacherTactics.trim() || null,
          parentTactics: parentTactics.trim() || null,
          coachTactics: coachTactics.trim() || null,
          disciplinaryAction: disciplinaryAction.trim() || null,
          startDate: startDate || null,
        }),
      });
      onCreated();
    } catch {}
    setSaving(false);
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 space-y-3 rounded-xl border border-sky-200 bg-sky-50 p-4">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="md:col-span-2">
          <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600">Plan Title *</label>
          <input
            className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            placeholder="e.g., Individual Progress Plan — Social Skills"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600">Plan Start Date</label>
          <input
            type="date"
            className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>
        <div className="md:col-span-2">
          <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600">Description</label>
          <textarea
            className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            rows={2}
            placeholder="Optional description of this plan…"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600">Teacher Tactics</label>
          <textarea
            className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            rows={2}
            placeholder="Strategies for the teacher to implement…"
            value={teacherTactics}
            onChange={(e) => setTeacherTactics(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600">Parent Tactics</label>
          <textarea
            className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            rows={2}
            placeholder="Strategies for the parent to implement…"
            value={parentTactics}
            onChange={(e) => setParentTactics(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600">Coach Tactics</label>
          <textarea
            className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            rows={2}
            placeholder="Strategies for the coach to implement…"
            value={coachTactics}
            onChange={(e) => setCoachTactics(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600">Disciplinary Action <span className="text-gray-400 font-normal">(optional)</span></label>
          <textarea
            className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            rows={2}
            placeholder="Optional disciplinary action details…"
            value={disciplinaryAction}
            onChange={(e) => setDisciplinaryAction(e.target.value)}
          />
        </div>
      </div>
      <div className="flex items-center gap-2 pt-1">
        <button
          type="submit"
          disabled={saving || !title.trim()}
          className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-60"
        >
          {saving ? "Creating…" : "Create Plan"}
        </button>
        <p className="text-xs text-gray-500">Parent will be notified to review and approve this plan.</p>
      </div>
    </form>
  );
}

// ─── Shared UI Components ─────────────────────────────────────

function KpiCard({ label, value, color = "gray" }) {
  const colorMap = {
    sky: "border-sky-200 bg-sky-50 text-sky-800",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-800",
    violet: "border-blue-200 bg-blue-50 text-blue-900",
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

function ChartCard({ title, children }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5">
      <div className="text-sm font-extrabold text-gray-900">{title}</div>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function FilterSelect({ label, value, onChange, disabled, children }) {
  return (
    <label className="block">
      <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
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
      <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</div>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
      />
    </label>
  );
}

function Loading() {
  return <div className="rounded-2xl border border-gray-200 bg-white p-8 dark:border-gray-700 dark:bg-gray-800"><SkeletonTable rows={5} cols={4} /></div>;
}

function Empty({ msg }) {
  return <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-600">{msg}</div>;
}

// ─── Coach Performance Tab ────────────────────────────────────

function coachGradeColor(g) {
  if (g == null) return "text-gray-400";
  if (g >= 80) return "text-emerald-700";
  if (g >= 60) return "text-amber-700";
  return "text-red-700";
}
function coachGradeBg(g) {
  if (g == null) return "bg-gray-50 border-gray-200 text-gray-500";
  if (g >= 80) return "bg-emerald-50 border-emerald-200 text-emerald-800";
  if (g >= 60) return "bg-amber-50 border-amber-200 text-amber-800";
  return "bg-red-50 border-red-200 text-red-800";
}
function coachGradeLetter(g) {
  if (g == null) return "N/A";
  if (g >= 90) return "A";
  if (g >= 80) return "B";
  if (g >= 70) return "C";
  if (g >= 60) return "D";
  return "F";
}

function CoachPerformanceTab({ centerId, dateFrom, dateTo }) {
  const [coaches, setCoaches] = useState([]);
  const [coachId, setCoachId] = useState("");
  const [reportFrom, setReportFrom] = useState(dateFrom);
  const [reportTo, setReportTo] = useState(dateTo);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingCoaches, setLoadingCoaches] = useState(true);

  // Grade config editor
  const [gradeConfig, setGradeConfig] = useState(null);
  const [editingConfig, setEditingConfig] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [configDraft, setConfigDraft] = useState({});

  useEffect(() => { setReportFrom(dateFrom); }, [dateFrom]);
  useEffect(() => { setReportTo(dateTo); }, [dateTo]);

  useEffect(() => {
    if (!centerId) return;
    setLoadingCoaches(true);
    apiJson(`/api/v1/users?centerId=${encodeURIComponent(centerId)}&roles=COACH`)
      .then((r) => {
        const arr = Array.isArray(r) ? r : [];
        setCoaches(arr);
        if (arr.length === 1) setCoachId(arr[0].id);
      })
      .catch(() => {})
      .finally(() => setLoadingCoaches(false));
  }, [centerId]);

  useEffect(() => {
    if (!centerId) return;
    apiJson(`/api/v1/coach-performance-grade-config?centerId=${encodeURIComponent(centerId)}`)
      .then((r) => { setGradeConfig(r); setConfigDraft(r); })
      .catch(() => {});
  }, [centerId]);

  const loadReport = useCallback(async () => {
    if (!centerId || !coachId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ centerId, coachId, from: reportFrom, to: reportTo });
      const r = await apiJson(`/api/v1/analytics/coach-perf-report?${params}`);
      setReport(r);
    } catch {}
    setLoading(false);
  }, [centerId, coachId, reportFrom, reportTo]);

  useEffect(() => { loadReport(); }, [loadReport]);

  async function saveConfig() {
    setSavingConfig(true);
    try {
      const r = await apiJson(`/api/v1/coach-performance-grade-config?centerId=${encodeURIComponent(centerId)}`, {
        method: "PUT",
        body: JSON.stringify(configDraft),
      });
      setGradeConfig(r);
      setEditingConfig(false);
      await loadReport();
    } catch {}
    setSavingConfig(false);
  }

  return (
    <div className="space-y-4">
      {/* Header + Selectors */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-sm font-extrabold text-gray-900">Coach Performance Report</div>
            <p className="mt-0.5 text-xs text-gray-600">Select a coach and date range — all metrics filter by the same period.</p>
          </div>
          <button onClick={() => window.print()} className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-extrabold text-gray-800 hover:bg-gray-50">Print</button>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-4">
          <FilterSelect label="Select Coach" value={coachId} onChange={setCoachId} disabled={loadingCoaches}>
            <option value="">Choose a coach…</option>
            {coaches.map((c) => <option key={c.id} value={c.id}>{c.name || c.email}</option>)}
          </FilterSelect>
          <FilterInput label="Start Date" type="date" value={reportFrom} onChange={setReportFrom} />
          <FilterInput label="End Date" type="date" value={reportTo} onChange={setReportTo} />
        </div>
      </div>

      {/* Grade Formula Config */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-extrabold text-gray-900">Overall Grade Formula</div>
            <p className="mt-0.5 text-xs text-gray-600">
              {gradeConfig
                ? `${gradeConfig.teamPerformanceWeight}% team performance · ${gradeConfig.evaluationWeight}% evaluation · −${gradeConfig.lateDeductionPct}pt/late · −${gradeConfig.absenceDeductionPct}pt/absence`
                : "Loading…"}
            </p>
          </div>
          <button
            onClick={() => { setEditingConfig(!editingConfig); setConfigDraft(gradeConfig || {}); }}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
          >
            {editingConfig ? "Cancel" : "Edit Formula"}
          </button>
        </div>
        {editingConfig && (
          <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4 border-t border-gray-100 pt-4">
            {[
              { key: "teamPerformanceWeight", label: "Team Performance %" },
              { key: "evaluationWeight", label: "Evaluation %" },
              { key: "lateDeductionPct", label: "Late deduction (pts)" },
              { key: "absenceDeductionPct", label: "Absence deduction (pts)" },
            ].map(({ key, label }) => (
              <label key={key} className="block">
                <div className="mb-1 text-xs font-semibold text-gray-500">{label}</div>
                <input
                  type="number" min="0" max="100" step="0.5"
                  value={configDraft[key] ?? ""}
                  onChange={(e) => setConfigDraft((d) => ({ ...d, [key]: Number(e.target.value) }))}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                />
              </label>
            ))}
            <div className="flex items-end col-span-2 md:col-span-4">
              <button
                onClick={saveConfig} disabled={savingConfig}
                className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-60"
              >
                {savingConfig ? "Saving…" : "Save Formula"}
              </button>
            </div>
          </div>
        )}
      </div>

      {!coachId && <Empty msg="Select a coach to view their performance report." />}
      {coachId && loading && <Loading />}

      {report && !loading && (
        <div className="space-y-4">
          {/* Overall Grade */}
          <div className={`rounded-2xl border p-6 ${coachGradeBg(report.overallGrade)}`}>
            <div className="flex flex-wrap items-center gap-6">
              <div className="text-center">
                <div className={`text-6xl font-extrabold ${coachGradeColor(report.overallGrade)}`}>
                  {coachGradeLetter(report.overallGrade)}
                </div>
                <div className="mt-1 text-xs font-semibold uppercase tracking-wide opacity-70">Overall Grade</div>
              </div>
              <div className="flex-1">
                <div className={`text-3xl font-extrabold ${coachGradeColor(report.overallGrade)}`}>
                  {report.overallGrade != null ? `${report.overallGrade}%` : "Insufficient Data"}
                </div>
                <div className="mt-1 text-sm font-semibold text-gray-700">{report.coach?.name || "—"}</div>
                <div className="mt-1 text-xs text-gray-500">
                  Period: {new Date(report.dateRange.from).toLocaleDateString()} – {new Date(report.dateRange.to).toLocaleDateString()}
                </div>
                {report.team?.teachers?.length > 0 && (
                  <div className="mt-1 text-xs text-gray-500">
                    Team: {report.team.teachers.map((t) => t.name).join(", ")}
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3 text-center text-xs">
                {[
                  { label: "Team Perf.", val: report.team?.normalized != null ? `${report.team.normalized}%` : "—" },
                  { label: "Evaluation", val: report.evaluation?.normalized != null ? `${report.evaluation.normalized}%` : "—" },
                ].map((s) => (
                  <div key={s.label} className="rounded-lg border border-white/60 bg-white/50 px-3 py-2">
                    <div className="text-lg font-extrabold text-gray-800">{s.val}</div>
                    <div className="font-semibold text-gray-600">{s.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Team Performance Grade + Evaluation Grade */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-gray-200 bg-white p-5">
              <div className="text-sm font-extrabold text-gray-900">Team Performance Grade</div>
              <p className="mt-0.5 text-xs text-gray-500">
                Average {report.team?.usingSnapshots ? "composite score" : "observation score"} of teachers assigned to this coach over time.
              </p>
              {report.team?.avgScore != null && (
                <div className="mt-1 text-xs text-gray-600">
                  Team avg: <span className="font-bold text-gray-900">{report.team.avgScore}{report.team.usingSnapshots ? "" : "/10"}</span>
                </div>
              )}
              <div className="mt-3">
                <TrendLineChart
                  data={report.team?.trend || []}
                  lines={[{ key: "score", label: "Team Avg Score", color: "#0284c7" }]}
                  yLabel="Score"
                />
              </div>
              {(report.team?.teachers?.length ?? 0) === 0 && (
                <div className="mt-2 text-xs text-gray-400 italic">No teachers observed by this coach yet.</div>
              )}
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-5">
              <div className="text-sm font-extrabold text-gray-900">Evaluation Grade</div>
              <p className="mt-0.5 text-xs text-gray-500">Evaluation scores filled out by admin — score over time.</p>
              {report.evaluation?.mostRecentScore != null && (
                <div className="mt-1 text-xs text-gray-600">
                  Most recent: <span className="font-bold text-gray-900">{report.evaluation.mostRecentScore}/10</span>
                </div>
              )}
              <div className="mt-3">
                <TrendLineChart
                  data={report.evaluation?.trend || []}
                  lines={[{ key: "score", label: "Evaluation Score", color: "#7c3aed" }]}
                  yDomain={[0, 10]}
                  yLabel="Score"
                />
              </div>
            </div>
          </div>

          {/* Checklist Grade (full width) */}
          <div className="rounded-2xl border border-gray-200 bg-white p-5">
            <div className="flex flex-wrap items-center gap-6">
              <div>
                <div className="text-sm font-extrabold text-gray-900">Checklist Grade</div>
                <p className="mt-0.5 text-xs text-gray-500">Percentage of assigned daily checklist items completed in this period.</p>
              </div>
              <div className="flex items-center gap-4">
                <div className={`flex h-20 w-20 items-center justify-center rounded-full border-4 font-extrabold text-xl ${report.checklist?.pct != null ? coachGradeBg(report.checklist.pct) : "border-gray-200 text-gray-400"}`}>
                  {report.checklist?.pct != null ? `${report.checklist.pct}%` : "—"}
                </div>
                <div className="text-sm text-gray-600">
                  <div>{report.checklist?.completedCount ?? 0} items completed</div>
                  <div className="text-xs text-gray-400">out of ~{report.checklist?.assignedCount ?? 0} assigned items × days</div>
                </div>
              </div>
            </div>
          </div>

          {/* Commendations + Citations */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-5">
              <div className="text-sm font-extrabold text-emerald-900">Commendations Given to Team</div>
              <p className="mt-0.5 text-xs text-emerald-700">Total commendations awarded to teachers under this coach in this period.</p>
              <div className="mt-4 text-4xl font-extrabold text-emerald-700">{report.commendations?.teamTotal ?? 0}</div>
            </div>
            <div className="rounded-2xl border border-red-100 bg-red-50 p-5">
              <div className="text-sm font-extrabold text-red-900">Citations Given to Team</div>
              <p className="mt-0.5 text-xs text-red-700">Total citations issued to teachers under this coach in this period.</p>
              <div className="mt-4 text-4xl font-extrabold text-red-700">{report.citations?.teamTotal ?? 0}</div>
            </div>
          </div>

          {/* HR Section */}
          <div className="rounded-2xl border border-gray-200 bg-white p-5">
            <div className="text-sm font-extrabold text-gray-900">HR</div>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-5">
              {[
                { label: "Hours Worked", value: report.hr?.hoursWorked ?? "—", color: "bg-sky-50 text-sky-800 border-sky-200" },
                { label: "Lates", value: report.hr?.lates ?? "—", color: "bg-amber-50 text-amber-800 border-amber-200" },
                { label: "Absences", value: report.hr?.absences ?? "—", color: "bg-red-50 text-red-800 border-red-200" },
                { label: "PTO Available (hrs)", value: report.hr?.ptoAvailable ?? "—", color: "bg-emerald-50 text-emerald-800 border-emerald-200" },
                { label: "UTO Available (hrs)", value: report.hr?.utoAvailable ?? "—", color: "bg-gray-50 text-gray-800 border-gray-200" },
              ].map((s) => (
                <div key={s.label} className={`rounded-xl border p-4 ${s.color}`}>
                  <div className="text-2xl font-extrabold">{String(s.value)}</div>
                  <div className="mt-0.5 text-xs font-semibold uppercase tracking-wide opacity-70">{s.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Training Hours + Training Pathway */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-gray-200 bg-white p-5">
              <div className="text-sm font-extrabold text-gray-900">Training Hours</div>
              <p className="mt-0.5 text-xs text-gray-500">From training hours recorded in this period.</p>
              <div className="mt-3 text-3xl font-extrabold text-sky-700">{report.training?.totalHours ?? 0} hrs</div>
              {(report.training?.logs?.length ?? 0) > 0 && (
                <div className="mt-3 space-y-1.5">
                  {report.training.logs.map((l) => (
                    <div key={l.id} className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-xs">
                      <span className="font-semibold text-gray-800">{l.topic}</span>
                      <span className="text-gray-500">{l.hours} hrs · {new Date(l.date).toLocaleDateString()}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-5">
              <div className="text-sm font-extrabold text-gray-900">Training Pathway</div>
              <p className="mt-0.5 text-xs text-gray-500">From the Staff Advancement page.</p>
              {(report.trainingPathways?.length ?? 0) === 0
                ? <div className="mt-3 text-sm text-gray-400 italic">No training pathways configured.</div>
                : (
                  <div className="mt-3 space-y-2">
                    {report.trainingPathways.map((p) => (
                      <div key={p.id} className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-semibold text-gray-900">{p.title}</span>
                          {p.category && <span className="rounded-full bg-sky-100 px-2 py-0.5 text-xs text-sky-700">{p.category}</span>}
                        </div>
                        <div className="text-xs text-gray-500">{p.steps?.length ?? 0} steps</div>
                      </div>
                    ))}
                  </div>
                )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
