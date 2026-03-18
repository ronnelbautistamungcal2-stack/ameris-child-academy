import ParentLayout from "@/components/parent/ParentLayout";
import {
  ParentButton,
  ParentEmpty,
  ParentPageHeader,
  ParentQuickAction,
  ParentSection,
  ParentSurface,
} from "@/components/parent/ParentUI";
import CatchupPlansPanel from "@/components/reports/CatchupPlansPanel";
import MilestoneCalendarPanel from "@/components/reports/MilestoneCalendarPanel";
import Skeleton, { SkeletonCard } from "@/components/ui/Skeleton";
import { apiJson } from "@/lib/api";
import { formatAge } from "@/lib/ageUtils";
import { useRouter } from "next/router";
import { useCallback, useEffect, useMemo, useState } from "react";

const DEFAULT_TAB = "DAILY_REPORT";

const TAB_LIST = [
  {
    key: "DAILY_REPORT",
    label: "Daily Report",
    description: "Latest teacher logs, care notes, meals, and classroom activity.",
  },
  {
    key: "PROGRESS_REPORT",
    label: "Progress Report",
    description: "A parent-friendly overview of development progress and active goals.",
  },
  {
    key: "STEPS",
    label: "Steps of Progression",
    description: "Detailed lesson-level progress and the next steps being worked on.",
  },
  {
    key: "CATCHUP",
    label: "Catch-up Plans",
    description: "Recommended support plans and reinforcement ideas for growth areas.",
  },
  {
    key: "MILESTONE",
    label: "Milestone Calendar",
    description: "A milestone-style timeline of recent development records.",
  },
];

