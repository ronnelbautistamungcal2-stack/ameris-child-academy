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
const TeacherScoreChart = dynamic(() => import("@/components/analytics/charts/TeacherScoreChart"), { ssr: false });

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "students", label: "Student Reports" },
  { key: "behavior", label: "Behavior Tracking" },
  { key: "teachers", label: "Teacher Performance" },
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
            {activeTab === "behavior" && (
              <BehaviorTab centerId={centerId} classId={classId} children={children} dateFrom={dateFrom} dateTo={dateTo} />
            )}
            {activeTab === "teachers" && (
              <TeachersTab centerId={centerId} />
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

// ─── Students Tab ─────────────────────────────────────────────

function StudentsTab({ centerId, children }) {
  const [childId, setChildId] = useState("");
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showPlanForm, setShowPlanForm] = useState(false);

  useEffect(() => {
    if (!childId) { setReport(null); return; }
    (async () => {
      setLoading(true);
      try {
        const r = await apiJson(`/api/v1/analytics/child-report?childId=${encodeURIComponent(childId)}`);
        setReport(r);
      } catch {}
      setLoading(false);
    })();
  }, [childId]);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-gray-200 bg-white p-4">
        <FilterSelect label="Select Child" value={childId} onChange={setChildId}>
          <option value="">Choose a child…</option>
          {children.map((c) => <option key={c.id} value={c.id}>{fullName(c)}</option>)}
        </FilterSelect>
      </div>

      {loading && <Loading />}
      {!childId && !loading && <Empty msg="Select a child to view their report." />}

      {report && !loading && (
        <div className="space-y-4">
          {/* Summary cards */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard label="Total Goals" value={report.progress?.totalGoals || 0} color="gray" />
            <KpiCard label="Completed" value={report.progress?.completed || 0} color="emerald" />
            <KpiCard label="Failed" value={report.progress?.failed || 0} color="red" />
            <KpiCard
              label="Completion Rate"
              value={`${report.progress?.completionRate || 0}%`}
              color="sky"
            />
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <ChartCard title="Progress by Category">
              <CategoryBarChart data={report.progress?.byCategory || []} />
            </ChartCard>
            <ChartCard title="Domain Profile">
              <DomainRadarChart data={report.behavior?.domainAverages || {}} />
            </ChartCard>
          </div>

          <ChartCard title="Behavior Score History">
            <BehaviorFlowChart
              data={(report.behavior?.history || []).map((h) => ({
                label: h.date,
                ...(h.domains || {}),
              }))}
            />
          </ChartCard>

          {/* Behavior Plans */}
          <div className="rounded-2xl border border-gray-200 bg-white p-5">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-extrabold text-gray-900">Behavior Plans</div>
                <p className="mt-0.5 text-xs text-gray-600">Customizable intervention plans for this child.</p>
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
                onCreated={() => {
                  setShowPlanForm(false);
                  // Refresh
                  setChildId((v) => { const tmp = v; setChildId(""); setTimeout(() => setChildId(tmp), 50); return v; });
                }}
              />
            )}

            {(report.behaviorPlans || []).length > 0 ? (
              <div className="mt-3 space-y-3">
                {report.behaviorPlans.map((plan) => (
                  <BehaviorPlanCard key={plan.id} plan={plan} />
                ))}
              </div>
            ) : !showPlanForm ? (
              <div className="mt-3 rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm text-gray-600">
                No active behavior plans.
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
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

function TeachersTab({ centerId }) {
  const [teachers, setTeachers] = useState([]);
  const [period, setPeriod] = useState(currentPeriod());
  const [loading, setLoading] = useState(true);
  const [computing, setComputing] = useState(false);
  const [expandedId, setExpandedId] = useState("");

  const loadTeachers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ centerId, periodType: "MONTH" });
      if (period) params.set("period", period);
      const r = await apiJson(`/api/v1/analytics/teacher-performance?${params}`);
      setTeachers(r.teachers || []);
    } catch {}
    setLoading(false);
  }, [centerId, period]);

  useEffect(() => { loadTeachers(); }, [loadTeachers]);

  async function handleCompute() {
    setComputing(true);
    try {
      await apiJson("/api/v1/analytics/teacher-performance/compute", {
        method: "POST",
        body: JSON.stringify({ centerId, period, periodType: "MONTH" }),
      });
      await loadTeachers();
    } catch {}
    setComputing(false);
  }

  const scoreColor = (score) => {
    if (score >= 80) return "text-emerald-700";
    if (score >= 60) return "text-amber-700";
    return "text-red-700";
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-gray-200 bg-white p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-sm font-extrabold text-gray-900">Teacher Performance</div>
            <p className="mt-0.5 text-xs text-gray-600">
              Composite score based on child progress (40%), behavior improvement (25%), activity logging (20%), attendance tracking (15%).
            </p>
          </div>
          <div className="flex items-end gap-2">
            <FilterInput label="Period" type="month" value={period} onChange={setPeriod} />
            <button
              onClick={handleCompute}
              disabled={computing}
              className="rounded-lg bg-blue-700 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
            >
              {computing ? "Computing…" : "Compute Scores"}
            </button>
          </div>
        </div>
      </div>

      {loading ? <Loading /> : teachers.length === 0 ? (
        <Empty msg="No teacher performance data. Click 'Compute Scores' to generate." />
      ) : (
        <div className="rounded-2xl border border-gray-200 bg-white overflow-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-3 text-left">Teacher</th>
                <th className="px-4 py-3 text-left">Composite</th>
                <th className="px-4 py-3 text-left">Children</th>
                <th className="px-4 py-3 text-left">Goals Done</th>
                <th className="px-4 py-3 text-left">Goals Failed</th>
                <th className="px-4 py-3 text-left">Activity Logs</th>
                <th className="px-4 py-3 text-left">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {teachers.map((t) => (
                <TeacherRow
                  key={t.teacherId}
                  t={t}
                  expanded={expandedId === t.teacherId}
                  onToggle={() => setExpandedId(expandedId === t.teacherId ? "" : t.teacherId)}
                  scoreColor={scoreColor}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function TeacherRow({ t, expanded, onToggle, scoreColor }) {
  return (
    <>
      <tr>
        <td className="px-4 py-3 font-semibold text-gray-900">{t.teacherName}</td>
        <td className={`px-4 py-3 font-extrabold ${scoreColor(t.compositeScore)}`}>
          {t.compositeScore}
        </td>
        <td className="px-4 py-3 text-gray-700">{t.metrics?.childrenCount || 0}</td>
        <td className="px-4 py-3 text-emerald-700 font-semibold">{t.metrics?.goalsCompleted || 0}</td>
        <td className="px-4 py-3 text-red-700 font-semibold">{t.metrics?.goalsFailed || 0}</td>
        <td className="px-4 py-3 text-gray-700">{t.metrics?.activityLogs || 0}</td>
        <td className="px-4 py-3">
          <button onClick={onToggle} className="text-xs font-semibold text-sky-600 hover:text-sky-800">
            {expanded ? "Hide" : "Breakdown"}
          </button>
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={7} className="bg-gray-50 px-4 py-4">
            <div className="max-w-lg">
              <TeacherScoreChart breakdown={t.breakdown || {}} />
            </div>
          </td>
        </tr>
      )}
    </>
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

// ─── Behavior Plan Components ─────────────────────────────────

function BehaviorPlanCard({ plan }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-sm font-extrabold text-gray-900">{plan.title}</div>
          <div className="mt-0.5 flex flex-wrap gap-1">
            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_BADGE[plan.status] || "bg-gray-100 text-gray-700"}`}>
              {plan.status}
            </span>
            {(plan.targetDomains || []).map((d) => (
              <span key={d} className={`rounded-full px-2 py-0.5 text-xs font-semibold ${DOMAIN_META[d]?.color || "bg-gray-100"}`}>
                {DOMAIN_META[d]?.label || d}
              </span>
            ))}
          </div>
        </div>
        <button onClick={() => setExpanded(!expanded)} className="text-xs font-semibold text-sky-600 hover:text-sky-800">
          {expanded ? "Collapse" : "View Goals"}
        </button>
      </div>
      {plan.description && <p className="mt-1 text-xs text-gray-600">{plan.description}</p>}
      <div className="mt-1 text-xs text-gray-500">
        {plan.startDate && `Start: ${fmtDate(plan.startDate)}`}
        {plan.endDate && ` • End: ${fmtDate(plan.endDate)}`}
        {plan.createdBy?.name && ` • By: ${plan.createdBy.name}`}
      </div>

      {expanded && (plan.goals || []).length > 0 && (
        <div className="mt-3 space-y-2">
          {plan.goals.map((goal) => (
            <div key={goal.id} className="rounded-lg border border-gray-200 bg-white p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="text-xs font-semibold text-gray-900">{goal.title}</div>
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_BADGE[goal.status] || "bg-gray-100 text-gray-700"}`}>
                  {GOAL_STATUS_LABEL[goal.status] || goal.status}
                </span>
              </div>
              <div className="mt-1 flex flex-wrap gap-2 text-xs text-gray-600">
                <span className={`rounded px-1.5 py-0.5 ${DOMAIN_META[goal.domain]?.color || "bg-gray-100"}`}>
                  {DOMAIN_META[goal.domain]?.label || goal.domain}
                </span>
                {goal.targetScore && <span>Target: {goal.targetScore}/4</span>}
                {goal.currentScore && <span>Current: {goal.currentScore}/4</span>}
              </div>
              {goal.strategies?.length > 0 && (
                <ul className="mt-1 ml-3 list-disc text-xs text-gray-600">
                  {goal.strategies.map((s, i) => <li key={i}>{s}</li>)}
                </ul>
              )}
              {goal.notes && <p className="mt-1 text-xs text-gray-500">{goal.notes}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function BehaviorPlanForm({ childId, centerId, onCreated }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [targetDomains, setTargetDomains] = useState([]);
  const [saving, setSaving] = useState(false);

  const toggleDomain = (d) => {
    setTargetDomains((prev) => prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]);
  };

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
          targetDomains,
          goals: targetDomains.map((d, i) => ({
            domain: d,
            title: `Improve ${DOMAIN_META[d]?.label || d}`,
            sortOrder: i,
            targetScore: 3,
            strategies: [],
          })),
        }),
      });
      onCreated();
    } catch {}
    setSaving(false);
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 space-y-3 rounded-xl border border-sky-200 bg-sky-50 p-4">
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600">Plan Title</label>
        <input
          className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
          placeholder="e.g., Social Skills Improvement Plan"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />
      </div>
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600">Description</label>
        <textarea
          className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
          rows={2}
          placeholder="Optional description…"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600">Target Domains</label>
        <div className="mt-1 flex flex-wrap gap-2">
          {Object.entries(DOMAIN_META).map(([key, meta]) => (
            <button
              key={key}
              type="button"
              onClick={() => toggleDomain(key)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${targetDomains.includes(key) ? "bg-sky-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}
            >
              {meta.label}
            </button>
          ))}
        </div>
      </div>
      <button
        type="submit"
        disabled={saving || !title.trim()}
        className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-60"
      >
        {saving ? "Creating…" : "Create Plan"}
      </button>
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
