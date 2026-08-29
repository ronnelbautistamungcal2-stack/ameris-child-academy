import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";
import { apiJson } from "@/lib/api";
import { AGE_GROUPS } from "@/lib/ageUtils";
import { ParentEmpty } from "@/components/parent/ParentUI";
import { SkeletonCard } from "@/components/ui/Skeleton";

const TrendLineChart = dynamic(() => import("@/components/analytics/charts/TrendLineChart"), { ssr: false });

const MilestonesBarChart = dynamic(
  () => import("recharts").then((mod) => {
    const { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } = mod;
    function Chart({ data = [] }) {
      if (!data.length) return <div className="flex h-48 items-center justify-center text-sm text-gray-500 dark:text-gray-400">No data.</div>;
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
  { ssr: false },
);

const STATUS_BADGE = {
  NOT_STARTED: "bg-gray-100 text-gray-700 dark:bg-slate-800 dark:text-gray-300",
  IN_PROGRESS: "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-200",
  COMPLETED: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200",
  PASSED: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200",
  FAILED: "bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-200",
  ACTIVE: "bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-200",
  CLOSED: "bg-gray-100 text-gray-600 dark:bg-slate-800 dark:text-gray-300",
  MET: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200",
  NOT_MET: "bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-200",
};

const GOAL_STATUS_LABEL = { NOT_STARTED: "Not Started", IN_PROGRESS: "In Progress", MET: "Met", NOT_MET: "Not Met" };

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

const TOILETING_TYPE_LABELS = { SUCCESS: "Success", TRIED: "Tried", ACCIDENT: "Accident" };

const CHARACTER_HIGHLIGHT_TYPE_LABELS = {
  BROTHERS_KEEPER: "Brother's Keeper",
  CHAMPION_OF_VIRTUE: "Champion of Virtue",
  FULL_REPENTANCE: "Full Repentance",
  CHAMPION_OF_OBEDIENCE: "Champion of Obedience",
  CHAMPION_OF_RESPECT: "Champion of Respect",
  CHAMPION_OF_HONESTY: "Champion of Honesty",
  OTHER: "Other",
};

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

export default function StudentPerformanceReportPanel({ childId, onPlanApproved }) {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [approvingPlanId, setApprovingPlanId] = useState("");

  const [citizenshipFrom, setCitizenshipFrom] = useState(defaultDateFrom());
  const [citizenshipTo, setCitizenshipTo] = useState(defaultDateTo());
  const [milestonesAgeGroup, setMilestonesAgeGroup] = useState("");
  const [accomplishmentFrom, setAccomplishmentFrom] = useState(defaultDateFrom());
  const [accomplishmentTo, setAccomplishmentTo] = useState(defaultDateTo());
  const [citizenshipLogFrom, setCitizenshipLogFrom] = useState(defaultDateFrom());
  const [citizenshipLogTo, setCitizenshipLogTo] = useState(defaultDateTo());
  const [activityLogFrom, setActivityLogFrom] = useState(defaultDateFrom());
  const [activityLogTo, setActivityLogTo] = useState(defaultDateTo());

  const fetchReport = useCallback(
    (targetChildId, { silent } = {}) => {
      if (!targetChildId) {
        setReport(null);
        return Promise.resolve();
      }
      if (!silent) setLoading(true);
      return apiJson(`/api/v1/analytics/child-report?childId=${encodeURIComponent(targetChildId)}`)
        .then((r) => setReport(r))
        .catch(() => setReport(null))
        .finally(() => {
          if (!silent) setLoading(false);
        });
    },
    [],
  );

  useEffect(() => {
    fetchReport(childId);
  }, [childId, fetchReport]);

  const approvePlan = useCallback(
    async (planId) => {
      setApprovingPlanId(planId);
      try {
        await apiJson(`/api/v1/behavior-plans/${planId}/approve`, {
          method: "POST",
          body: JSON.stringify({}),
        });
        await fetchReport(childId, { silent: true });
        onPlanApproved?.();
      } finally {
        setApprovingPlanId("");
      }
    },
    [childId, fetchReport, onPlanApproved],
  );

  const citizenshipGrades = useMemo(() => {
    const all = report?.citizenshipGrades || [];
    return filterByDateRange(all, citizenshipFrom, citizenshipTo);
  }, [report, citizenshipFrom, citizenshipTo]);

  const citizenshipChartData = useMemo(
    () =>
      citizenshipGrades.map((g) => ({
        label: new Date(g.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        score: g.score || 0,
      })),
    [citizenshipGrades],
  );

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

  const milestoneChartData = useMemo(
    () => milestonesData.map((c) => ({ category: c.category, "% Passed": c.passRate || 0 })),
    [milestonesData],
  );

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

  const behaviorPlans = useMemo(() => report?.behaviorPlans || [], [report]);

  if (!childId) return null;

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  if (!report) {
    return (
      <ParentEmpty
        title="No performance report yet"
        description="This report will populate once the center begins logging progress for your child."
      />
    );
  }

  return (
    <div className="space-y-3">
      {/* Summary Stats */}
      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <Kpi label="Total Goals" value={report.progress?.totalGoals || 0} tone="gray" />
        <Kpi label="Completed" value={report.progress?.completed || 0} tone="emerald" />
        <Kpi label="Failed" value={report.progress?.failed || 0} tone="rose" />
        <Kpi label="Completion Rate" value={`${report.progress?.completionRate || 0}%`} tone="sky" />
      </div>

      {/* Citizenship Grade + Milestones Grade */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <div className="rounded-[22px] border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-slate-900">
          <div className="text-base font-black tracking-tight text-gray-900 dark:text-gray-100">Citizenship Grade</div>
          <p className="mt-0.5 text-[13px] text-gray-500 dark:text-gray-400">Score over time, from logged citizenship grades.</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <DateField label="Start Date" value={citizenshipFrom} onChange={setCitizenshipFrom} />
            <DateField label="End Date" value={citizenshipTo} onChange={setCitizenshipTo} />
          </div>
          <div className="mt-3">
            <TrendLineChart
              data={citizenshipChartData}
              lines={[{ key: "score", label: "Score", color: "#0284c7" }]}
              yLabel="Score"
            />
          </div>
        </div>

        <div className="rounded-[22px] border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-slate-900">
          <div className="text-base font-black tracking-tight text-gray-900 dark:text-gray-100">Milestones Grade</div>
          <p className="mt-0.5 text-[13px] text-gray-500 dark:text-gray-400">Percent passed by category from steps of progression completed.</p>
          <div className="mt-3">
            <SelectField label="Filter by Age Group" value={milestonesAgeGroup} onChange={setMilestonesAgeGroup}>
              <option value="">All age groups</option>
              {AGE_GROUPS.map((g) => (
                <option key={g.key} value={g.key}>{g.label}</option>
              ))}
            </SelectField>
          </div>
          <div className="mt-3">
            {milestoneChartData.length > 0 ? (
              <MilestonesBarChart data={milestoneChartData} />
            ) : (
              <div className="flex h-48 items-center justify-center text-sm text-gray-500 dark:text-gray-400">No milestone data.</div>
            )}
          </div>
        </div>
      </div>

      {/* Active Goals */}
      <div className="rounded-[22px] border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-slate-900">
        <div className="text-base font-black tracking-tight text-gray-900 dark:text-gray-100">Active Goals</div>
        <p className="mt-0.5 text-[13px] text-gray-500 dark:text-gray-400">Goals this student is currently working on.</p>
        {activeGoals.length > 0 ? (
          <div className="mt-3 space-y-2">
            {activeGoals.map((g) => (
              <div key={g.id} className="flex items-center justify-between rounded-[16px] border border-gray-200 bg-gray-50/70 px-3.5 py-2.5 dark:border-gray-800 dark:bg-slate-800/80">
                <div>
                  <div className="text-[13px] font-extrabold text-gray-900 dark:text-gray-100">{g.lessonTitle || "—"}</div>
                  {g.categoryName && <div className="text-xs text-gray-500 dark:text-gray-400">{g.categoryName}</div>}
                </div>
                <span className={`rounded-full px-2.5 py-1 text-[11px] font-extrabold ${STATUS_BADGE[g.status] || "bg-gray-100 text-gray-700"}`}>
                  {g.status?.replace(/_/g, " ")}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-3 rounded-[16px] border border-gray-200 bg-gray-50/70 p-3 text-sm text-gray-500 dark:border-gray-800 dark:bg-slate-800/80 dark:text-gray-400">No active goals.</div>
        )}
      </div>

      {/* Accomplishments + Citizenship Log */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <div className="rounded-[22px] border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-slate-900">
          <div className="text-base font-black tracking-tight text-gray-900 dark:text-gray-100">Accomplishments</div>
          <p className="mt-0.5 text-[13px] text-gray-500 dark:text-gray-400">From logged "Accomplishment" activity.</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <DateField label="Start Date" value={accomplishmentFrom} onChange={setAccomplishmentFrom} />
            <DateField label="End Date" value={accomplishmentTo} onChange={setAccomplishmentTo} />
          </div>
          {filteredAccomplishments.length > 0 ? (
            <div className="mt-3 space-y-2">
              {filteredAccomplishments.map((a) => (
                <div key={a.id} className="rounded-[16px] border border-emerald-100 bg-emerald-50 px-3.5 py-2.5 dark:border-emerald-900/60 dark:bg-emerald-950/30">
                  <div className="text-xs text-emerald-600 dark:text-emerald-300">{fmtDate(a.createdAt)}</div>
                  <div className="mt-0.5 text-[13px] text-emerald-900 dark:text-emerald-100">{a.notes || a.details?.text || "Accomplishment recorded."}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-3 rounded-[16px] border border-gray-200 bg-gray-50/70 p-3 text-sm text-gray-500 dark:border-gray-800 dark:bg-slate-800/80 dark:text-gray-400">No accomplishments found.</div>
          )}
        </div>

        <div className="rounded-[22px] border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-slate-900">
          <div className="text-base font-black tracking-tight text-gray-900 dark:text-gray-100">Citizenship Log</div>
          <p className="mt-0.5 text-[13px] text-gray-500 dark:text-gray-400">From logged "Citizenship" activity.</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <DateField label="Start Date" value={citizenshipLogFrom} onChange={setCitizenshipLogFrom} />
            <DateField label="End Date" value={citizenshipLogTo} onChange={setCitizenshipLogTo} />
          </div>
          {filteredCitizenshipLogs.length > 0 ? (
            <div className="mt-3 space-y-2">
              {filteredCitizenshipLogs.map((a) => (
                <div key={a.id} className="rounded-[16px] border border-gray-200 bg-gray-50/70 px-3.5 py-2.5 dark:border-gray-800 dark:bg-slate-800/80">
                  <div className="text-xs text-gray-500 dark:text-gray-400">{fmtDate(a.createdAt)}</div>
                  <div className="mt-0.5 text-[13px] text-gray-900 dark:text-gray-100">{a.notes || a.details?.text || "Citizenship log entry."}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-3 rounded-[16px] border border-gray-200 bg-gray-50/70 p-3 text-sm text-gray-500 dark:border-gray-800 dark:bg-slate-800/80 dark:text-gray-400">No citizenship log entries found.</div>
          )}
        </div>
      </div>

      {/* Individual Progress Plans */}
      <div className="rounded-[22px] border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-slate-900">
        <div className="text-base font-black tracking-tight text-gray-900 dark:text-gray-100">Individual Progress Plan</div>
        <p className="mt-0.5 text-[13px] text-gray-600 dark:text-gray-300">Intervention plans on file for this child.</p>
        {behaviorPlans.length > 0 ? (
          <div className="mt-3 space-y-3">
            {behaviorPlans.map((plan) => (
              <PlanSummaryCard
                key={plan.id}
                plan={plan}
                onApprove={() => approvePlan(plan.id)}
                approving={approvingPlanId === plan.id}
              />
            ))}
          </div>
        ) : (
          <div className="mt-3 rounded-[16px] border border-gray-200 bg-gray-50/70 p-3 text-sm text-gray-600 dark:border-gray-800 dark:bg-slate-800/80 dark:text-gray-300">
            No Individual Progress Plans on file.
          </div>
        )}
      </div>

      {/* Student Activity Log */}
      <div className="rounded-[22px] border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-slate-900">
        <div className="text-base font-black tracking-tight text-gray-900 dark:text-gray-100">Student Activity Log</div>
        <p className="mt-0.5 text-[13px] text-gray-500 dark:text-gray-400">Daily activity log.</p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <DateField label="Start Date" value={activityLogFrom} onChange={setActivityLogFrom} />
          <DateField label="End Date" value={activityLogTo} onChange={setActivityLogTo} />
        </div>
        {filteredActivityLogs.length > 0 ? (
          <div className="mt-3 space-y-2">
            {filteredActivityLogs.slice(0, 50).map((a) => (
              <ActivityLogEntry key={a.id} activity={a} />
            ))}
            {filteredActivityLogs.length > 50 && (
              <div className="py-1 text-center text-xs text-gray-500 dark:text-gray-400">
                Showing 50 of {filteredActivityLogs.length} entries.
              </div>
            )}
          </div>
        ) : (
          <div className="mt-3 rounded-[16px] border border-gray-200 bg-gray-50/70 p-3 text-sm text-gray-500 dark:border-gray-800 dark:bg-slate-800/80 dark:text-gray-400">No activity logs found.</div>
        )}
      </div>
    </div>
  );
}

function Kpi({ label, value, tone = "gray" }) {
  const tones = {
    sky: "border-sky-200 bg-sky-50/80 text-sky-900 dark:border-sky-900/70 dark:bg-sky-950/40 dark:text-sky-100",
    emerald: "border-emerald-200 bg-emerald-50/80 text-emerald-900 dark:border-emerald-900/70 dark:bg-emerald-950/40 dark:text-emerald-100",
    rose: "border-rose-200 bg-rose-50/80 text-rose-900 dark:border-rose-900/70 dark:bg-rose-950/40 dark:text-rose-100",
    gray: "border-gray-200 bg-gray-50/90 text-gray-900 dark:border-gray-800 dark:bg-slate-900 dark:text-gray-100",
  };
  return (
    <div className={`rounded-[18px] border px-3.5 py-3 shadow-sm ${tones[tone] || tones.gray}`}>
      <div className="text-[clamp(1.05rem,1.8vw,1.4rem)] font-black leading-tight tracking-tight">{String(value)}</div>
      <div className="mt-1 text-[11px] font-extrabold uppercase tracking-[0.16em] opacity-70">{label}</div>
    </div>
  );
}

function DateField({ label, value, onChange }) {
  return (
    <label className="block">
      <div className="mb-1 text-[11px] font-extrabold uppercase tracking-[0.16em] text-gray-500 dark:text-gray-400">{label}</div>
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-slate-800 dark:text-gray-100"
      />
    </label>
  );
}

function SelectField({ label, value, onChange, children }) {
  return (
    <label className="block">
      <div className="mb-1 text-[11px] font-extrabold uppercase tracking-[0.16em] text-gray-500 dark:text-gray-400">{label}</div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-slate-800 dark:text-gray-100"
      >
        {children}
      </select>
    </label>
  );
}

function PlanSummaryCard({ plan, onApprove, approving }) {
  const [expanded, setExpanded] = useState(false);
  const isClosed = plan.status === "CLOSED";

  return (
    <div className={`rounded-[18px] border p-3.5 ${isClosed ? "border-gray-200 bg-gray-50/70 dark:border-gray-800 dark:bg-slate-800/80" : "border-sky-100 bg-sky-50/80 dark:border-sky-900/60 dark:bg-sky-950/30"}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-[13px] font-extrabold text-gray-900 dark:text-gray-100">{plan.title}</div>
            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_BADGE[plan.status] || "bg-gray-100 text-gray-700"}`}>
              {isClosed ? "Closed" : plan.status}
            </span>
            {plan.parentApproved && (
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-200">
                Parent Approved
              </span>
            )}
          </div>
          <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Plan Start: {fmtDate(plan.startDate)}
            {plan.closedAt && ` • Closed: ${fmtDate(plan.closedAt)}`}
          </div>
          {plan.parentApproved && plan.parentSignatureName && (
            <div className="mt-0.5 text-xs text-emerald-700 dark:text-emerald-300">
              Approved by: {plan.parentSignatureName} on {fmtDate(plan.parentApprovedAt)}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="shrink-0 text-xs font-semibold text-sky-600 hover:text-sky-800 dark:text-sky-300 dark:hover:text-sky-200"
        >
          {expanded ? "Collapse" : "View Details"}
        </button>
      </div>

      {!plan.parentApproved && onApprove ? (
        <div className="mt-3 rounded-[16px] border border-amber-200 bg-amber-50 p-3.5 dark:border-amber-800 dark:bg-amber-900/10">
          <p className="text-[13px] leading-5 text-amber-800 dark:text-amber-200">
            By approving, you acknowledge and consent to this Individual Progress Plan for your child.
          </p>
          <button
            type="button"
            disabled={approving}
            onClick={onApprove}
            className="mt-2.5 inline-flex items-center rounded-full bg-amber-600 px-3.5 py-1.5 text-[12px] font-bold text-white shadow-sm transition hover:bg-amber-700 disabled:opacity-60"
          >
            {approving ? "Approving..." : "Approve Plan"}
          </button>
        </div>
      ) : null}

      {expanded && (
        <div className="mt-3 space-y-3 border-t border-gray-200 pt-3 dark:border-gray-700">
          {plan.description && <PlanDetail label="Description" value={plan.description} />}
          {plan.parentTactics && <PlanDetail label="Your Role (Parent Tactics)" value={plan.parentTactics} />}
          {plan.teacherTactics && <PlanDetail label="Teacher Tactics" value={plan.teacherTactics} />}
          {plan.coachTactics && <PlanDetail label="Coach Tactics" value={plan.coachTactics} />}
          {plan.disciplinaryAction && <PlanDetail label="Disciplinary Action" value={plan.disciplinaryAction} />}
          {(plan.goals || []).length > 0 && (
            <div>
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Goals</div>
              <div className="space-y-2">
                {plan.goals.map((goal) => (
                  <div key={goal.id} className="rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-slate-900">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-xs font-semibold text-gray-900 dark:text-gray-100">{goal.title}</div>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_BADGE[goal.status] || "bg-gray-100 text-gray-700"}`}>
                        {GOAL_STATUS_LABEL[goal.status] || goal.status}
                      </span>
                    </div>
                    {goal.strategies?.length > 0 && (
                      <ul className="mt-1 ml-3 list-disc text-xs text-gray-600 dark:text-gray-300">
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

function PlanDetail({ label, value }) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</div>
      <p className="mt-1 text-sm text-gray-700 dark:text-gray-200">{value}</p>
    </div>
  );
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
    <div className="flex gap-3 rounded-lg border border-gray-200 bg-gray-50/70 px-3 py-2.5 dark:border-gray-800 dark:bg-slate-800/80">
      <div className="mt-0.5 shrink-0">
        <ActivityIcon type={a.type} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">{typeLabel}</span>
          <span className="text-xs text-gray-500 dark:text-gray-400">{time}</span>
        </div>
        {detailText && <div className="mt-0.5 text-xs text-gray-600 dark:text-gray-300">{detailText}</div>}
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
