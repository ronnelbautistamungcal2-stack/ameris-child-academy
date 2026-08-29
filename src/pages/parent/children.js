import ParentLayout from "@/components/parent/ParentLayout";
import {
  ParentEmpty,
  ParentSection,
  ParentSurface,
} from "@/components/parent/ParentUI";
import StudentPerformanceReportPanel from "@/components/reports/StudentPerformanceReportPanel";
import Skeleton from "@/components/ui/Skeleton";
import { apiJson } from "@/lib/api";
import { formatAge } from "@/lib/ageUtils";
import { useRouter } from "next/router";
import { useCallback, useEffect, useMemo, useState } from "react";

export default function ParentChildren() {
  const router = useRouter();
  const routeChildId =
    typeof router.query.childId === "string" ? router.query.childId : "";
  const [children, setChildren] = useState([]);
  const [selectedChildId, setSelectedChildId] = useState("");
  const [activities, setActivities] = useState([]);
  const [progressRows, setProgressRows] = useState([]);
  const [behaviorPlans, setBehaviorPlans] = useState([]);
  const [childrenLoading, setChildrenLoading] = useState(true);
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [error, setError] = useState("");
  const [lastSyncAt, setLastSyncAt] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function loadChildren() {
      setChildrenLoading(true);
      setError("");
      try {
        const kids = await apiJson("/api/v1/children");
        if (cancelled) return;
        const sorted = (Array.isArray(kids) ? kids : []).sort((a, b) =>
          (a.firstName || "").localeCompare(b.firstName || ""),
        );
        setChildren(sorted);
      } catch (e) {
        if (!cancelled) setError(e.message || "Failed to load children");
      } finally {
        if (!cancelled) setChildrenLoading(false);
      }
    }

    loadChildren();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!children.length) {
      setSelectedChildId("");
      return;
    }
    if (routeChildId && children.some((child) => child.id === routeChildId)) {
      setSelectedChildId(routeChildId);
      return;
    }
    setSelectedChildId((current) => {
      if (current && children.some((child) => child.id === current)) return current;
      return children[0]?.id || "";
    });
  }, [children, routeChildId]);

  useEffect(() => {
    if (!router.isReady) return;
    if (childrenLoading) return;
    const currentChild =
      typeof router.query.childId === "string" ? router.query.childId : "";
    if (currentChild === selectedChildId) return;

    const nextQuery = { ...router.query };
    if (selectedChildId) nextQuery.childId = selectedChildId;
    else delete nextQuery.childId;

    router.replace({ pathname: router.pathname, query: nextQuery }, undefined, {
      shallow: true,
      scroll: false,
    });
  }, [router, selectedChildId, childrenLoading]);

  const loadChildRecords = useCallback(async (targetChildId) => {
    if (!targetChildId) return;
    setRecordsLoading(true);
    setError("");
    setActivities([]);
    setProgressRows([]);
    setBehaviorPlans([]);
    try {
      const [activityRes, progressRes, planRes] = await Promise.all([
        apiJson(`/api/v1/activities?childId=${encodeURIComponent(targetChildId)}`),
        apiJson(`/api/v1/progress?childId=${encodeURIComponent(targetChildId)}`),
        apiJson(`/api/v1/behavior-plans?childId=${encodeURIComponent(targetChildId)}`),
      ]);
      setActivities(Array.isArray(activityRes) ? activityRes : []);
      setProgressRows(Array.isArray(progressRes) ? progressRes : []);
      setBehaviorPlans(Array.isArray(planRes) ? planRes : []);
      setLastSyncAt(new Date());
    } catch (e) {
      setError(e.message || "Failed to load child records");
      setActivities([]);
      setProgressRows([]);
      setBehaviorPlans([]);
    } finally {
      setRecordsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedChildId) loadChildRecords(selectedChildId);
  }, [selectedChildId, loadChildRecords]);

  const selectedChild = useMemo(
    () => children.find((ch) => ch.id === selectedChildId) || null,
    [children, selectedChildId],
  );
  const activityFeed = useMemo(
    () =>
      [...activities]
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, 10),
    [activities],
  );
  const latestActivity = activityFeed[0] || null;
  const progressStats = useMemo(() => {
    const total = progressRows.length;
    const completed = progressRows.filter((row) =>
      ["COMPLETED", "PASSED"].includes(row.status),
    ).length;
    const needsSupport = progressRows.filter((row) => row.status === "FAILED").length;

    return {
      total,
      completed,
      needsSupport,
      open: Math.max(total - completed, 0),
      completionRate: total ? Math.round((completed / total) * 100) : 0,
    };
  }, [progressRows]);
  const pendingPlanApprovals = useMemo(
    () => behaviorPlans.filter((plan) => !plan.parentApproved),
    [behaviorPlans],
  );

  const refreshChildRecords = useCallback(() => {
    if (selectedChildId) loadChildRecords(selectedChildId);
  }, [selectedChildId, loadChildRecords]);

  return (
    <ParentLayout title="My Children">
      <div className="space-y-3">
        {error ? (
          <ParentSurface className="border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
            {error}
          </ParentSurface>
        ) : null}

        <ParentSection
          title="Select child"
          description="Change child without leaving the current page."
          className="overflow-hidden border-sky-100 bg-gradient-to-r from-white via-sky-50/60 to-white shadow-[0_18px_60px_-50px_rgba(14,116,144,0.55)] dark:border-sky-900/60 dark:bg-gradient-to-r dark:from-slate-950 dark:via-sky-950/40 dark:to-slate-950 dark:shadow-[0_24px_80px_-52px_rgba(14,116,144,0.75)]"
          action={
            <div className="rounded-full border border-sky-200 bg-white px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-[0.16em] text-sky-700 shadow-sm dark:border-sky-800 dark:bg-slate-900 dark:text-sky-200">
              {lastSyncAt ? `Synced ${formatRelativeDateTime(lastSyncAt)}` : "Waiting for sync"}
            </div>
          }
        >
          {childrenLoading ? (
            <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2 xl:grid-cols-4">
              {Array.from({ length: 4 }, (_, i) => (
                <Skeleton key={i} variant="card" className="h-24 rounded-[20px]" />
              ))}
            </div>
          ) : children.length === 0 ? (
            <ParentEmpty
              title="No children found"
              description="No children are linked to your account yet. Please contact your center administrator."
            />
          ) : (
            <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2 xl:grid-cols-4">
              {children.map((child) => (
                <ChildSwitcherCard
                  key={child.id}
                  child={child}
                  active={child.id === selectedChildId}
                  onSelect={() => setSelectedChildId(child.id)}
                />
              ))}
            </div>
          )}
        </ParentSection>

        {selectedChild ? (
          <div className="space-y-3">
            <ParentSurface className="overflow-hidden border-transparent bg-gradient-to-br from-sky-600 via-cyan-500 to-blue-500 text-white shadow-[0_24px_80px_-40px_rgba(14,116,144,0.7)] dark:bg-gradient-to-br dark:from-sky-950 dark:via-cyan-900 dark:to-blue-950">
              <div className="space-y-3">
                <div className="min-w-0">
                  <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.18em] text-white/90">
                    Child snapshot
                  </div>
                  <div className="mt-3 flex items-start gap-3">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[18px] bg-white/15 text-sm font-black text-white ring-1 ring-white/15">
                      {initials(selectedChild.firstName, selectedChild.lastName)}
                    </div>
                    <div className="min-w-0">
                      <h2 className="truncate text-xl font-black tracking-tight text-white">
                        {selectedChild.firstName} {selectedChild.lastName || ""}
                      </h2>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <ChildMetaPill>{formatChildAge(selectedChild.birthDate) || "Age unavailable"}</ChildMetaPill>
                        <ChildMetaPill>
                          {latestActivity
                            ? `Latest ${formatRelativeDateTime(latestActivity.createdAt)}`
                          : "No recent activity yet"}
                        </ChildMetaPill>
                      </div>
                      <div className="mt-2 max-w-2xl text-[13px] leading-5 text-white/78">
                        {lastSyncAt
                          ? `Report was last synced at ${formatTime(lastSyncAt)}.`
                          : "Report data will appear below once it loads."}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <HeroMetric label="Completion" value={`${progressStats.completionRate}%`} hint="Overall progress" />
                  <HeroMetric label="Open goals" value={progressStats.open} hint="Still active" />
                  <HeroMetric label="Support" value={progressStats.needsSupport} hint="Need attention" />
                  <HeroMetric
                    label="Progress plan"
                    value={pendingPlanApprovals.length || behaviorPlans.length}
                    hint={pendingPlanApprovals.length ? "Needs your approval" : behaviorPlans.length ? "On file" : "None yet"}
                  />
                </div>
              </div>
            </ParentSurface>

            <ParentSection
              title="Student Performance Report"
              description="Goals, grades, milestones, accomplishments, and activity for your child."
            >
              <StudentPerformanceReportPanel
                childId={selectedChildId}
                onPlanApproved={refreshChildRecords}
              />
            </ParentSection>
          </div>
        ) : null}
      </div>
    </ParentLayout>
  );
}

