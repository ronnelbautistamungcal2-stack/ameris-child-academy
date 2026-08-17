import TeacherLayout from "@/components/teacher/TeacherLayout";
import TeacherSelfPerformanceReport from "@/components/teacher/TeacherSelfPerformanceReport";
import { SkeletonTable } from "@/components/ui/Skeleton";
import { apiJson } from "@/lib/api";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useState, useCallback } from "react";
import { AGE_GROUPS } from "@/lib/ageUtils";

// Lazy-load chart
const TrendLineChart = dynamic(() => import("@/components/analytics/charts/TrendLineChart"), { ssr: false });
const MilestonesBarChart = dynamic(() => import("@/components/analytics/charts/MilestonesBarChart"), { ssr: false });

function byString(a, b) { return String(a || "").localeCompare(String(b || "")); }
function fullName(child) {
  if (!child) return "";
  return `${child.firstName || ""}${child.lastName ? ` ${child.lastName}` : ""}`.trim();
}
function fmtDate(d) { if (!d) return "—"; return new Date(d).toLocaleDateString(); }
function defaultDateFrom() {
  const d = new Date(); d.setDate(d.getDate() - 90); return d.toISOString().split("T")[0];
}
function defaultDateTo() { return new Date().toISOString().split("T")[0]; }

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

const STATUS_BADGE = {
  NOT_STARTED: "bg-gray-100 text-gray-700",
  IN_PROGRESS: "bg-amber-100 text-amber-800",
  COMPLETED: "bg-emerald-100 text-emerald-800",
  PASSED: "bg-emerald-100 text-emerald-800",
  FAILED: "bg-red-100 text-red-800",
  ACTIVE: "bg-sky-100 text-sky-800",
  CLOSED: "bg-gray-100 text-gray-600",
  ARCHIVED: "bg-gray-100 text-gray-600",
};

