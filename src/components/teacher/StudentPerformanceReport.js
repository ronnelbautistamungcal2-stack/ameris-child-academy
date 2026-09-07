import { SkeletonTable } from "@/components/ui/Skeleton";
import { apiJson } from "@/lib/api";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { AGE_GROUPS } from "@/lib/ageUtils";
import useSyncedCenterId from "@/hooks/useSyncedCenterId";
import { useRouter } from "next/router";

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

export default function StudentPerformanceReport() {
  const router = useRouter();
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

  useSyncedCenterId(centerId, setCenterId, centers);

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
        const requestedChildId =
          typeof router.query.childId === "string" ? router.query.childId : "";
        setChildId((cur) => {
          if (cur && arr.some((c) => c.id === cur)) return cur;
          if (requestedChildId && arr.some((c) => c.id === requestedChildId)) {
            return requestedChildId;
          }
          return cur || arr[0]?.id || "";
        });
      })
      .catch((e) => setError(e.message || "Failed to load children"))
      .finally(() => setLoading(false));
  }, [centerId, router.query.childId]);

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
  );
}