function ChildSwitcherCard({ child, active, onSelect }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={[
        "group relative min-h-[104px] overflow-hidden rounded-[20px] border p-3.5 text-left transition-all duration-200",
        active
          ? "border-sky-300 bg-gradient-to-br from-sky-50 to-white shadow-sm ring-2 ring-sky-100 dark:border-sky-800 dark:bg-gradient-to-br dark:from-sky-950/50 dark:to-slate-950 dark:ring-sky-900/60"
          : "border-gray-200 bg-white hover:-translate-y-0.5 hover:border-sky-200 hover:bg-sky-50/60 hover:shadow-sm dark:border-gray-800 dark:bg-slate-900 dark:hover:border-sky-800 dark:hover:bg-slate-900",
      ].join(" ")}
    >
      <div className="pointer-events-none absolute right-0 top-0 h-16 w-16 rounded-full bg-sky-100/70 blur-3xl dark:bg-sky-950/40" />
      <div className="relative flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[16px] bg-sky-600 text-sm font-black text-white shadow-sm">
          {initials(child.firstName, child.lastName)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <div className="truncate text-[13px] font-extrabold text-gray-900 dark:text-gray-100">
              {child.firstName} {child.lastName || ""}
            </div>
            {Number.isFinite(child.todayCitizenshipGrade) ? (
              <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-200">
                Citizenship {child.todayCitizenshipGrade}/10
              </span>
            ) : null}
          </div>
          <div className="mt-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-500 dark:text-gray-400">
            {formatChildAge(child.birthDate) || "Age unavailable"}
          </div>
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            <span className="rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-bold text-sky-700 ring-1 ring-sky-100 dark:bg-slate-950 dark:text-sky-200 dark:ring-sky-900/70">
              {active ? "Selected" : "Open"}
            </span>
          </div>
        </div>
      </div>
    </button>
  );
}