const ACTIVITY_TYPE_LABELS = {
  DIAPER_CHANGE: "Diaper Change",
  NAP: "Nap", BOTTLE: "Bottle", MEAL: "Meal", SNACK: "Snack",
  ACTIVITY: "Activity", TASK_CHECKLIST: "Task Checklist",
  BEHAVIOR: "Course Correction", CITIZENSHIP: "Citizenship",
  ACCOMPLISHMENT: "Accomplishment", INCIDENT: "Incident",
  TOILETING: "Toileting", CHARACTER_HIGHLIGHT: "Character Highlight", OTHER: "Grade",
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

function ActivityIcon({ type }) {
  const icons = {
    NAP: "💤", BOTTLE: "🍼", MEAL: "🍽️", SNACK: "🥨",
    DIAPER_CHANGE: "🧷", ACTIVITY: "🎨", CITIZENSHIP: "⭐",
    ACCOMPLISHMENT: "🏆", INCIDENT: "⚠️", BEHAVIOR: "📋",
    TASK_CHECKLIST: "✅", TOILETING: "🚽", CHARACTER_HIGHLIGHT: "🌟", OTHER: "📝",
  };
  return <span className="text-base">{icons[type] || "📄"}</span>;
}

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
      <div className="flex-shrink-0 mt-0.5"><ActivityIcon type={a.type} /></div>
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

export default function TeacherReports() {
  const [activeTab, setActiveTab] = useState("student");
  const [centers, setCenters] = useState([]);
  const [centerId, setCenterId] = useState("");
  const [children, setChildren] = useState([]);
  const [childId, setChildId] = useState("");
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingChild, setLoadingChild] = useState(false);
  const [error, setError] = useState("");

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

  useEffect(() => {
    if (!centerId) { setChildren([]); setChildId(""); setReport(null); return; }
    setLoading(true);
    apiJson(`/api/v1/children?centerId=${encodeURIComponent(centerId)}`)
      .then((kids) => {
        const arr = Array.isArray(kids) ? kids : [];
        arr.sort((a, b) => byString(a.firstName, b.firstName));
        setChildren(arr);
        setChildId((cur) => cur || arr[0]?.id || "");
      })
      .catch((e) => setError(e.message || "Failed to load children"))
      .finally(() => setLoading(false));
  }, [centerId]);

  useEffect(() => {
    if (!childId) { setReport(null); return; }
    setLoadingChild(true);
    apiJson(`/api/v1/analytics/child-report?childId=${encodeURIComponent(childId)}`)
      .then((r) => setReport(r))
      .catch((e) => setError(e.message || "Failed to load report"))
      .finally(() => setLoadingChild(false));
  }, [childId]);

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
    return filterByDateRange(report?.accomplishments || [], accomplishmentFrom, accomplishmentTo);
  }, [report, accomplishmentFrom, accomplishmentTo]);

  const filteredCitizenshipLogs = useMemo(() => {
    return filterByDateRange(report?.citizenshipLogs || [], citizenshipLogFrom, citizenshipLogTo);
  }, [report, citizenshipLogFrom, citizenshipLogTo]);

  const filteredActivityLogs = useMemo(() => {
    return filterByDateRange(report?.activityLogs || [], activityLogFrom, activityLogTo);
  }, [report, activityLogFrom, activityLogTo]);

  const redFlags = useMemo(() => report?.redFlags || [], [report]);
  const behaviorPlans = useMemo(() => report?.behaviorPlans || [], [report]);

  return (
    <TeacherLayout title="Reports">
      <div className="space-y-4">
        {/* Tab switcher */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5 print:hidden">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-extrabold text-gray-900">Reports</h2>
            <button type="button" onClick={() => window.print()} className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-extrabold text-gray-800 hover:bg-gray-50">Print</button>
          </div>
          <div className="mt-3 flex gap-1 border-b border-gray-200">
            {[
              { key: "student", label: "Student Performance Report" },
              { key: "teacher", label: "Teacher Performance Report" },
              { key: "class", label: "Class Performance Report" },
            ].map((tab) => (
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

        {activeTab === "teacher" && (
          <TeacherSelfPerformanceReport centerId={centerId} centers={centers} loading={loading} setCenterId={setCenterId} />
        )}

        {activeTab === "class" && (
          <ClassPerformanceReport centerId={centerId} centers={centers} loadingCenters={loading} setCenterId={setCenterId} />
        )}

        {activeTab === "student" && (
        <div className="space-y-4">
        {/* Print-only header */}
        <div className="hidden print:block print:text-center print:mb-4">
          <h1 className="text-xl font-extrabold">Student Performance Report</h1>
          {report?.child && (
            <p className="text-sm text-gray-600">{fullName(report.child)} — {new Date().toLocaleDateString()}</p>
          )}
        </div>

        {/* Header + selectors */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5 print:border-0 print:p-0">
          <div className="flex flex-wrap items-end justify-between gap-3 print:hidden">
            <div>
              <h2 className="text-lg font-extrabold text-gray-900">Student Performance Report</h2>
              <p className="mt-1 text-sm text-gray-600">Goals, grades, accomplishments, and activity log.</p>
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <label className="block">
                <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Center</div>
                <select
                  value={centerId}
                  onChange={(e) => setCenterId(e.target.value)}
                  className="mt-1 w-56 max-w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
                  disabled={loading}
                >
                  <option value="">Select a center…</option>
                  {centers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </label>
              <label className="block">
                <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Child</div>
                <select
                  value={childId}
                  onChange={(e) => setChildId(e.target.value)}
                  className="mt-1 w-56 max-w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
                  disabled={!centerId || loading}
                >
                  <option value="">Select a child…</option>
                  {children.map((c) => <option key={c.id} value={c.id}>{fullName(c)}</option>)}
                </select>
              </label>
            </div>
          </div>

          {error && (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800 print:hidden">{error}</div>
          )}
          {!centerId && !error && (
            <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600 print:hidden">Select a center.</div>
          )}
          {centerId && !childId && (
            <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600 print:hidden">Select a child to view their report.</div>
          )}
          {loadingChild && (
            <div className="mt-4 print:hidden"><SkeletonTable rows={5} cols={3} /></div>
          )}
        </div>

        {report && !loadingChild && (
          <div className="space-y-4">
            {/* Summary Stats */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 print:break-inside-avoid">
              {[
                { label: "Total Goals", value: report.progress?.totalGoals || 0, bg: "bg-gray-50 text-gray-800 border-gray-200" },
                { label: "Completed", value: report.progress?.completed || 0, bg: "bg-emerald-50 text-emerald-800 border-emerald-200" },
                { label: "Failed", value: report.progress?.failed || 0, bg: "bg-red-50 text-red-800 border-red-200" },
                { label: "Completion Rate", value: `${report.progress?.completionRate || 0}%`, bg: "bg-sky-50 text-sky-800 border-sky-200" },
              ].map((s) => (
                <div key={s.label} className={`rounded-xl border p-4 ${s.bg}`}>
                  <div className="text-2xl font-extrabold">{s.value}</div>
                  <div className="text-xs font-semibold uppercase tracking-wide opacity-80">{s.label}</div>
                </div>
              ))}
            </div>

            {/* Citizenship Grade + Milestones Grade */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 print:break-inside-avoid">
              <div className="rounded-2xl border border-gray-200 bg-white p-5">
                <div className="text-sm font-extrabold text-gray-900">Citizenship Grade</div>
                <p className="mt-0.5 text-xs text-gray-500">From log activity "grade" — score over time.</p>
                <div className="mt-3 grid grid-cols-2 gap-2 print:hidden">
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

              <div className="rounded-2xl border border-gray-200 bg-white p-5">
                <div className="text-sm font-extrabold text-gray-900">Milestones Grade</div>
                <p className="mt-0.5 text-xs text-gray-500">From steps of progression completed — % passed by category.</p>
                <div className="mt-3 print:hidden">
                  <FilterSelect label="Filter by Age Group" value={milestonesAgeGroup} onChange={setMilestonesAgeGroup}>
                    <option value="">All age groups</option>
                    {AGE_GROUPS.map((g) => <option key={g.key} value={g.key}>{g.label}</option>)}
                  </FilterSelect>
                </div>
                <div className="mt-3">
                  {milestoneChartData.length > 0
                    ? <MilestonesBarChart data={milestoneChartData} />
                    : <div className="flex h-48 items-center justify-center text-sm text-gray-500">No milestone data.</div>
                  }
                </div>
              </div>
            </div>

            {/* Active Goals */}
            <div className="rounded-2xl border border-gray-200 bg-white p-5 print:break-inside-avoid">
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

            {/* Accomplishments + Citizenship Log */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 print:break-inside-avoid">
              <div className="rounded-2xl border border-gray-200 bg-white p-5">
                <div className="text-sm font-extrabold text-gray-900">Accomplishments</div>
                <p className="mt-0.5 text-xs text-gray-500">From log activity "Accomplishments".</p>
                <div className="mt-3 grid grid-cols-2 gap-2 print:hidden">
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

              <div className="rounded-2xl border border-gray-200 bg-white p-5">
                <div className="text-sm font-extrabold text-gray-900">Citizenship Log</div>
                <p className="mt-0.5 text-xs text-gray-500">From log activity "Citizenship".</p>
                <div className="mt-3 grid grid-cols-2 gap-2 print:hidden">
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

            {/* Red Flags */}
            <div className="rounded-2xl border border-gray-200 bg-white p-5 print:break-inside-avoid">
              <div className="text-sm font-extrabold text-gray-900">Red Flags</div>
              <p className="mt-0.5 text-xs text-gray-500">Active flags recorded on this student.</p>
              {redFlags.length > 0 ? (
                <div className="mt-3 space-y-2">
                  {redFlags.map((f) => (
                    <div key={f.id} className="flex items-start gap-3 rounded-lg border border-red-100 bg-red-50 px-3 py-2">
                      <div className="mt-1 flex-shrink-0 h-2 w-2 rounded-full bg-red-500" />
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

            {/* Individual Progress Plans */}
            <div className="rounded-2xl border border-gray-200 bg-white p-5 print:break-inside-avoid">
              <div className="text-sm font-extrabold text-gray-900">Individual Progress Plan</div>
              <p className="mt-0.5 text-xs text-gray-500">Intervention plans — plan title and date implemented.</p>
              {behaviorPlans.length > 0 ? (
                <div className="mt-3 space-y-2">
                  {behaviorPlans.map((plan) => (
                    <div key={plan.id} className={`rounded-lg border px-3 py-2 ${plan.status === "CLOSED" ? "border-gray-200 bg-gray-50" : "border-sky-100 bg-sky-50"}`}>
                      <div className="flex items-center gap-2">
                        <div className="text-sm font-semibold text-gray-900">{plan.title}</div>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_BADGE[plan.status] || "bg-gray-100 text-gray-700"}`}>
                          {plan.status === "CLOSED" ? "Closed" : plan.status}
                        </span>
                        {plan.parentApproved && (
                          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">Parent Approved</span>
                        )}
                      </div>
                      <div className="mt-0.5 text-xs text-gray-500">
                        Plan Start: {fmtDate(plan.startDate)}
                        {plan.createdBy?.name && ` • Created by: ${plan.createdBy.name}`}
                        {plan.closedAt && ` • Closed: ${fmtDate(plan.closedAt)}`}
                      </div>
                      {plan.teacherTactics && (
                        <div className="mt-1">
                          <span className="text-xs font-semibold text-gray-500">Teacher Tactics: </span>
                          <span className="text-xs text-gray-700">{plan.teacherTactics}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-3 rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm text-gray-500">No Individual Progress Plans on file.</div>
              )}
            </div>

            {/* Student Activity Log */}
            <div className="rounded-2xl border border-gray-200 bg-white p-5 print:break-inside-avoid">
              <div className="text-sm font-extrabold text-gray-900">Student Activity Log</div>
              <p className="mt-0.5 text-xs text-gray-500">Daily activity log (similar to Procare).</p>
              <div className="mt-3 grid grid-cols-2 gap-2 print:hidden">
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
        )}
      </div>
    </TeacherLayout>
  );
}

// ─── Class Performance Report (teacher view) ──────────────────

const CLASS_ACTIVITY_ICONS = {
  NAP: "💤", BOTTLE: "🍼", MEAL: "🍽️", SNACK: "🥨",
  DIAPER_CHANGE: "🧷", ACTIVITY: "🎨", CITIZENSHIP: "⭐",
  ACCOMPLISHMENT: "🏆", INCIDENT: "⚠️", BEHAVIOR: "📋",
  TASK_CHECKLIST: "✅", TOILETING: "🚽", OTHER: "📝",
};

function behaviorTypeLabel(type) {
  if (!type) return "—";
  const LABELS = {
    OTHER: "Other", HITTING: "Hitting", BITING: "Biting", KICKING: "Kicking",
    SCRATCHING: "Scratching", PUSHING: "Pushing", THROWING: "Throwing",
    TANTRUM: "Tantrum", NOT_FOLLOWING_DIRECTIONS: "Not Following Directions",
    RESPECT: "Respect", SHARING: "Sharing", HELPING: "Helping",
    EMPATHY: "Empathy", COMMUNICATION: "Communication",
  };
  return LABELS[type] || type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function ClassPerformanceReport({ centerId, centers, loadingCenters, setCenterId }) {
  const [classes, setClasses] = useState([]);
  const [classId, setClassId] = useState("");
  const [dateFrom, setDateFrom] = useState(defaultDateFrom());
  const [dateTo, setDateTo] = useState(defaultDateTo());
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [expandedIPP, setExpandedIPP] = useState(null);
  const [expandedLog, setExpandedLog] = useState(null);

  useEffect(() => {
    if (!centerId) { setClasses([]); setClassId(""); return; }
    apiJson(`/api/v1/classes?centerId=${encodeURIComponent(centerId)}`)
      .then((r) => {
        const arr = Array.isArray(r) ? r : [];
        setClasses(arr);
        // Auto-select if teacher has only one class
        if (arr.length === 1) setClassId(arr[0].id);
      })
      .catch(() => {});
  }, [centerId]);

  // Auto-select first center
  useEffect(() => {
    if (!centerId && centers.length === 1) setCenterId(centers[0].id);
  }, [centers, centerId, setCenterId]);

  const loadReport = useCallback(async () => {
    if (!classId || !centerId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ classId, centerId, from: dateFrom, to: dateTo });
      const r = await apiJson(`/api/v1/analytics/class-report?${params}`);
      setReport(r);
    } catch {}
    setLoading(false);
  }, [classId, centerId, dateFrom, dateTo]);

  useEffect(() => { loadReport(); }, [loadReport]);

  const milestoneChartData = (report?.milestonesGrade || []).map((c) => ({
    category: c.category,
    "% Passed": c["% Passed"] || 0,
  }));

  return (
    <div className="space-y-4">
      {/* Selectors */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5">
        <div className="text-sm font-extrabold text-gray-900 mb-3">Class Performance Report</div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <label className="block">
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">Center</div>
            <select
              value={centerId}
              onChange={(e) => setCenterId(e.target.value)}
              disabled={loadingCenters}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            >
              <option value="">Select a center…</option>
              {centers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <label className="block">
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">Classroom</div>
            <select
              value={classId}
              onChange={(e) => setClassId(e.target.value)}
              disabled={!centerId || classes.length === 0}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            >
              <option value="">Choose a classroom…</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <label className="block">
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">Start Date</div>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" />
          </label>
          <label className="block">
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">End Date</div>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" />
          </label>
        </div>
      </div>

      {!centerId && <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">Select a center to get started.</div>}
      {centerId && !classId && <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">Select a classroom to view the class performance report.</div>}
      {classId && loading && <div className="rounded-2xl border border-gray-200 bg-white p-8"><SkeletonTable rows={5} cols={3} /></div>}

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
              <p className="mt-0.5 text-xs text-gray-500">Steps of progression completed — % passed by category.</p>
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

          {/* Course Correction Logs */}
          <div className="rounded-2xl border border-gray-200 bg-white p-5">
            <div className="text-sm font-extrabold text-gray-900">Course Correction Logs</div>
            <p className="mt-0.5 text-xs text-gray-500">Course Correction activity entries at level 2 or level 3.</p>
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
                        <tr key={log.id} className="cursor-pointer hover:bg-gray-50" onClick={() => setExpandedLog(expandedLog === log.id ? null : log.id)}>
                          <td className="px-4 py-2 font-semibold text-sky-700">{log.childName}</td>
                          <td className="px-4 py-2 text-gray-700">{behaviorTypeLabel(log.type)}</td>
                          <td className="px-4 py-2">
                            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${log.level === "3" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>Level {log.level}</span>
                          </td>
                          <td className="px-4 py-2 text-xs text-gray-500">{new Date(log.createdAt).toLocaleDateString()}</td>
                        </tr>
                        {expandedLog === log.id && log.notes && (
                          <tr key={`${log.id}-d`}>
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
                        <tr key={plan.id} className="cursor-pointer hover:bg-gray-50" onClick={() => setExpandedIPP(expandedIPP === plan.id ? null : plan.id)}>
                          <td className="px-4 py-2 font-semibold text-sky-700">{plan.childName}</td>
                          <td className="px-4 py-2 font-semibold text-gray-900">{plan.title}</td>
                          <td className="px-4 py-2 text-xs text-gray-500">{new Date(plan.startDate || plan.createdAt).toLocaleDateString()}</td>
                          <td className="px-4 py-2 text-xs text-sky-600">{expandedIPP === plan.id ? "Hide" : "Details"}</td>
                        </tr>
                        {expandedIPP === plan.id && (
                          <tr key={`${plan.id}-d`}>
                            <td colSpan={4} className="bg-sky-50 px-4 py-3 text-xs">
                              {plan.description && <div className="mb-1"><span className="font-semibold text-gray-700">Description: </span><span className="text-gray-600">{plan.description}</span></div>}
                              {plan.teacherTactics && <div className="mb-1"><span className="font-semibold text-gray-700">Teacher Tactics: </span><span className="text-gray-600">{plan.teacherTactics}</span></div>}
                              {(plan.goals || []).length > 0 && (
                                <div className="space-y-1">
                                  {plan.goals.map((g) => (
                                    <div key={g.id} className="flex items-center gap-2">
                                      <span className={`rounded-full px-2 py-0.5 font-semibold text-xs ${g.status === "MET" ? "bg-emerald-100 text-emerald-700" : g.status === "NOT_MET" ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-600"}`}>{g.status?.replace(/_/g, " ")}</span>
                                      <span className="text-gray-700">{g.title}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
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
            <p className="mt-0.5 text-xs text-gray-500">Activity logs for all children — similar to Procare.</p>
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
                      <div className="w-28 shrink-0">
                        <div className="font-semibold text-sm text-gray-900 truncate">{child.childName}</div>
                      </div>
                      <div className="flex flex-wrap gap-1.5 flex-1">
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