export default function ParentChildren() {
  const router = useRouter();
  const routeChildId =
    typeof router.query.childId === "string" ? router.query.childId : "";
  const routeTab =
    typeof router.query.tab === "string"
      ? router.query.tab.toUpperCase()
      : DEFAULT_TAB;
  const [children, setChildren] = useState([]);
  const [selectedChildId, setSelectedChildId] = useState("");
  const [activities, setActivities] = useState([]);
  const [progressRows, setProgressRows] = useState([]);
  const [childrenLoading, setChildrenLoading] = useState(true);
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState(
    TAB_LIST.some((tab) => tab.key === routeTab) ? routeTab : DEFAULT_TAB,
  );
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
    if (!TAB_LIST.some((tab) => tab.key === routeTab)) return;
    setActiveTab(routeTab);
  }, [routeTab]);

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
    const currentChild =
      typeof router.query.childId === "string" ? router.query.childId : "";
    const currentTab =
      typeof router.query.tab === "string"
        ? router.query.tab.toUpperCase()
        : DEFAULT_TAB;
    if (currentChild === selectedChildId && currentTab === activeTab) return;

    const nextQuery = { ...router.query };
    if (selectedChildId) nextQuery.childId = selectedChildId;
    else delete nextQuery.childId;

    if (activeTab !== DEFAULT_TAB) nextQuery.tab = activeTab.toLowerCase();
    else delete nextQuery.tab;

    router.replace({ pathname: router.pathname, query: nextQuery }, undefined, {
      shallow: true,
      scroll: false,
    });
  }, [activeTab, router, selectedChildId]);

  const loadChildRecords = useCallback(async (targetChildId) => {
    if (!targetChildId) return;
    setRecordsLoading(true);
    setError("");
    setActivities([]);
    setProgressRows([]);
    try {
      const [activityRes, progressRes] = await Promise.all([
        apiJson(`/api/v1/activities?childId=${encodeURIComponent(targetChildId)}`),
        apiJson(`/api/v1/progress?childId=${encodeURIComponent(targetChildId)}`),
      ]);
      setActivities(Array.isArray(activityRes) ? activityRes : []);
      setProgressRows(Array.isArray(progressRes) ? progressRes : []);
      setLastSyncAt(new Date());
    } catch (e) {
      setError(e.message || "Failed to load child records");
      setActivities([]);
      setProgressRows([]);
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
        .slice(0, 24),
    [activities],
  );
  const latestActivity = activityFeed[0] || null;
  const mealsNutrition = useMemo(
    () =>
      activityFeed
        .filter((a) => ["MEAL", "SNACK", "BOTTLE"].includes(a.type))
        .slice(0, 5),
    [activityFeed],
  );
  const diaperPotty = useMemo(
    () => activityFeed.filter((a) => a.type === "DIAPER_CHANGE").slice(0, 5),
    [activityFeed],
  );
  const naps = useMemo(
    () => activityFeed.filter((a) => a.type === "NAP").slice(0, 4),
    [activityFeed],
  );
  const mediaCount = useMemo(
    () =>
      activityFeed.reduce(
        (sum, activity) => sum + extractMediaUrls(activity).length,
        0,
      ),
    [activityFeed],
  );
  const progressStats = useMemo(() => {
    const total = progressRows.length;
    const completed = progressRows.filter((row) =>
      ["COMPLETED", "PASSED"].includes(row.status),
    ).length;
    const inProgress = progressRows.filter(
      (row) => row.status === "IN_PROGRESS",
    ).length;
    const needsSupport = progressRows.filter((row) => row.status === "FAILED").length;

    return {
      total,
      completed,
      inProgress,
      needsSupport,
      open: Math.max(total - completed, 0),
      completionRate: total ? Math.round((completed / total) * 100) : 0,
    };
  }, [progressRows]);
  const domainStats = useMemo(() => {
    const summary = new Map();

    for (const row of progressRows) {
      const domain = inferDomain(row);
      const current = summary.get(domain) || { label: domain, total: 0, completed: 0 };
      current.total += 1;
      if (["COMPLETED", "PASSED"].includes(row.status)) current.completed += 1;
      summary.set(domain, current);
    }

    return [...summary.values()]
      .map((item) => ({
        ...item,
        completionRate: item.total
          ? Math.round((item.completed / item.total) * 100)
          : 0,
      }))
      .sort((a, b) => b.total - a.total);
  }, [progressRows]);
  const activeGoals = useMemo(
    () =>
      progressRows
        .filter((row) => !["COMPLETED", "PASSED"].includes(row.status))
        .sort(
          (a, b) =>
            new Date(b.updatedAt || b.createdAt) -
            new Date(a.updatedAt || a.createdAt),
        )
        .slice(0, 4),
    [progressRows],
  );
  const profileFacts = useMemo(() => buildProfileFacts(selectedChild), [selectedChild]);
  const lastTeacherNote = useMemo(
    () =>
      activityFeed.find((activity) => activity.notes && String(activity.notes).trim()) ||
      null,
    [activityFeed],
  );
  const headerStats = [
    {
      label: "Children",
      value: children.length,
      hint: "Linked to this account",
      tone: "sky",
    },
    {
      label: "Updates",
      value: activityFeed.length,
      hint: latestActivity
        ? `Latest ${formatRelativeDateTime(latestActivity.createdAt)}`
        : "No recent activity",
      tone: activityFeed.length ? "emerald" : "gray",
    },
    {
      label: "Progress",
      value: `${progressStats.completionRate}%`,
      hint: progressStats.total
        ? `${progressStats.completed} of ${progressStats.total} goals complete`
        : "No progress records",
      tone: progressStats.completionRate >= 60 ? "emerald" : "amber",
    },
    {
      label: "Media",
      value: mediaCount,
      hint: mediaCount ? "Shared this cycle" : "No media yet",
      tone: mediaCount ? "amber" : "gray",
    },
  ];

  return (
    <ParentLayout title="My Children">
      <div className="space-y-4">
        <ParentPageHeader
          eyebrow="Family hub"
          title={
            selectedChild
              ? `${selectedChild.firstName}'s day, progress, and care updates`
              : "My children"
          }
          description="Move from a quick family overview into daily reports, development progress, routines, and next actions without bouncing between separate screens."
          accent="sky"
          layout="split"
          stats={headerStats}
          actions={
            <>
              <ParentButton
                href={
                  selectedChildId
                    ? `/parent/messages?childId=${encodeURIComponent(selectedChildId)}`
                    : "/parent/messages"
                }
                variant="secondary"
              >
                Message center
              </ParentButton>
              <ParentButton
                variant="primary"
                onClick={() => selectedChildId && loadChildRecords(selectedChildId)}
                disabled={!selectedChildId || recordsLoading}
              >
                {recordsLoading ? "Refreshing..." : "Refresh reports"}
              </ParentButton>
            </>
          }
        />

        {error ? (
          <ParentSurface className="border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
            {error}
          </ParentSurface>
        ) : null}

        <ParentSection
          title="Switch child"
          description="Each child keeps a separate report stream, so you can change context without losing your place."
          className="bg-gradient-to-r from-white via-sky-50/50 to-white"
          action={
            <div className="rounded-full border border-sky-200 bg-white px-3 py-1 text-xs font-extrabold uppercase tracking-[0.16em] text-sky-700">
              {lastSyncAt ? `Synced ${formatRelativeDateTime(lastSyncAt)}` : "Waiting for sync"}
            </div>
          }
        >
          {childrenLoading ? (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
              {Array.from({ length: 4 }, (_, i) => (
                <Skeleton key={i} variant="card" className="h-28 rounded-[24px]" />
              ))}
            </div>
          ) : children.length === 0 ? (
            <ParentEmpty
              title="No children found"
              description="No children are linked to your account yet. Please contact your center administrator."
            />
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
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
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.45fr)_360px]">
            <div className="space-y-4">
              <ParentSurface className="overflow-hidden border-transparent bg-gradient-to-br from-sky-600 via-cyan-500 to-blue-500 text-white shadow-[0_24px_80px_-40px_rgba(14,116,144,0.7)]">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.2em] text-white/90">
                      Child snapshot
                    </div>
                    <div className="mt-4 flex items-start gap-4">
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/15 text-base font-black text-white ring-1 ring-white/15">
                        {initials(selectedChild.firstName, selectedChild.lastName)}
                      </div>
                      <div className="min-w-0">
                        <h2 className="truncate text-2xl font-black tracking-tight text-white">
                          {selectedChild.firstName} {selectedChild.lastName || ""}
                        </h2>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <ChildMetaPill>{formatChildAge(selectedChild.birthDate) || "Age unavailable"}</ChildMetaPill>
                          <ChildMetaPill>
                            {latestActivity
                              ? `${formatActivityType(latestActivity.type)} ${formatRelativeDateTime(latestActivity.createdAt)}`
                              : "No recent activity yet"}
                          </ChildMetaPill>
                          <ChildMetaPill>
                            {lastSyncAt ? `Synced ${formatTime(lastSyncAt)}` : "Waiting for sync"}
                          </ChildMetaPill>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:min-w-[360px]">
                    <HeroMetric label="Completed" value={progressStats.completed} hint="Finished goals" />
                    <HeroMetric label="Open" value={progressStats.open} hint="Still active" />
                    <HeroMetric label="Support" value={progressStats.needsSupport} hint="Need attention" />
                    <HeroMetric label="Media" value={mediaCount} hint="Shared items" />
                  </div>
                </div>
              </ParentSurface>

              <ParentSection
                title="Reports"
                description={
                  TAB_LIST.find((tab) => tab.key === activeTab)?.description ||
                  TAB_LIST[0].description
                }
                className="bg-gradient-to-br from-white via-white to-sky-50/30"
              >
                <div role="tablist" aria-label={`${selectedChild.firstName}'s reports`} className="flex flex-wrap gap-2">
                  {TAB_LIST.map((tab) => (
                    <button
                      key={tab.key}
                      id={`tab-${tab.key.toLowerCase()}`}
                      role="tab"
                      type="button"
                      aria-selected={activeTab === tab.key}
                      aria-controls={`panel-${tab.key.toLowerCase()}`}
                      onClick={() => setActiveTab(tab.key)}
                      className={[
                        "rounded-2xl border px-4 py-2.5 text-sm font-bold transition-all duration-150",
                        activeTab === tab.key
                          ? "border-sky-300 bg-sky-50 text-sky-900 shadow-sm ring-2 ring-sky-100"
                          : "border-gray-200 bg-white text-gray-700 hover:border-sky-200 hover:bg-sky-50/60",
                      ].join(" ")}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                <div
                  role="tabpanel"
                  id={`panel-${activeTab.toLowerCase()}`}
                  aria-labelledby={`tab-${activeTab.toLowerCase()}`}
                  className="mt-4"
                >
                  {activeTab === "DAILY_REPORT" ? (
                    <DailyReportPanel activities={activityFeed} loading={recordsLoading} />
                  ) : null}
                  {activeTab === "PROGRESS_REPORT" ? (
                    <ProgressPanel
                      progressRows={progressRows}
                      loading={recordsLoading}
                      progressStats={progressStats}
                      domainStats={domainStats}
                      activeGoals={activeGoals}
                    />
                  ) : null}
                  {activeTab === "STEPS" ? (
                    <StepsPanel progressRows={progressRows} loading={recordsLoading} />
                  ) : null}
                  {activeTab === "CATCHUP" ? (
                    <CatchupPlansPanel
                      progressRows={progressRows}
                      childName={selectedChild.firstName}
                      birthDate={selectedChild.birthDate}
                    />
                  ) : null}
                  {activeTab === "MILESTONE" ? (
                    <MilestoneCalendarPanel
                      activities={activityFeed}
                      progressRows={progressRows}
                      childName={selectedChild.firstName}
                      noteLabel="Teacher note"
                    />
                  ) : null}
                </div>
              </ParentSection>
            </div>

            <div className="space-y-4">
              <ParentSection
                title="Care highlights"
                description="A fast glance at the routines and updates parents check most often."
              >
                <div className="grid grid-cols-2 gap-3">
                  <SummaryTile label="Meals" value={mealsNutrition.length} hint={mealsNutrition[0] ? formatTime(mealsNutrition[0].createdAt) : "No recent meal"} tone="amber" />
                  <SummaryTile label="Potty" value={diaperPotty.length} hint={diaperPotty[0] ? formatTime(diaperPotty[0].createdAt) : "No recent care log"} tone="sky" />
                  <SummaryTile label="Rest" value={naps.length} hint={naps[0] ? formatTime(naps[0].createdAt) : "No nap logged"} tone="emerald" />
                  <SummaryTile label="Media" value={mediaCount} hint={mediaCount ? "Shared this cycle" : "No attachments"} tone="gray" />
                </div>
              </ParentSection>

              <ParentSection
                title="Profile and care notes"
                description="Important child details stay visible next to the live reports."
              >
                {profileFacts.length ? (
                  <div className="space-y-3">
                    {profileFacts.map((fact) => (
                      <div key={fact.label} className="rounded-2xl border border-gray-200 bg-gray-50/70 px-4 py-3">
                        <div className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-gray-500">
                          {fact.label}
                        </div>
                        <div className="mt-1 text-sm text-gray-700">{fact.value}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <ParentEmpty
                    title="No profile notes published"
                    description="If allergies, feeding plans, or emergency details are added later, they will appear here."
                  />
                )}
              </ParentSection>

              <ParentSection
                title="Latest teacher note"
                description="The newest written observation is always easy to find."
              >
                {lastTeacherNote ? (
                  <div className="rounded-[24px] border border-sky-100 bg-gradient-to-br from-sky-50 to-white p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-extrabold text-gray-900">
                        {activityTitle(lastTeacherNote)}
                      </div>
                      <div className="rounded-full bg-white px-2.5 py-1 text-[11px] font-bold text-sky-700 ring-1 ring-sky-100">
                        {formatRelativeDateTime(lastTeacherNote.createdAt)}
                      </div>
                    </div>
                    <div className="mt-3 text-sm leading-6 text-gray-700">
                      {String(lastTeacherNote.notes).trim()}
                    </div>
                  </div>
                ) : (
                  <ParentEmpty
                    title="No written note yet"
                    description="When a teacher adds a written observation or summary, it will appear here."
                  />
                )}
              </ParentSection>

              <ParentSection
                title="Next best actions"
                description="Shortcuts for the follow-ups parents most often need after reviewing reports."
              >
                <div className="grid grid-cols-1 gap-3">
                  <ParentQuickAction
                    href={`/parent/progress?childId=${encodeURIComponent(selectedChildId)}`}
                    title="Open progress and goals"
                    description="Review active goals, status changes, and teacher coordination notes."
                    tone="emerald"
                  />
                  <ParentQuickAction
                    href={`/parent/messages?childId=${encodeURIComponent(selectedChildId)}`}
                    title="Message the center"
                    description="Ask a quick question while the current child context is still fresh."
                    tone="sky"
                  />
                  <ParentQuickAction
                    href="/parent/forms"
                    title="Review forms and renewals"
                    description="Check paperwork that could affect care routines, permissions, or enrollment."
                    tone="amber"
                  />
                </div>
              </ParentSection>
            </div>
          </div>
        ) : null}
      </div>
    </ParentLayout>
  );
}

function DailyReportPanel({ activities, loading }) {
  if (loading) return <SkeletonCard />;
  if (!activities.length) {
    return (
      <ParentEmpty
        title="No daily activities yet"
        description="The daily report will appear here once teachers begin logging updates."
      />
    );
  }

  return (
    <div className="space-y-3">
      {activities.map((activity, index) => (
        <div
          key={activity.id || `${activity.createdAt}-${index}`}
          className="rounded-[24px] border border-gray-200 bg-white p-4 shadow-sm"
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
            <div className="rounded-2xl bg-gray-50 px-4 py-3 text-center sm:w-24">
              <div className="text-lg font-black tracking-tight text-gray-900">
                {formatTime(activity.createdAt)}
              </div>
              <div className="mt-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-500">
                {dayPartLabel(activity.createdAt)}
              </div>
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-sky-100 px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-[0.16em] text-sky-700">
                      {formatActivityType(activity.type)}
                    </span>
                    <span className="text-xs text-gray-500">
                      {formatDateTime(activity.createdAt)}
                    </span>
                  </div>
                  <div className="mt-2 text-base font-extrabold text-gray-900">
                    {activityTitle(activity)}
                  </div>
                  <div className="mt-1 text-sm text-gray-500">
                    {activity.recordedBy?.name ||
                      activity.recordedBy?.email ||
                      "Teacher update"}
                  </div>
                </div>

                <div className="rounded-2xl bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-600">
                  {describeActivitySummary(activity)}
                </div>
              </div>

              <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px]">
                <div className="rounded-2xl bg-gray-50 px-4 py-3 text-sm leading-6 text-gray-700">
                  {activity.notes && String(activity.notes).trim()
                    ? activity.notes
                    : "No extra note was added for this update."}
                </div>

                <div className="rounded-2xl border border-gray-200 bg-white px-4 py-3">
                  <div className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-gray-500">
                    Quick details
                  </div>
                  <div className="mt-2 space-y-2 text-sm text-gray-600">
                    {buildActivityFacts(activity).map((fact) => (
                      <div key={fact.label} className="flex items-start justify-between gap-3">
                        <span className="font-semibold text-gray-500">{fact.label}</span>
                        <span className="text-right text-gray-700">{fact.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {renderActivityDetails(activity)}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function ProgressPanel({
  progressRows,
  loading,
  progressStats,
  domainStats,
  activeGoals,
}) {
  if (loading) return <SkeletonCard />;
  if (!progressRows.length) {
    return (
      <ParentEmpty
        title="No progress records yet"
        description="Development goals will show here after teachers begin logging progress."
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <SummaryTile label="Completed" value={progressStats.completed} hint="Finished goals" tone="emerald" />
        <SummaryTile label="In progress" value={progressStats.inProgress} hint="Actively worked on" tone="amber" />
        <SummaryTile label="Support" value={progressStats.needsSupport} hint="Need extra help" tone="rose" />
        <SummaryTile label="Completion" value={`${progressStats.completionRate}%`} hint={`${progressStats.total} total goals`} tone="sky" />
      </div>

      <div className="rounded-[24px] border border-gray-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-base font-extrabold text-gray-900">Development overview</div>
            <div className="mt-1 text-sm text-gray-600">
              Progress is based on the goals already logged in the portal.
            </div>
          </div>
          <div className="rounded-full bg-sky-50 px-3 py-1 text-xs font-extrabold text-sky-700">
            {progressStats.completed} of {progressStats.total} complete
          </div>
        </div>

        <div className="mt-4 h-3 overflow-hidden rounded-full bg-gray-200">
          <div
            className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500"
            style={{ width: `${progressStats.completionRate}%` }}
          />
        </div>

        {domainStats.length ? (
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {domainStats.slice(0, 4).map((domain) => (
              <div key={domain.label} className="rounded-2xl border border-gray-200 bg-gray-50/70 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-extrabold text-gray-900">{domain.label}</div>
                    <div className="mt-1 text-xs text-gray-500">
                      {domain.completed} of {domain.total} completed
                    </div>
                  </div>
                  <div className="text-lg font-black text-gray-900">{domain.completionRate}%</div>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-gray-200">
                  <div className="h-full rounded-full bg-sky-500" style={{ width: `${domain.completionRate}%` }} />
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="rounded-[24px] border border-gray-200 bg-white p-4">
          <div className="text-base font-extrabold text-gray-900">Active focus areas</div>
          <div className="mt-1 text-sm text-gray-600">
            These are the newest goals that are still active or need support.
          </div>

          <div className="mt-4 space-y-3">
            {activeGoals.length ? (
              activeGoals.map((row) => (
                <div key={row.id} className="rounded-2xl border border-gray-200 bg-gray-50/70 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-extrabold text-gray-900">
                        {row.lesson?.title || "Untitled goal"}
                      </div>
                      <div className="mt-1 text-xs text-gray-500">
                        {inferDomain(row)} · Step {row.goalIndex || 1}
                      </div>
                    </div>
                    <span className={["rounded-full px-2.5 py-1 text-[11px] font-extrabold", statusTone(row.status)].join(" ")}>
                      {humanizeStatus(row.status)}
                    </span>
                  </div>
                  {row.lesson?.description ? (
                    <div className="mt-3 text-sm text-gray-600">{row.lesson.description}</div>
                  ) : null}
                </div>
              ))
            ) : (
              <ParentEmpty
                title="No active goals right now"
                description="Everything currently logged has already been completed."
              />
            )}
          </div>
        </div>

        <div className="rounded-[24px] border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-4">
          <div className="text-base font-extrabold text-gray-900">What this means for parents</div>
          <div className="mt-3 space-y-3 text-sm leading-6 text-gray-700">
            <p>Completed goals show the skills your child is already demonstrating consistently in the center.</p>
            <p>Active and support-needed goals are the best areas to ask about during pickup or your next message.</p>
            <p>The detailed steps tab stays useful when you want exact step numbers and more context.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function StepsPanel({ progressRows, loading }) {
  if (loading) return <SkeletonCard />;
  if (!progressRows.length) {
    return (
      <ParentEmpty
        title="No progression records yet"
        description="Detailed lesson steps will appear here once progress tracking begins."
      />
    );
  }

  return (
    <div className="space-y-3">
      {progressRows
        .slice()
        .sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt))
        .slice(0, 30)
        .map((row) => {
          const goals = Array.isArray(row.lesson?.goals) ? row.lesson.goals : [];
          const totalGoals = goals.length;
          return (
            <div key={row.id} className="rounded-[24px] border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-base font-extrabold text-gray-900">
                    {row.lesson?.title || row.lessonId}
                  </div>
                  <div className="mt-1 text-sm text-gray-500">
                    {inferDomain(row)} · Updated {formatRelativeDateTime(row.updatedAt || row.createdAt)}
                  </div>
                </div>
                <span className={["rounded-full px-2.5 py-1 text-[11px] font-extrabold", statusTone(row.status)].join(" ")}>
                  {humanizeStatus(row.status)}
                </span>
              </div>

              <div className="mt-4">
                <div className="flex items-center justify-between text-xs font-bold uppercase tracking-[0.16em] text-gray-500">
                  <span>Current step</span>
                  <span>
                    {row.goalIndex || 0}
                    {totalGoals ? ` / ${totalGoals}` : ""}
                  </span>
                </div>
                <div className="mt-2 flex gap-1">
                  {Array.from({ length: totalGoals || Math.max(row.goalIndex || 1, 1) }, (_, index) => {
                    const stepIndex = index + 1;
                    const done = stepIndex < Number(row.goalIndex || 0);
                    const current = stepIndex === Number(row.goalIndex || 0);
                    return (
                      <div
                        key={stepIndex}
                        className={[
                          "h-2 flex-1 rounded-full",
                          done
                            ? "bg-emerald-400"
                            : current
                              ? row.status === "FAILED"
                                ? "bg-rose-400"
                                : "bg-amber-400"
                              : "bg-gray-200",
                        ].join(" ")}
                      />
                    );
                  })}
                </div>
              </div>

              {row.lesson?.description ? (
                <div className="mt-4 rounded-2xl bg-gray-50 px-4 py-3 text-sm text-gray-600">
                  {row.lesson.description}
                </div>
              ) : null}
            </div>
          );
        })}
    </div>
  );
}

function ChildSwitcherCard({ child, active, onSelect }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={[
        "rounded-[24px] border p-4 text-left transition-all duration-200",
        active
          ? "border-sky-300 bg-gradient-to-br from-sky-50 to-white shadow-sm ring-2 ring-sky-100"
          : "border-gray-200 bg-white hover:-translate-y-0.5 hover:border-sky-200 hover:bg-sky-50/60 hover:shadow-sm",
      ].join(" ")}
    >
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-sky-600 text-sm font-black text-white">
          {initials(child.firstName, child.lastName)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-extrabold text-gray-900">
            {child.firstName} {child.lastName || ""}
          </div>
          <div className="mt-1 text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">
            {formatChildAge(child.birthDate) || "Age unavailable"}
          </div>
          <div className="mt-3 flex items-center justify-between gap-2">
            <span className="rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-bold text-gray-600">
              {child.allergies ? "Care notes on file" : "Profile ready"}
            </span>
            <span className="text-xs font-semibold text-sky-700">
              {active ? "Selected" : "Open"}
            </span>
          </div>
        </div>
      </div>
    </button>
  );
}

function SummaryTile({ label, value, hint, tone = "sky" }) {
  const tones = {
    sky: "border-sky-200 bg-sky-50/80 text-sky-900",
    emerald: "border-emerald-200 bg-emerald-50/80 text-emerald-900",
    amber: "border-amber-200 bg-amber-50/80 text-amber-900",
    rose: "border-rose-200 bg-rose-50/80 text-rose-900",
    gray: "border-gray-200 bg-gray-50/90 text-gray-900",
  };

  return (
    <div className={`rounded-2xl border p-4 ${tones[tone] || tones.sky}`}>
      <div className="text-[11px] font-extrabold uppercase tracking-[0.16em] opacity-70">
        {label}
      </div>
      <div className="mt-2 text-2xl font-black tracking-tight">{value}</div>
      <div className="mt-1 text-sm text-gray-600">{hint}</div>
    </div>
  );
}

function ChildMetaPill({ children }) {
  return (
    <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold text-white/90">
      {children}
    </span>
  );
}

function HeroMetric({ label, value, hint }) {
  return (
    <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 ring-1 ring-white/5">
      <div className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-white/70">
        {label}
      </div>
      <div className="mt-2 text-2xl font-black tracking-tight text-white">{value}</div>
      <div className="mt-1 text-xs text-white/70">{hint}</div>
    </div>
  );
}

function buildProfileFacts(child) {
  if (!child) return [];
  const facts = [];
  if (child.allergies && String(child.allergies).trim()) {
    facts.push({ label: "Allergies", value: String(child.allergies).trim() });
  }
  if (child.emergencyContact && String(child.emergencyContact).trim()) {
    facts.push({
      label: "Emergency contact",
      value: String(child.emergencyContact).trim(),
    });
  }
  const feedingPlan =
    child.feedingPlan && typeof child.feedingPlan === "object" ? child.feedingPlan : null;
  if (feedingPlan) {
    const parts = [];
    if (feedingPlan.foods) parts.push(`Foods: ${feedingPlan.foods}`);
    if (feedingPlan.formula) parts.push(`Formula: ${feedingPlan.formula}`);
    if (feedingPlan.bottlesPerDay) parts.push(`${feedingPlan.bottlesPerDay} bottles per day`);
    if (feedingPlan.bottleNotes) parts.push(feedingPlan.bottleNotes);
    if (parts.length) facts.push({ label: "Feeding plan", value: parts.join(" · ") });
  }
  return facts;
}

function buildActivityFacts(activity) {
  const facts = [];
  const details =
    activity?.details && typeof activity.details === "object" && !Array.isArray(activity.details)
      ? activity.details
      : {};

  if (["MEAL", "SNACK", "BOTTLE"].includes(activity.type)) {
    facts.push({ label: "Care type", value: "Nutrition" });
  }
  if (activity.type === "NAP") {
    facts.push({ label: "Care type", value: "Rest" });
  }
  if (activity.type === "DIAPER_CHANGE") {
    facts.push({ label: "Care type", value: "Toileting" });
  }
  if (details.meal) facts.push({ label: "Meal", value: String(details.meal) });
  if (details.time) facts.push({ label: "Logged time", value: String(details.time) });
  const media = extractMediaUrls(activity);
  if (media.length) {
    facts.push({
      label: "Media",
      value: `${media.length} attachment${media.length === 1 ? "" : "s"}`,
    });
  }
  if (!facts.length) facts.push({ label: "Status", value: "Recorded" });
  return facts.slice(0, 4);
}

function describeActivitySummary(activity) {
  if (activity.type === "NAP") return "Rest routine";
  if (activity.type === "DIAPER_CHANGE") return "Care routine";
  if (["MEAL", "SNACK", "BOTTLE"].includes(activity.type)) return "Nutrition update";
  if (activity.type === "ACTIVITY") return "Teacher summary";
  return "Classroom update";
}

function statusTone(status) {
  if (status === "COMPLETED" || status === "PASSED") return "bg-emerald-100 text-emerald-800";
  if (status === "IN_PROGRESS") return "bg-amber-100 text-amber-800";
  if (status === "FAILED") return "bg-rose-100 text-rose-800";
  return "bg-gray-100 text-gray-700";
}

function inferDomain(row) {
  const text = `${String(row?.lesson?.category?.name || "").toLowerCase()} ${String(row?.lesson?.title || "").toLowerCase()}`;
  if (text.includes("social") || text.includes("emotion") || text.includes("behavior")) return "Social-Emotional";
  if (text.includes("physical") || text.includes("motor") || text.includes("movement")) return "Physical";
  if (text.includes("language") || text.includes("literacy") || text.includes("reading") || text.includes("phonics")) return "Language & Literacy";
  return "Cognitive";
}

function humanizeStatus(status) {
  if (status === "COMPLETED") return "Completed";
  if (status === "PASSED") return "Passed";
  if (status === "IN_PROGRESS") return "In progress";
  if (status === "FAILED") return "Needs support";
  return "Not started";
}

function activityTitle(activity) {
  if (activity?.type === "ACTIVITY") return "Teacher summary";
  if (["MEAL", "SNACK", "BOTTLE"].includes(activity?.type)) return "Meals and nutrition";
  if (activity?.type === "DIAPER_CHANGE") return "Diaper or potty update";
  if (activity?.type === "NAP") return "Rest time";
  return formatActivityType(activity?.type) || "Update";
}

function formatActivityType(type) {
  return String(type || "OTHER").toLowerCase().split("_").map((part) => part.slice(0, 1).toUpperCase() + part.slice(1)).join(" ");
}

function renderActivityDetails(activity) {
  const media = extractMediaUrls(activity);
  if (!media.length) return null;
  return (
    <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
      {media.slice(0, 6).map((url, idx) => (
        <img
          key={`${activity?.id || activity?.createdAt || "activity"}-${idx}`}
          src={resolveMediaUrl(url)}
          alt={`Activity media ${idx + 1}`}
          className="h-28 w-full rounded-2xl border border-gray-200 object-cover"
        />
      ))}
    </div>
  );
}

function extractMediaUrls(activity) {
  const details = activity?.details && typeof activity.details === "object" && !Array.isArray(activity.details) ? activity.details : {};
  const raw = Array.isArray(details.media) ? details.media : [];
  return [...new Set(raw.map((m) => typeof m === "string" ? m.trim() : m?.url?.trim?.() || "").filter(Boolean))];
}

function resolveMediaUrl(url) {
  if (!url) return "";
  const value = String(url).trim();
  if (!value) return "";
  if (/^https?:\/\//i.test(value) || value.startsWith("/")) return value;
  return `/${value}`;
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

function dayPartLabel(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Update";
  if (date.getHours() < 12) return "Morning";
  if (date.getHours() < 17) return "Afternoon";
  return "Evening";
}

function initials(firstName, lastName) {
  const first = (firstName || "").trim().slice(0, 1).toUpperCase();
  const last = (lastName || "").trim().slice(0, 1).toUpperCase();
  return `${first}${last}` || "C";
}