function ChildMetaPill({ children }) {
  return (
    <span className="rounded-full border border-white/15 bg-white/10 px-2.5 py-0.5 text-[11px] font-semibold text-white/90">
      {children}
    </span>
  );
}

function HeroMetric({ label, value, hint }) {
  return (
    <div className="flex min-w-[160px] flex-1 items-center justify-between gap-3 rounded-[18px] border border-white/15 bg-white/10 px-3 py-2.5 ring-1 ring-white/5">
      <div className="min-w-0">
        <div className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-white/70">
          {label}
        </div>
        <div className="mt-1 text-[11px] leading-4 text-white/70">{hint}</div>
      </div>
      <div className="shrink-0 text-[clamp(1.05rem,1.8vw,1.45rem)] font-black leading-tight tracking-tight text-white">
        {value}
      </div>
    </div>
  );
}

function formatChildAge(birthDate) {
  const precise = formatAge(birthDate);
  return precise ? `${precise} old` : "";
}

function formatDateTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString();
}

function formatTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function formatRelativeDateTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startTarget = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round((startToday.getTime() - startTarget.getTime()) / 86400000);
  if (diffDays === 0) return `today at ${formatTime(date)}`;
  if (diffDays === 1) return `yesterday at ${formatTime(date)}`;
  return formatDateTime(date);
}

function initials(firstName, lastName) {
  const first = (firstName || "").trim().slice(0, 1).toUpperCase();
  const last = (lastName || "").trim().slice(0, 1).toUpperCase();
  return `${first}${last}` || "C";
}
