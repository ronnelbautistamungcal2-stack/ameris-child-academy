import ParentLayout from "@/components/parent/ParentLayout";
import {
  ParentButton,
  ParentEmpty,
  ParentPageHeader,
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
    eyebrow: "Care feed",
    tone: "sky",
    icon: "feed",
    description: "Latest teacher logs, care notes, meals, and classroom activity.",
  },
  {
    key: "PROGRESS_REPORT",
    label: "Progress Report",
    eyebrow: "Development",
    tone: "emerald",
    icon: "progress",
    description: "A parent-friendly overview of development progress and active goals.",
  },
  {
    key: "STEPS",
    label: "Steps of Progression",
    eyebrow: "Lesson detail",
    tone: "amber",
    icon: "steps",
    description: "Detailed lesson-level progress and the next steps being worked on.",
  },
  {
    key: "CATCHUP",
    label: "Catch-up Plans",
    eyebrow: "Support plan",
    tone: "rose",
    icon: "support",
    description: "Recommended support plans and reinforcement ideas for growth areas.",
  },
  {
    key: "MILESTONE",
    label: "Milestone Calendar",
    eyebrow: "Timeline",
    tone: "sky",
    icon: "calendar",
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
        .slice(0, 10),
    [activities],
  );
  const latestActivity = activityFeed[0] || null;
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
    const notStarted = progressRows.filter(
      (row) => row.status === "NOT_STARTED",
    ).length;
    const needsSupport = progressRows.filter((row) => row.status === "FAILED").length;

    return {
      total,
      completed,
      inProgress,
      notStarted,
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
  const activeTabMeta = TAB_LIST.find((tab) => tab.key === activeTab) || TAB_LIST[0];
  const tabMetrics = {
    DAILY_REPORT: {
      primary: `${activityFeed.length}`,
      secondary: activityFeed.length === 1 ? "update" : "updates",
      hint: latestActivity
        ? `Latest ${formatRelativeDateTime(latestActivity.createdAt)}`
        : "Waiting for the first update",
    },
    PROGRESS_REPORT: {
      primary: `${progressStats.completionRate}%`,
      secondary: "complete",
      hint: progressStats.total
        ? `${progressStats.completed} of ${progressStats.total} goals complete`
        : "No progress records yet",
    },
    STEPS: {
      primary: `${progressRows.length}`,
      secondary: progressRows.length === 1 ? "lesson" : "lessons",
      hint: progressRows.length
        ? `${progressStats.inProgress} active and ${progressStats.needsSupport} needing support`
        : "Detailed steps will appear here",
    },
    CATCHUP: {
      primary: `${progressStats.inProgress + progressStats.needsSupport + progressStats.notStarted}`,
      secondary: "plans",
      hint:
        progressStats.needsSupport > 0
          ? `${progressStats.needsSupport} focus areas need support`
          : "Support recommendations are up to date",
    },
    MILESTONE: {
      primary: `${activityFeed.length}`,
      secondary: activityFeed.length === 1 ? "events" : "events",
      hint: mediaCount
        ? `${mediaCount} shared attachment${mediaCount === 1 ? "" : "s"}`
        : "Timeline view of recent records",
    },
  };

  return (
    <ParentLayout title="My Children">
      <div className="space-y-3">
        <ParentPageHeader
          eyebrow="Family hub"
          title={selectedChild ? `${selectedChild.firstName}'s reports` : "My children"}
          description="Choose a child and open the report you need from one focused workspace."
          accent="sky"
          layout="default"
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
                Messages
              </ParentButton>
              <ParentButton
                variant="primary"
                onClick={() => selectedChildId && loadChildRecords(selectedChildId)}
                disabled={!selectedChildId || recordsLoading}
              >
                {recordsLoading ? "Refreshing..." : "Refresh"}
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
                          ? `Reports were last synced at ${formatTime(lastSyncAt)}. Use the report switcher below to move between daily care, progress, and milestones.`
                          : "Use the report switcher below to move between daily care, progress, and milestones."}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <HeroMetric label="Completion" value={`${progressStats.completionRate}%`} hint="Overall progress" />
                  <HeroMetric label="Open goals" value={progressStats.open} hint="Still active" />
                  <HeroMetric label="Support" value={progressStats.needsSupport} hint="Need attention" />
                </div>
              </div>
            </ParentSurface>

            <ParentSection
              title="Reports"
              description="Switch report views without leaving the current child context."
              className="overflow-hidden border-sky-100 bg-gradient-to-br from-white via-white to-sky-50/30 shadow-[0_18px_60px_-50px_rgba(14,116,144,0.45)] dark:border-sky-900/60 dark:bg-gradient-to-br dark:from-slate-950 dark:via-slate-950 dark:to-sky-950/30 dark:shadow-[0_24px_80px_-52px_rgba(14,116,144,0.7)]"
            >
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="rounded-full border border-sky-100 bg-sky-50/80 px-3 py-1 text-[11px] font-semibold text-sky-800 dark:border-sky-800 dark:bg-sky-950/50 dark:text-sky-200">
                    Viewing reports for {selectedChild.firstName}
                  </div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-500 dark:text-gray-400">
                    {TAB_LIST.length} report views
                  </div>
                </div>

                <div className="overflow-x-auto pb-1">
                  <div
                    role="tablist"
                    aria-label={`${selectedChild.firstName}'s reports`}
                    className="flex w-max min-w-full flex-nowrap gap-1.5 rounded-[18px] border border-sky-100 bg-sky-50/60 p-1 dark:border-sky-900/50 dark:bg-slate-900/80"
                  >
                    {TAB_LIST.map((tab) => (
                      <ReportTabCard
                        key={tab.key}
                        tab={tab}
                        active={activeTab === tab.key}
                        metric={tabMetrics[tab.key]}
                        onSelect={() => setActiveTab(tab.key)}
                      />
                    ))}
                  </div>
                </div>

                <div className="rounded-[16px] border border-gray-200 bg-white px-3.5 py-3 shadow-sm dark:border-gray-800 dark:bg-slate-900/90 dark:shadow-[0_18px_48px_-36px_rgba(15,23,42,0.95)]">
                  <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <div className="inline-flex rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.16em] text-sky-700 dark:border-sky-800 dark:bg-sky-950/50 dark:text-sky-200">
                        {activeTabMeta.eyebrow}
                      </div>
                      <h3 className="mt-1.5 text-base font-black tracking-tight text-gray-900 dark:text-gray-100">
                        {activeTabMeta.label}
                      </h3>
                    </div>

                    <div className="flex shrink-0 flex-wrap gap-1.5">
                      <span className="inline-flex items-center rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-[12px] font-bold text-sky-700 dark:border-sky-800 dark:bg-sky-950/50 dark:text-sky-200">
                        {tabMetrics[activeTab]?.primary} {tabMetrics[activeTab]?.secondary}
                      </span>
                      {latestActivity ? (
                        <span className="inline-flex items-center rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-[12px] font-semibold text-gray-600 dark:border-gray-700 dark:bg-slate-800 dark:text-gray-300">
                          Latest {formatRelativeDateTime(latestActivity.createdAt)}
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <p className="mt-2 text-[13px] leading-5 text-gray-600 dark:text-gray-300">
                    {tabMetrics[activeTab]?.hint || activeTabMeta.description}
                  </p>
                </div>
              </div>

              <div
                role="tabpanel"
                id={`panel-${activeTab.toLowerCase()}`}
                aria-labelledby={`tab-${activeTab.toLowerCase()}`}
                className="mt-2"
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

            {profileFacts.length || lastTeacherNote ? (
              <ParentSection
                title="Key notes"
                description="Keep these details in view while reviewing the current report."
              >
                <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                  <div className="rounded-[22px] border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-slate-900">
                    <div className="text-base font-black tracking-tight text-gray-900 dark:text-gray-100">Profile and care details</div>
                    {profileFacts.length ? (
                      <div className="mt-3 space-y-2.5">
                        {profileFacts.map((fact) => (
                          <div key={fact.label} className="rounded-[16px] border border-gray-200 bg-gray-50/70 px-3.5 py-2.5 dark:border-gray-800 dark:bg-slate-800/80">
                            <div className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-gray-500 dark:text-gray-400">
                              {fact.label}
                            </div>
                            <div className="mt-1 text-[13px] leading-5 text-gray-700 dark:text-gray-200">{fact.value}</div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="mt-4 text-sm text-gray-600 dark:text-gray-300">
                        No profile notes have been published for this child yet.
                      </div>
                    )}
                  </div>

                  <div className="rounded-[22px] border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-slate-900">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="text-base font-black tracking-tight text-gray-900 dark:text-gray-100">Latest teacher note</div>
                      {lastTeacherNote ? (
                        <div className="rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-[11px] font-bold text-sky-700 dark:border-sky-800 dark:bg-sky-950/50 dark:text-sky-200">
                          {formatRelativeDateTime(lastTeacherNote.createdAt)}
                        </div>
                      ) : null}
                    </div>
                    {lastTeacherNote ? (
                      <div className="mt-3 rounded-[16px] border border-sky-100 bg-gradient-to-br from-sky-50 to-white p-3.5 dark:border-sky-900/60 dark:bg-gradient-to-br dark:from-sky-950/50 dark:to-slate-900">
                        <div className="text-[13px] font-extrabold text-gray-900 dark:text-gray-100">
                          {activityTitle(lastTeacherNote)}
                        </div>
                        <div className="mt-2.5 text-[13px] leading-5 text-gray-700 dark:text-gray-200">
                          {String(lastTeacherNote.notes).trim()}
                        </div>
                      </div>
                    ) : (
                      <div className="mt-3 text-[13px] text-gray-600 dark:text-gray-300">
                        No written teacher note has been added yet.
                      </div>
                    )}
                  </div>
                </div>
              </ParentSection>
            ) : null}
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

  const mealCount = activities.filter((activity) =>
    ["MEAL", "SNACK", "BOTTLE"].includes(activity.type),
  ).length;
  const careCount = activities.filter((activity) =>
    ["DIAPER_CHANGE", "NAP"].includes(activity.type),
  ).length;
  const teacherNotes = activities.filter(
    (activity) => activity.notes && String(activity.notes).trim(),
  ).length;
  const mediaTotal = activities.reduce(
    (sum, activity) => sum + extractMediaUrls(activity).length,
    0,
  );

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <SummaryTile label="Entries" value={activities.length} hint="Recent report items" tone="sky" />
        <SummaryTile label="Meals" value={mealCount} hint="Nutrition logs" tone="amber" />
        <SummaryTile label="Care" value={careCount} hint="Rest and toileting" tone="emerald" />
        <SummaryTile label="Media" value={mediaTotal} hint={teacherNotes ? `${teacherNotes} written notes` : "No notes yet"} tone="gray" />
      </div>

      {activities.map((activity, index) => (
        <div
          key={activity.id || `${activity.createdAt}-${index}`}
          className="rounded-[20px] border border-gray-200 bg-white p-3 shadow-sm sm:p-3.5 dark:border-gray-800 dark:bg-slate-900"
        >
          <div className="grid gap-2.5 lg:grid-cols-[72px_minmax(0,1fr)]">
            <div className="self-start rounded-[16px] border border-sky-100 bg-gradient-to-br from-sky-50 to-white px-2.5 py-2.5 text-center shadow-sm dark:border-sky-900/60 dark:bg-gradient-to-br dark:from-sky-950/40 dark:to-slate-900">
              <div className="text-[15px] font-black tracking-tight text-gray-900 dark:text-gray-100">
                {formatTime(activity.createdAt)}
              </div>
              <div className="mt-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-500 dark:text-gray-400">
                {dayPartLabel(activity.createdAt)}
              </div>
              <div className="mt-2 rounded-full bg-white px-1.5 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.16em] text-sky-700 ring-1 ring-sky-100 dark:bg-slate-900 dark:text-sky-200 dark:ring-sky-900/70">
                {formatActivityType(activity.type)}
              </div>
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-col gap-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-[0.16em] text-gray-700 dark:border-gray-700 dark:bg-slate-800 dark:text-gray-200">
                      {formatDateTime(activity.createdAt)}
                    </span>
                    <span className="rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-[11px] font-semibold text-gray-700 dark:border-gray-700 dark:bg-slate-800 dark:text-gray-200">
                      {describeActivitySummary(activity)}
                    </span>
                  </div>
                  <div className="mt-1.5 text-[15px] font-black tracking-tight text-gray-900 dark:text-gray-100">
                    {activityTitle(activity)}
                  </div>
                  <div className="mt-1 text-[12px] text-gray-500 dark:text-gray-400">
                    {activity.recordedBy?.name ||
                      activity.recordedBy?.email ||
                      "Teacher update"}
                  </div>
                </div>
              </div>

              <div className="mt-2.5 rounded-[16px] border border-gray-200 bg-gray-50/80 px-3 py-2.5 text-[13px] leading-5 text-gray-700 dark:border-gray-700 dark:bg-slate-800/90 dark:text-gray-200">
                <div className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-gray-500 dark:text-gray-400">
                  Teacher note
                </div>
                <div className="mt-1.5">
                  {activity.notes && String(activity.notes).trim()
                    ? activity.notes
                    : "No extra note was added for this update."}
                </div>
              </div>

              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {buildActivityFacts(activity).map((fact) => (
                  <div
                    key={`${activity.id || activity.createdAt}-${fact.label}`}
                    className="rounded-full border border-gray-200 bg-white px-2.5 py-1 text-[12px] text-gray-700 shadow-sm dark:border-gray-700 dark:bg-slate-900 dark:text-gray-200"
                  >
                    <span className="font-semibold text-gray-500 dark:text-gray-400">{fact.label}:</span>{" "}
                    {fact.value}
                  </div>
                ))}
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
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <SummaryTile label="Completed" value={progressStats.completed} hint="Finished goals" tone="emerald" />
        <SummaryTile label="In progress" value={progressStats.inProgress} hint="Actively worked on" tone="amber" />
        <SummaryTile label="Support" value={progressStats.needsSupport} hint="Need extra help" tone="rose" />
        <SummaryTile label="Completion" value={`${progressStats.completionRate}%`} hint={`${progressStats.total} total goals`} tone="sky" />
      </div>

      <div className="rounded-[22px] border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-base font-black tracking-tight text-gray-900 dark:text-gray-100">Development overview</div>
            <div className="mt-1 text-[13px] leading-5 text-gray-600 dark:text-gray-300">
              Progress is based on the goals already logged in the portal.
            </div>
          </div>
          <div className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-extrabold text-sky-700 dark:border-sky-800 dark:bg-sky-950/50 dark:text-sky-200">
            {progressStats.completed} of {progressStats.total} complete
          </div>
        </div>

        <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-gray-200 dark:bg-slate-800">
          <div
            className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500"
            style={{ width: `${progressStats.completionRate}%` }}
          />
        </div>

        {domainStats.length ? (
          <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {domainStats.slice(0, 4).map((domain) => (
              <div key={domain.label} className="rounded-[18px] border border-gray-200 bg-gray-50/70 p-3.5 shadow-sm dark:border-gray-800 dark:bg-slate-800/80">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[13px] font-extrabold text-gray-900 dark:text-gray-100">{domain.label}</div>
                    <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      {domain.completed} of {domain.total} completed
                    </div>
                  </div>
                  <div className="text-sm font-black text-gray-900 dark:text-gray-100">{domain.completionRate}%</div>
                </div>
                <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-slate-700">
                  <div className="h-full rounded-full bg-sky-500" style={{ width: `${domain.completionRate}%` }} />
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1fr)_260px]">
        <div className="rounded-[22px] border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-slate-900">
          <div className="text-base font-black tracking-tight text-gray-900 dark:text-gray-100">Active focus areas</div>
          <div className="mt-1 text-[13px] leading-5 text-gray-600 dark:text-gray-300">
            These are the newest goals that are still active or need support.
          </div>

          <div className="mt-3 space-y-2.5">
            {activeGoals.length ? (
              activeGoals.map((row) => (
                <div key={row.id} className="rounded-[18px] border border-gray-200 bg-gray-50/70 p-3.5 dark:border-gray-800 dark:bg-slate-800/80">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-[13px] font-extrabold text-gray-900 dark:text-gray-100">
                        {row.lesson?.title || "Untitled goal"}
                      </div>
                      <div className="mt-1.5 flex flex-wrap gap-2">
                        <span className="rounded-full border border-gray-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-gray-700 dark:border-gray-700 dark:bg-slate-900 dark:text-gray-200">
                          {inferDomain(row)}
                        </span>
                        <span className="rounded-full border border-gray-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-gray-700 dark:border-gray-700 dark:bg-slate-900 dark:text-gray-200">
                          Step {row.goalIndex || 1}
                        </span>
                      </div>
                    </div>
                    <span className={["rounded-full px-2.5 py-1 text-[11px] font-extrabold", statusTone(row.status)].join(" ")}>
                      {humanizeStatus(row.status)}
                    </span>
                  </div>
                  {row.lesson?.description ? (
                    <div className="mt-2.5 text-[13px] leading-5 text-gray-600 dark:text-gray-300">{row.lesson.description}</div>
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

        <div className="rounded-[22px] border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-4 shadow-sm dark:border-emerald-900/60 dark:bg-gradient-to-br dark:from-emerald-950/30 dark:to-slate-950">
          <div className="text-base font-black tracking-tight text-gray-900 dark:text-gray-100">What this means for parents</div>
          <div className="mt-3 space-y-2.5 text-[13px] leading-5 text-gray-700 dark:text-gray-300">
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

  const sortedRows = progressRows
    .slice()
    .sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt))
    .slice(0, 12);
  const completedRows = sortedRows.filter((row) => ["COMPLETED", "PASSED"].includes(row.status));
  const supportRows = sortedRows.filter((row) => row.status === "FAILED");
  const mostRecent = sortedRows[0];

  if (sortedRows.length) {
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2.5 xl:grid-cols-4">
          <SummaryTile
            label="Tracked steps"
            value={sortedRows.length}
            hint="Recent lesson records shown on this page"
            tone="amber"
          />
          <SummaryTile
            label="Completed"
            value={completedRows.length}
            hint="Lessons already finished or passed"
            tone="emerald"
          />
          <SummaryTile
            label="Support"
            value={supportRows.length}
            hint="Items that still need reteaching or follow-up"
            tone="rose"
          />
          <SummaryTile
            label="Most recent"
            value={mostRecent ? formatRelativeDateTime(mostRecent.updatedAt || mostRecent.createdAt) : "-"}
            hint="Latest lesson update received from the center"
            tone="gray"
          />
        </div>

        <div className="space-y-2.5">
          {sortedRows.map((row) => {
            const goals = Array.isArray(row.lesson?.goals) ? row.lesson.goals : [];
            const totalGoals = goals.length || Math.max(Number(row.goalIndex || 1), 1);
            const goalIndex = Math.max(Math.min(Number(row.goalIndex || 1), totalGoals), 1);
            const completedSteps = ["COMPLETED", "PASSED"].includes(row.status)
              ? totalGoals
              : Math.max(goalIndex - 1, 0);
            const progressPercent = totalGoals ? Math.round((completedSteps / totalGoals) * 100) : 0;
            const currentGoal = goals[Math.max(goalIndex - 1, 0)] || null;

            return (
              <div key={row.id} className="rounded-[22px] border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-slate-900">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-black tracking-tight text-gray-900 dark:text-gray-100">
                      {row.lesson?.title || row.lessonId}
                    </div>
                    <div className="mt-2.5 flex flex-wrap gap-2">
                      <span className="rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-[11px] font-semibold text-gray-700 dark:border-gray-700 dark:bg-slate-800 dark:text-gray-200">
                        {inferDomain(row)}
                      </span>
                      <span className="rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-[11px] font-semibold text-gray-700 dark:border-gray-700 dark:bg-slate-800 dark:text-gray-200">
                        Updated {formatRelativeDateTime(row.updatedAt || row.createdAt)}
                      </span>
                    </div>
                  </div>
                  <span className={["rounded-full px-2.5 py-1 text-[11px] font-extrabold", statusTone(row.status)].join(" ")}>
                    {humanizeStatus(row.status)}
                  </span>
                </div>

                <div className="mt-3 rounded-[18px] border border-gray-200 bg-gray-50/80 p-3.5 dark:border-gray-700 dark:bg-slate-800/90">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-gray-500 dark:text-gray-400">
                        Lesson progression
                      </div>
                      <div className="mt-1 text-[13px] font-semibold text-gray-900 dark:text-gray-100">
                        Step {goalIndex} of {totalGoals}
                      </div>
                    </div>
                    <div className="rounded-full border border-white bg-white px-2.5 py-1 text-[11px] font-bold text-gray-700 dark:border-gray-700 dark:bg-slate-900 dark:text-gray-200">
                      {progressPercent}% complete
                    </div>
                  </div>

                  <div className="mt-3 flex gap-1.5">
                    {Array.from({ length: totalGoals }, (_, index) => {
                      const stepIndex = index + 1;
                      const done =
                        ["COMPLETED", "PASSED"].includes(row.status) || stepIndex < goalIndex;
                      const current =
                        !["COMPLETED", "PASSED"].includes(row.status) && stepIndex === goalIndex;
                      return (
                        <div
                          key={stepIndex}
                          className={[
                            "h-2.5 flex-1 rounded-full",
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

                  <div className="mt-2.5 text-[13px] leading-5 text-gray-600 dark:text-gray-300">
                    {currentGoal?.title
                      ? `Current focus: ${currentGoal.title}`
                      : row.status === "FAILED"
                        ? "This lesson needs extra support before moving to the next step."
                        : row.status === "IN_PROGRESS"
                          ? "The center is actively working through this lesson."
                          : "This lesson has been logged and is ready for the next classroom update."}
                  </div>
                </div>

                {row.lesson?.description ? (
                  <div className="mt-3 rounded-[16px] border border-gray-200 bg-white px-3.5 py-2.5 dark:border-gray-700 dark:bg-slate-950">
                    <div className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-gray-500 dark:text-gray-400">
                      Lesson note
                    </div>
                    <div className="mt-2 text-[13px] leading-5 text-gray-600 dark:text-gray-300">{row.lesson.description}</div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
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
            <div key={row.id} className="rounded-[24px] border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-slate-900">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-base font-extrabold text-gray-900 dark:text-gray-100">
                    {row.lesson?.title || row.lessonId}
                  </div>
                  <div className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    {inferDomain(row)} · Updated {formatRelativeDateTime(row.updatedAt || row.createdAt)}
                  </div>
                </div>
                <span className={["rounded-full px-2.5 py-1 text-[11px] font-extrabold", statusTone(row.status)].join(" ")}>
                  {humanizeStatus(row.status)}
                </span>
              </div>

              <div className="mt-4">
                <div className="flex items-center justify-between text-xs font-bold uppercase tracking-[0.16em] text-gray-500 dark:text-gray-400">
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
                <div className="mt-4 rounded-2xl bg-gray-50 px-4 py-3 text-sm text-gray-600 dark:bg-slate-800 dark:text-gray-300">
                  {row.lesson.description}
                </div>
              ) : null}
            </div>
          );
        })}
    </div>
  );
}

function ReportTabIcon({ icon, tone = "sky" }) {
  const tones = {
    sky: "bg-sky-100 text-sky-700 dark:bg-sky-950/60 dark:text-sky-200",
    emerald: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-200",
    amber: "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-200",
    rose: "bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-200",
  };

  let content = null;
  if (icon === "feed") {
    content = (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3h5.25m-7.5 8.25h13.5A2.25 2.25 0 0021 17.25V6.75A2.25 2.25 0 0018.75 4.5H5.25A2.25 2.25 0 003 6.75v10.5A2.25 2.25 0 005.25 19.5z" />
      </svg>
    );
  } else if (icon === "progress") {
    content = (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v18h18M7.5 14.25l3-3 2.25 2.25L16.5 9" />
      </svg>
    );
  } else if (icon === "steps") {
    content = (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 18.75h15m-15-6h10.5m-10.5-6h6" />
      </svg>
    );
  } else if (icon === "support") {
    content = (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M18 9a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9M9.75 21h4.5" />
      </svg>
    );
  } else {
    content = (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10m-11 9h12a2 2 0 002-2V7a2 2 0 00-2-2H6a2 2 0 00-2 2v11a2 2 0 002 2z" />
      </svg>
    );
  }

  return (
    <div className={["flex h-8 w-8 items-center justify-center rounded-xl", tones[tone] || tones.sky].join(" ")}>
      {content}
    </div>
  );
}

function ReportTabCard({ tab, active, metric, onSelect }) {
  return (
    <button
      id={`tab-${tab.key.toLowerCase()}`}
      role="tab"
      type="button"
      aria-selected={active}
      aria-controls={`panel-${tab.key.toLowerCase()}`}
      onClick={onSelect}
      className={[
        "group min-w-[126px] shrink-0 rounded-[14px] border px-3 py-2 text-left transition-all duration-200",
        active
          ? "border-sky-200 bg-white shadow-sm ring-1 ring-sky-100 dark:border-sky-800 dark:bg-slate-950 dark:ring-sky-900/70"
          : "border-transparent bg-transparent hover:border-white hover:bg-white/80 dark:hover:border-slate-700 dark:hover:bg-slate-900",
      ].join(" ")}
    >
      <div className="flex items-center gap-2">
        <div className="shrink-0">
          <ReportTabIcon icon={tab.icon} tone={tab.tone} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <div className="truncate text-[12px] font-black tracking-tight text-gray-900 dark:text-gray-100">
              {tab.label}
            </div>
            {metric ? (
              <div className="rounded-full border border-gray-200 bg-white px-2 py-0.5 text-[10px] font-extrabold text-gray-700 dark:border-gray-700 dark:bg-slate-900 dark:text-gray-200">
                {metric.primary}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </button>
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
          <div className="truncate text-[13px] font-extrabold text-gray-900 dark:text-gray-100">
            {child.firstName} {child.lastName || ""}
          </div>
          <div className="mt-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-500 dark:text-gray-400">
            {formatChildAge(child.birthDate) || "Age unavailable"}
          </div>
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-bold text-gray-600 dark:bg-slate-800 dark:text-gray-300">
              {child.allergies ? "Care notes on file" : "Profile ready"}
            </span>
            <span className="rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-bold text-sky-700 ring-1 ring-sky-100 dark:bg-slate-950 dark:text-sky-200 dark:ring-sky-900/70">
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
    sky: "border-sky-200 bg-sky-50/80 text-sky-900 dark:border-sky-900/70 dark:bg-sky-950/40 dark:text-sky-100",
    emerald: "border-emerald-200 bg-emerald-50/80 text-emerald-900 dark:border-emerald-900/70 dark:bg-emerald-950/40 dark:text-emerald-100",
    amber: "border-amber-200 bg-amber-50/80 text-amber-900 dark:border-amber-900/70 dark:bg-amber-950/40 dark:text-amber-100",
    rose: "border-rose-200 bg-rose-50/80 text-rose-900 dark:border-rose-900/70 dark:bg-rose-950/40 dark:text-rose-100",
    gray: "border-gray-200 bg-gray-50/90 text-gray-900 dark:border-gray-800 dark:bg-slate-900 dark:text-gray-100",
  };

  return (
    <div className={`flex h-full min-h-[88px] flex-col rounded-[18px] border px-3 py-2.5 shadow-sm ${tones[tone] || tones.sky}`}>
      <div className="text-[10px] font-extrabold uppercase tracking-[0.16em] opacity-70">
        {label}
      </div>
      <div className="mt-2 break-words text-[clamp(1.05rem,1.8vw,1.4rem)] font-black leading-tight tracking-tight">
        {value}
      </div>
      <div className="mt-auto pt-2 text-[11px] leading-4 text-gray-600 dark:text-gray-300">{hint}</div>
    </div>
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
  if (status === "COMPLETED" || status === "PASSED") {
    return "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200";
  }
  if (status === "IN_PROGRESS") {
    return "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-200";
  }
  if (status === "FAILED") {
    return "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-200";
  }
  return "bg-gray-100 text-gray-700 dark:bg-slate-800 dark:text-gray-200";
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
    <div className="mt-2.5 grid max-w-[520px] grid-cols-2 gap-2 sm:grid-cols-4">
      {media.slice(0, 4).map((url, idx) => (
        <img
          key={`${activity?.id || activity?.createdAt || "activity"}-${idx}`}
          src={resolveMediaUrl(url)}
          alt={`Activity media ${idx + 1}`}
          className="h-20 w-full rounded-[16px] border border-gray-200 object-cover dark:border-gray-800"
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
