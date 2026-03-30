import ParentLayout from "@/components/parent/ParentLayout";
import {
  ParentButton,
  ParentEmpty,
  ParentPill,
  ParentSection,
  ParentSurface,
} from "@/components/parent/ParentUI";
import ProgressEntryTimeline from "@/components/progression/ProgressEntryTimeline";
import { apiJson } from "@/lib/api";
import { ageInMonths, formatAge } from "@/lib/ageUtils";
import { buildParentMessageComposeHref } from "@/lib/parentSupport";
import { useRouter } from "next/router";
import { useCallback, useEffect, useMemo, useState } from "react";

const DAY_MS = 24 * 60 * 60 * 1000;
const GOAL_PREVIEW_COUNT = 4;

const VIEW_OPTIONS = [
  { value: "week", label: "This week", shortLabel: "Weekly", days: 7 },
  { value: "month", label: "This month", shortLabel: "Monthly", days: 30 },
];

const STATUS_META = {
  NOT_STARTED: {
    label: "Ready to begin",
    badge:
      "border-stone-200 bg-stone-50 text-stone-700 dark:border-stone-700 dark:bg-stone-900/60 dark:text-stone-200",
    bar: "bg-stone-300 dark:bg-stone-600",
    card:
      "border-stone-200 bg-white dark:border-stone-700 dark:bg-slate-900",
    progress: 28,
    weight: 0.35,
    summary:
      "This goal is ready for the next classroom update and a gentle start.",
  },
  IN_PROGRESS: {
    label: "Improving",
    badge:
      "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200",
    bar: "bg-amber-400",
    card:
      "border-amber-200 bg-white dark:border-amber-900/60 dark:bg-slate-900",
    progress: 66,
    weight: 0.72,
    summary:
      "Steady practice is happening now, and small repeats at home can help it stick.",
  },
  COMPLETED: {
    label: "On track",
    badge:
      "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-200",
    bar: "bg-emerald-400",
    card:
      "border-emerald-200 bg-white dark:border-emerald-900/60 dark:bg-slate-900",
    progress: 100,
    weight: 1,
    summary: "This goal is settled and showing confident progress.",
  },
  PASSED: {
    label: "On track",
    badge:
      "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-200",
    bar: "bg-emerald-400",
    card:
      "border-emerald-200 bg-white dark:border-emerald-900/60 dark:bg-slate-900",
    progress: 100,
    weight: 1,
    summary: "This goal is settled and showing confident progress.",
  },
  FAILED: {
    label: "Needs support",
    badge:
      "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200",
    bar: "bg-rose-400",
    card:
      "border-rose-200 bg-white dark:border-rose-900/60 dark:bg-slate-900",
    progress: 42,
    weight: 0.18,
    summary:
      "This area needs a little more repetition and reassurance before it feels easier.",
  },
};

const DOMAIN_META = {
  communication: {
    key: "communication",
    label: "Communication",
    insightLabel: "communication",
    code: "CO",
    codeClasses:
      "bg-sky-100 text-sky-700 dark:bg-sky-950/60 dark:text-sky-200",
    chip:
      "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900/60 dark:bg-sky-950/40 dark:text-sky-200",
    progress:
      "from-sky-400 via-cyan-400 to-blue-400",
  },
  social: {
    key: "social",
    label: "Social skills",
    insightLabel: "social confidence",
    code: "SO",
    codeClasses:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-200",
    chip:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-200",
    progress:
      "from-emerald-400 via-teal-400 to-cyan-400",
  },
  motor: {
    key: "motor",
    label: "Motor skills",
    insightLabel: "motor skills",
    code: "MO",
    codeClasses:
      "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-200",
    chip:
      "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200",
    progress:
      "from-amber-400 via-orange-400 to-rose-400",
  },
  thinking: {
    key: "thinking",
    label: "Thinking",
    insightLabel: "thinking skills",
    code: "TH",
    codeClasses:
      "bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-200",
    chip:
      "border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-900/60 dark:bg-indigo-950/40 dark:text-indigo-200",
    progress:
      "from-indigo-400 via-sky-400 to-cyan-400",
  },
  creative: {
    key: "creative",
    label: "Creativity",
    insightLabel: "creative expression",
    code: "CR",
    codeClasses:
      "bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-950/60 dark:text-fuchsia-200",
    chip:
      "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700 dark:border-fuchsia-900/60 dark:bg-fuchsia-950/40 dark:text-fuchsia-200",
    progress:
      "from-fuchsia-400 via-pink-400 to-rose-400",
  },
};

const DOMAIN_ORDER = ["communication", "social", "motor", "thinking", "creative"];

export default function ParentProgress() {
  const router = useRouter();
  const routeChildId =
    typeof router.query.childId === "string" ? router.query.childId : "";

  const [children, setChildren] = useState([]);
  const [selectedChildId, setSelectedChildId] = useState("");
  const [view, setView] = useState("week");
  const [progressRows, setProgressRows] = useState([]);
  const [activities, setActivities] = useState([]);
  const [childrenLoading, setChildrenLoading] = useState(true);
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [error, setError] = useState("");
  const [expandedGoals, setExpandedGoals] = useState({});
  const [entriesByProgressId, setEntriesByProgressId] = useState({});
  const [noteForm, setNoteForm] = useState({});
  const [savingNote, setSavingNote] = useState("");
  const [showAllGoals, setShowAllGoals] = useState(false);
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
          String(a.firstName || "").localeCompare(String(b.firstName || "")),
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
  }, [router, selectedChildId]);

  const loadChildRecords = useCallback(async (targetChildId, options = {}) => {
    if (!targetChildId) return;

    const { keepExisting = false } = options;

    setRecordsLoading(true);
    setError("");
    if (!keepExisting) {
      setProgressRows([]);
      setActivities([]);
      setEntriesByProgressId({});
    }

    try {
      const [progressRes, activityRes] = await Promise.all([
        apiJson(`/api/v1/progress?childId=${encodeURIComponent(targetChildId)}`),
        apiJson(`/api/v1/activities?childId=${encodeURIComponent(targetChildId)}`),
      ]);
      setProgressRows(Array.isArray(progressRes) ? progressRes : []);
      setActivities(Array.isArray(activityRes) ? activityRes : []);
      setLastSyncAt(new Date());
    } catch (e) {
      setError(e.message || "Failed to load progress");
      if (!keepExisting) {
        setProgressRows([]);
        setActivities([]);
      }
    } finally {
      setRecordsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!selectedChildId) {
      setProgressRows([]);
      setActivities([]);
      setEntriesByProgressId({});
      return;
    }
    loadChildRecords(selectedChildId);
  }, [selectedChildId, loadChildRecords]);

  useEffect(() => {
    setExpandedGoals({});
    setEntriesByProgressId({});
    setNoteForm({});
    setShowAllGoals(false);
  }, [selectedChildId]);

  const selectedChild = useMemo(
    () => children.find((child) => child.id === selectedChildId) || null,
    [children, selectedChildId],
  );

  const currentView = useMemo(
    () => VIEW_OPTIONS.find((item) => item.value === view) || VIEW_OPTIONS[0],
    [view],
  );

  const currentProgressRows = useMemo(
    () => getLatestProgressRows(progressRows),
    [progressRows],
  );

  const cutoffTime = useMemo(
    () => Date.now() - currentView.days * DAY_MS,
    [currentView.days],
  );

  const todayStartTime = useMemo(() => startOfDayTimestamp(new Date()), []);

  const filteredActivities = useMemo(
    () =>
      activities
        .filter((activity) => toTimestamp(activity.createdAt) >= cutoffTime)
        .sort((a, b) => toTimestamp(b.createdAt) - toTimestamp(a.createdAt))
        .slice(0, 6),
    [activities, cutoffTime],
  );

  const todayActivityCount = useMemo(
    () =>
      activities.filter((activity) => toTimestamp(activity.createdAt) >= todayStartTime)
        .length,
    [activities, todayStartTime],
  );

  const todayProgressCount = useMemo(
    () =>
      currentProgressRows.filter(
        (row) => toTimestamp(row.updatedAt || row.createdAt) >= todayStartTime,
      ).length,
    [currentProgressRows, todayStartTime],
  );

  const overview = useMemo(
    () => buildOverview(currentProgressRows),
    [currentProgressRows],
  );

  const domainSnapshot = useMemo(
    () => buildDomainSnapshot(currentProgressRows),
    [currentProgressRows],
  );

  const activeGoals = useMemo(
    () =>
      currentProgressRows
        .filter((row) => !["COMPLETED", "PASSED"].includes(row.status))
        .sort(compareGoals),
    [currentProgressRows],
  );

  const visibleGoals = useMemo(
    () => (showAllGoals ? activeGoals : activeGoals.slice(0, GOAL_PREVIEW_COUNT)),
    [activeGoals, showAllGoals],
  );

  const previewGoalIds = useMemo(() => {
    const pinned = activeGoals.slice(0, GOAL_PREVIEW_COUNT).map((row) => row.id);
    const expanded = Object.entries(expandedGoals)
      .filter(([, isOpen]) => Boolean(isOpen))
      .map(([progressId]) => progressId);
    return [...new Set([...pinned, ...expanded])];
  }, [activeGoals, expandedGoals]);

  useEffect(() => {
    let cancelled = false;

    async function loadGoalEntries() {
      if (!previewGoalIds.length) {
        setEntriesByProgressId({});
        return;
      }

      const results = await Promise.all(
        previewGoalIds.map((progressId) =>
          apiJson(`/api/v1/progress/${encodeURIComponent(progressId)}/entries`).catch(
            () => [],
          ),
        ),
      );

      if (cancelled) return;

      const next = {};
      previewGoalIds.forEach((progressId, index) => {
        next[progressId] = Array.isArray(results[index]) ? results[index] : [];
      });
      setEntriesByProgressId(next);
    }

    loadGoalEntries();
    return () => {
      cancelled = true;
    };
  }, [previewGoalIds]);

  const heroInsights = useMemo(
    () =>
      buildHeroInsights({
        child: selectedChild,
        overview,
        domainSnapshot,
        currentView,
        todayActivityCount,
        todayProgressCount,
        recentActivities: filteredActivities,
      }),
    [
      selectedChild,
      overview,
      domainSnapshot,
      currentView,
      todayActivityCount,
      todayProgressCount,
      filteredActivities,
    ],
  );

  const recommendations = useMemo(
    () =>
      buildRecommendations({
        child: selectedChild,
        domainSnapshot,
        activeGoals,
        overview,
      }),
    [selectedChild, domainSnapshot, activeGoals, overview],
  );

  const topRecommendation = recommendations[0] || null;
  const latestActivity = filteredActivities[0] || activities[0] || null;
  const initialLoading =
    recordsLoading && currentProgressRows.length === 0 && activities.length === 0;

  const messageHref = selectedChild
    ? buildParentMessageComposeHref({
        subject: `${selectedChild.firstName}'s progress`,
        message: `Hi, could you share a quick update on ${selectedChild.firstName}'s current goals?`,
      })
    : "/parent/messages";

  async function refreshProgressEntries(progressId) {
    const data = await apiJson(
      `/api/v1/progress/${encodeURIComponent(progressId)}/entries`,
    ).catch(() => []);
    setEntriesByProgressId((prev) => ({
      ...prev,
      [progressId]: Array.isArray(data) ? data : [],
    }));
  }

  async function submitNote(progressId) {
    const notes = String(noteForm[progressId] || "").trim();
    if (!notes) return;

    setSavingNote(progressId);
    setError("");

    try {
      await apiJson(`/api/v1/progress/${encodeURIComponent(progressId)}/entries`, {
        method: "POST",
        body: JSON.stringify({ status: "IN_PROGRESS", notes }),
      });
      setNoteForm((prev) => ({ ...prev, [progressId]: "" }));
      await Promise.all([
        loadChildRecords(selectedChildId, { keepExisting: true }),
        refreshProgressEntries(progressId),
      ]);
    } catch (e) {
      setError(e.message || "Failed to share note");
    } finally {
      setSavingNote("");
    }
  }

  return (
    <ParentLayout title="Progress">
      <div className="space-y-4">
        <ParentSurface className="relative overflow-hidden border-sky-100 bg-gradient-to-br from-sky-50 via-white to-emerald-50/80 p-0 shadow-[0_28px_80px_-48px_rgba(14,116,144,0.38)] dark:border-sky-900/60 dark:bg-gradient-to-br dark:from-slate-950 dark:via-slate-950 dark:to-sky-950/30">
          <div className="absolute -right-10 top-0 h-40 w-40 rounded-full bg-sky-200/45 blur-3xl dark:bg-sky-900/40" />
          <div className="absolute -bottom-12 left-0 h-40 w-40 rounded-full bg-emerald-200/45 blur-3xl dark:bg-emerald-900/30" />

          <div className="relative space-y-5 p-5 sm:p-6">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
              <div className="max-w-3xl">
                <div className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-white/80 px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.22em] text-sky-700 shadow-sm dark:border-sky-900/60 dark:bg-slate-900/90 dark:text-sky-200">
                  Parent progress
                </div>
                <h1 className="mt-3 text-2xl font-black tracking-tight text-slate-900 dark:text-slate-100 sm:text-3xl">
                  {selectedChild
                    ? `How is ${selectedChild.firstName} doing today?`
                    : "A calm progress view for parents"}
                </h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300">
                  See today&apos;s status first, then the learning areas, current goals,
                  recent classroom moments, and a few easy ideas for home.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <ParentButton
                  variant="soft"
                  onClick={() =>
                    selectedChildId &&
                    loadChildRecords(selectedChildId, { keepExisting: true })
                  }
                  disabled={!selectedChildId || recordsLoading}
                >
                  {recordsLoading ? "Refreshing..." : "Refresh"}
                </ParentButton>
                <ParentButton
                  href={
                    selectedChildId
                      ? `/parent/children?childId=${encodeURIComponent(selectedChildId)}`
                      : "/parent/children"
                  }
                  variant="secondary"
                >
                  Open daily reports
                </ParentButton>
              </div>
            </div>

            <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
              <div className="space-y-2">
                <div className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                  Choose child
                </div>
                {childrenLoading ? (
                  <div className="flex flex-wrap gap-2">
                    {Array.from({ length: 3 }, (_, index) => (
                      <div
                        key={index}
                        className="h-10 w-28 animate-pulse rounded-2xl border border-sky-100 bg-white/80 dark:border-slate-800 dark:bg-slate-900/80"
                      />
                    ))}
                  </div>
                ) : children.length === 0 ? (
                  <div className="text-sm text-slate-500 dark:text-slate-400">
                    No children are linked to this account yet.
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {children.map((child) => (
                      <ParentPill
                        key={child.id}
                        active={selectedChildId === child.id}
                        onClick={() => setSelectedChildId(child.id)}
                      >
                        {child.firstName} {child.lastName || ""}
                      </ParentPill>
                    ))}
                  </div>
                )}
              </div>

              <div className="self-start xl:self-auto">
                <div className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                  View
                </div>
                <div className="mt-2 inline-flex rounded-full border border-sky-100 bg-white/90 p-1 shadow-sm dark:border-slate-800 dark:bg-slate-900/90">
                  {VIEW_OPTIONS.map((option) => {
                    const active = option.value === view;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setView(option.value)}
                        className={[
                          "rounded-full px-4 py-2 text-sm font-bold transition-all",
                          active
                            ? "bg-sky-600 text-white shadow-sm"
                            : "text-slate-600 hover:bg-sky-50 hover:text-sky-700 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-sky-200",
                        ].join(" ")}
                      >
                        {option.shortLabel}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </ParentSurface>

        {error ? (
          <ParentSurface className="border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-200">
            {error}
          </ParentSurface>
        ) : null}

        {!childrenLoading && children.length === 0 ? (
          <ParentEmpty
            title="No child profile available yet"
            description="Once a child is linked to this parent account, progress updates will appear here."
          />
        ) : !selectedChild && !childrenLoading ? (
          <ParentEmpty
            title="Choose a child to see progress"
            description="Select a child above to open today&apos;s progress snapshot."
          />
        ) : initialLoading ? (
          <LoadingState />
        ) : selectedChild ? (
          <>
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.25fr)_360px]">
              <div className="relative overflow-hidden rounded-[32px] border border-sky-100 bg-gradient-to-br from-white via-sky-50/70 to-emerald-50/70 p-5 shadow-[0_28px_80px_-48px_rgba(14,116,144,0.3)] dark:border-sky-900/60 dark:bg-gradient-to-br dark:from-slate-950 dark:via-sky-950/25 dark:to-emerald-950/20">
                <div className="absolute -right-10 top-0 h-32 w-32 rounded-full bg-sky-200/40 blur-3xl dark:bg-sky-900/30" />
                <div className="absolute bottom-0 left-0 h-28 w-28 rounded-full bg-emerald-200/35 blur-3xl dark:bg-emerald-900/25" />

                <div className="relative space-y-5">
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0">
                      <div className="flex items-start gap-3">
                        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[20px] bg-sky-600 text-lg font-black text-white shadow-lg shadow-sky-200/70 dark:shadow-sky-950/50">
                          {initials(selectedChild.firstName, selectedChild.lastName)}
                        </div>
                        <div className="min-w-0">
                          <span
                            className={[
                              "inline-flex rounded-full border px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-[0.16em]",
                              overview.overallState.badge,
                            ].join(" ")}
                          >
                            {overview.overallState.label}
                          </span>
                          <h2 className="mt-3 text-[clamp(1.45rem,2.5vw,2.35rem)] font-black leading-tight tracking-tight text-slate-900 dark:text-slate-100">
                            {overview.headline}
                          </h2>
                          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300">
                            {overview.description}
                          </p>
                        </div>
                      </div>
                    </div>

                    {lastSyncAt ? (
                      <div className="rounded-full border border-white/70 bg-white/85 px-3 py-1 text-xs font-semibold text-slate-600 shadow-sm dark:border-slate-800 dark:bg-slate-900/85 dark:text-slate-300">
                        Synced {formatRelativeDateTime(lastSyncAt)}
                      </div>
                    ) : null}
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <HeroStat
                      label="Today"
                      value={todayActivityCount + todayProgressCount}
                      hint={
                        todayActivityCount + todayProgressCount === 1
                          ? "fresh update shared"
                          : "fresh updates shared"
                      }
                    />
                    <HeroStat
                      label="Active goals"
                      value={activeGoals.length}
                      hint="current areas being worked on"
                    />
                    <HeroStat
                      label="Support needed"
                      value={overview.failed}
                      hint={
                        overview.failed
                          ? "areas needing extra practice"
                          : "nothing urgent right now"
                      }
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                    {heroInsights.map((insight) => (
                      <InsightCard key={insight.title} insight={insight} />
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="rounded-[32px] border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                        Overall progress
                      </div>
                      <div className="mt-1 text-2xl font-black tracking-tight text-slate-900 dark:text-slate-100">
                        {overview.overallState.label}
                      </div>
                      <p className="mt-1 text-sm leading-5 text-slate-600 dark:text-slate-300">
                        A simple pulse based on current goals and statuses.
                      </p>
                    </div>
                    <ProgressRing
                      value={overview.score}
                      tone={overview.overallState.ring}
                    />
                  </div>

                  <div className="mt-5 space-y-3">
                    <QuickFact
                      label="Age"
                      value={formatChildAge(selectedChild.birthDate) || "Not added yet"}
                    />
                    <QuickFact
                      label="Latest classroom moment"
                      value={
                        latestActivity
                          ? formatRelativeDateTime(latestActivity.createdAt)
                          : "No recent activity yet"
                      }
                    />
                    <QuickFact
                      label="Top home tip"
                      value={
                        topRecommendation
                          ? topRecommendation.description
                          : "Small, playful practice at home is enough."
                      }
                    />
                  </div>
                </div>

                <div className="rounded-[32px] border border-sky-100 bg-white/95 p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/95">
                  <div className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                    Parent actions
                  </div>
                  <div className="mt-4 flex flex-col gap-2">
                    <ParentButton href={messageHref} variant="soft">
                      Message the teacher
                    </ParentButton>
                    <ParentButton
                      href={
                        selectedChildId
                          ? `/parent/children?childId=${encodeURIComponent(
                              selectedChildId,
                            )}&tab=daily_report`
                          : "/parent/children"
                      }
                      variant="secondary"
                    >
                      Review daily reports
                    </ParentButton>
                  </div>
                </div>
              </div>
            </div>

            <ParentSection
              title="Progress snapshot"
              description="A quick look across the learning areas the center is tracking right now."
              action={<SectionPill>{currentView.label}</SectionPill>}
              className="overflow-hidden border-sky-100 bg-white shadow-[0_18px_60px_-48px_rgba(14,116,144,0.3)] dark:border-slate-800 dark:bg-slate-900"
            >
              {domainSnapshot.length ? (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                  {domainSnapshot.map((domain) => (
                    <DomainCard key={domain.key} domain={domain} />
                  ))}
                </div>
              ) : (
                <ParentEmpty
                  title="No learning areas yet"
                  description="Progress areas will appear here once the center records goals for this child."
                />
              )}
            </ParentSection>

            <ParentSection
              title="Active goals"
              description="These are the main goals the center is working on now, with a warm summary of where each one stands."
              action={
                activeGoals.length > GOAL_PREVIEW_COUNT ? (
                  <button
                    type="button"
                    onClick={() => setShowAllGoals((current) => !current)}
                    className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-bold text-sky-700 transition hover:bg-sky-100 dark:border-sky-900/60 dark:bg-sky-950/40 dark:text-sky-200 dark:hover:bg-sky-950/70"
                  >
                    {showAllGoals ? "Show less" : `Show all ${activeGoals.length}`}
                  </button>
                ) : null
              }
              className="overflow-hidden border-emerald-100 bg-gradient-to-br from-white via-white to-emerald-50/30 shadow-[0_18px_60px_-48px_rgba(16,185,129,0.28)] dark:border-slate-800 dark:bg-gradient-to-br dark:from-slate-900 dark:via-slate-900 dark:to-emerald-950/20"
            >
              {currentProgressRows.length === 0 ? (
                <ParentEmpty
                  title="No goals have been added yet"
                  description="The first classroom progress goal will show up here when it is recorded."
                />
              ) : activeGoals.length === 0 ? (
                <ParentEmpty
                  title="Everything looks settled right now"
                  description="There are no active goals at the moment. New classroom goals will appear here automatically."
                />
              ) : (
                <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                  {visibleGoals.map((row) => (
                    <GoalCard
                      key={row.id}
                      row={row}
                      entries={entriesByProgressId[row.id]}
                      expanded={Boolean(expandedGoals[row.id])}
                      noteValue={noteForm[row.id] || ""}
                      saving={savingNote === row.id}
                      onToggle={() =>
                        setExpandedGoals((prev) => ({
                          ...prev,
                          [row.id]: !prev[row.id],
                        }))
                      }
                      onNoteChange={(value) =>
                        setNoteForm((prev) => ({ ...prev, [row.id]: value }))
                      }
                      onSubmit={() => submitNote(row.id)}
                    />
                  ))}
                </div>
              )}
            </ParentSection>

            <ParentSection
              title="Recent activities"
              description={`A light timeline of classroom moments from ${currentView.label.toLowerCase()}.`}
              action={<SectionPill>{currentView.label}</SectionPill>}
              className="overflow-hidden border-sky-100 bg-white shadow-[0_18px_60px_-48px_rgba(14,116,144,0.25)] dark:border-slate-800 dark:bg-slate-900"
            >
              {filteredActivities.length === 0 ? (
                <ParentEmpty
                  title={`No activities yet ${currentView.label.toLowerCase()}`}
                  description="New classroom moments will appear here as soon as they are shared."
                />
              ) : (
                <div className="space-y-3">
                  {filteredActivities.map((activity, index) => (
                    <ActivityTimelineItem
                      key={activity.id || `${activity.type}-${index}`}
                      activity={activity}
                      isLast={index === filteredActivities.length - 1}
                    />
                  ))}
                </div>
              )}
            </ParentSection>

            <ParentSection
              title="Insights for home"
              description="Short, encouraging ideas you can try at home without turning home time into homework."
              action={
                <ParentButton href={messageHref} variant="soft">
                  Ask a teacher
                </ParentButton>
              }
              className="overflow-hidden border-amber-100 bg-gradient-to-br from-white via-amber-50/30 to-emerald-50/30 shadow-[0_18px_60px_-48px_rgba(217,119,6,0.18)] dark:border-slate-800 dark:bg-gradient-to-br dark:from-slate-900 dark:via-amber-950/15 dark:to-emerald-950/15"
            >
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
                {recommendations.map((recommendation) => (
                  <RecommendationCard
                    key={recommendation.title}
                    recommendation={recommendation}
                  />
                ))}
              </div>
            </ParentSection>
          </>
        ) : null}
      </div>
    </ParentLayout>
  );
}

function LoadingState() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.25fr)_360px]">
        {Array.from({ length: 2 }, (_, index) => (
          <div
            key={index}
            className="h-72 animate-pulse rounded-[32px] border border-slate-200 bg-white/80 dark:border-slate-800 dark:bg-slate-900/80"
          />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div
            key={index}
            className="h-44 animate-pulse rounded-[28px] border border-slate-200 bg-white/80 dark:border-slate-800 dark:bg-slate-900/80"
          />
        ))}
      </div>
      <div className="h-80 animate-pulse rounded-[32px] border border-slate-200 bg-white/80 dark:border-slate-800 dark:bg-slate-900/80" />
    </div>
  );
}

function HeroStat({ label, value, hint }) {
  return (
    <div className="rounded-[22px] border border-white/80 bg-white/80 px-4 py-3 shadow-sm dark:border-slate-800 dark:bg-slate-900/90">
      <div className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
        {label}
      </div>
      <div className="mt-2 text-[clamp(1.3rem,2.4vw,1.8rem)] font-black leading-tight tracking-tight text-slate-900 dark:text-slate-100">
        {value}
      </div>
      <div className="mt-1 text-xs leading-5 text-slate-600 dark:text-slate-300">
        {hint}
      </div>
    </div>
  );
}

function InsightCard({ insight }) {
  return (
    <div className={`rounded-[24px] border p-4 shadow-sm ${insight.tone}`}>
      <div className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
        {insight.tag}
      </div>
      <div className="mt-2 text-sm font-black tracking-tight text-slate-900 dark:text-slate-100">
        {insight.title}
      </div>
      <div className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">
        {insight.description}
      </div>
    </div>
  );
}

function ProgressRing({ value, tone }) {
  const safeValue = Math.max(0, Math.min(100, Number(value || 0)));
  const track = tone === "rose" ? "#fb7185" : tone === "amber" ? "#f59e0b" : "#10b981";
  const style = {
    background: `conic-gradient(${track} ${safeValue * 3.6}deg, rgba(148, 163, 184, 0.16) 0deg)`,
  };

  return (
    <div className="relative h-28 w-28 shrink-0">
      <div className="absolute inset-0 rounded-full" style={style} />
      <div className="absolute inset-[10px] rounded-full bg-white dark:bg-slate-900" />
      <div className="relative flex h-full w-full flex-col items-center justify-center">
        <div className="text-2xl font-black tracking-tight text-slate-900 dark:text-slate-100">
          {safeValue}%
        </div>
        <div className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
          Pulse
        </div>
      </div>
    </div>
  );
}

function QuickFact({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-[18px] border border-slate-200 bg-slate-50/80 px-3.5 py-3 dark:border-slate-800 dark:bg-slate-950/80">
      <div className="text-xs font-extrabold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
        {label}
      </div>
      <div className="max-w-[16rem] text-right text-sm leading-5 text-slate-700 dark:text-slate-200">
        {value}
      </div>
    </div>
  );
}

function SectionPill({ children }) {
  return (
    <span className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-bold text-sky-700 dark:border-sky-900/60 dark:bg-sky-950/40 dark:text-sky-200">
      {children}
    </span>
  );
}

function DomainCard({ domain }) {
  const meta = DOMAIN_META[domain.key] || DOMAIN_META.thinking;

  return (
    <article className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800 dark:bg-slate-950/90">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
            Learning area
          </div>
          <h3 className="mt-2 text-lg font-black tracking-tight text-slate-900 dark:text-slate-100">
            {meta.label}
          </h3>
        </div>
        <div
          className={[
            "flex h-10 w-10 items-center justify-center rounded-2xl text-xs font-black shadow-sm",
            meta.codeClasses,
          ].join(" ")}
        >
          {meta.code}
        </div>
      </div>

      <div className="mt-4 flex items-end justify-between gap-3">
        <div>
          <div className="text-3xl font-black tracking-tight text-slate-900 dark:text-slate-100">
            {domain.progress}%
          </div>
          <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            {domain.summary}
          </div>
        </div>
        <span
          className={[
            "inline-flex rounded-full border px-2.5 py-1 text-[11px] font-bold",
            domain.status.badge,
          ].join(" ")}
        >
          {domain.status.label}
        </span>
      </div>

      <div className="mt-4 h-2.5 rounded-full bg-slate-100 dark:bg-slate-800">
        <div
          className={`h-full rounded-full bg-gradient-to-r ${meta.progress}`}
          style={{ width: `${domain.progress}%` }}
        />
      </div>

      <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500 dark:text-slate-400">
        <span>{domain.total} current goal{domain.total === 1 ? "" : "s"}</span>
        {domain.latestAt ? (
          <span>Updated {formatRelativeDateTime(domain.latestAt)}</span>
        ) : null}
      </div>
    </article>
  );
}

function GoalCard({
  row,
  entries,
  expanded,
  noteValue,
  saving,
  onToggle,
  onNoteChange,
  onSubmit,
}) {
  const domain = DOMAIN_META[inferDomainKey(row)] || DOMAIN_META.thinking;
  const status = STATUS_META[row.status] || STATUS_META.NOT_STARTED;
  const staffNote = findStaffNote(entries);

  return (
    <article
      className={[
        "rounded-[28px] border p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md",
        status.card,
      ].join(" ")}
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={[
                  "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-bold",
                  domain.chip,
                ].join(" ")}
              >
                <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-white/80 text-[9px] font-black dark:bg-slate-900/80">
                  {domain.code}
                </span>
                <span>{domain.label}</span>
              </span>
              <span
                className={[
                  "inline-flex rounded-full border px-2.5 py-1 text-[11px] font-bold",
                  status.badge,
                ].join(" ")}
              >
                {status.label}
              </span>
            </div>

            <h3 className="mt-3 text-lg font-black tracking-tight text-slate-900 dark:text-slate-100">
              {row.lessonGoal?.title || row.lesson?.title || "Current goal"}
            </h3>
            <p className="mt-1 text-sm leading-5 text-slate-600 dark:text-slate-300">
              {row.lesson?.title && row.lessonGoal?.title
                ? `Working inside ${row.lesson.title}.`
                : status.summary}
            </p>
          </div>

          <button
            type="button"
            onClick={onToggle}
            className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 transition hover:border-sky-200 hover:bg-sky-50 hover:text-sky-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:border-sky-900/60 dark:hover:bg-sky-950/40 dark:hover:text-sky-200"
          >
            {expanded ? "Hide details" : "View details"}
          </button>
        </div>

        <div className="rounded-[22px] border border-slate-200 bg-slate-50/80 p-3.5 dark:border-slate-800 dark:bg-slate-950/70">
          <div className="flex items-center justify-between gap-3 text-[11px] font-extrabold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
            <span>Goal progress</span>
            <span>{status.progress}%</span>
          </div>
          <div className="mt-2 h-2.5 rounded-full bg-white dark:bg-slate-800">
            <div
              className={`h-full rounded-full ${status.bar}`}
              style={{ width: `${status.progress}%` }}
            />
          </div>
          <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span>Step {row.goalIndex || 1}</span>
            <span>Updated {formatRelativeDateTime(row.updatedAt || row.createdAt)}</span>
          </div>
        </div>

        {staffNote ? (
          <div className="rounded-[22px] border border-slate-200 bg-white/90 p-3.5 dark:border-slate-800 dark:bg-slate-950/80">
            <div className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
              Teacher note
            </div>
            <p className="mt-2 text-sm leading-6 text-slate-700 dark:text-slate-200">
              {staffNote.notes}
            </p>
            <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              Shared {formatRelativeDateTime(staffNote.occurredAt)}
            </div>
          </div>
        ) : null}

        {expanded ? (
          <div className="space-y-3 border-t border-slate-200 pt-4 dark:border-slate-800">
            <div className="rounded-[22px] border border-slate-200 bg-slate-50/70 p-3.5 dark:border-slate-800 dark:bg-slate-950/70">
              <ProgressEntryTimeline
                progressId={row.id}
                entries={Array.isArray(entries) ? entries : undefined}
              />
            </div>

            <div className="rounded-[22px] border border-slate-200 bg-white p-3.5 dark:border-slate-800 dark:bg-slate-950">
              <div className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                Add a note for the teacher
              </div>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <input
                  type="text"
                  className="flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 shadow-sm transition focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-sky-700 dark:focus:ring-sky-950"
                  placeholder="Share a quick note or question..."
                  value={noteValue}
                  onChange={(event) => onNoteChange(event.target.value)}
                  disabled={saving}
                />
                <button
                  type="button"
                  onClick={onSubmit}
                  disabled={saving || !String(noteValue || "").trim()}
                  className="rounded-2xl bg-sky-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving ? "Sending..." : "Send note"}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </article>
  );
}

function ActivityTimelineItem({ activity, isLast }) {
  const meta = activityMeta(activity.type);
  const mediaCount = extractMediaUrls(activity).length;

  return (
    <div className="relative pl-11">
      {!isLast ? (
        <div className="absolute left-[15px] top-9 bottom-[-18px] w-px bg-sky-100 dark:bg-sky-950/70" />
      ) : null}

      <div
        className={[
          "absolute left-0 top-1 flex h-8 w-8 items-center justify-center rounded-full text-[10px] font-black shadow-sm",
          meta.bubble,
        ].join(" ")}
      >
        {meta.code}
      </div>

      <article className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950/90">
        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <h3 className="text-sm font-black tracking-tight text-slate-900 dark:text-slate-100">
              {activityTitle(activity)}
            </h3>
            <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">
              {activityDescription(activity)}
            </p>
          </div>
          <div className="shrink-0 text-xs font-semibold text-slate-500 dark:text-slate-400">
            {formatTimelineTime(activity.createdAt)}
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <TimelinePill>{dayPartLabel(activity.createdAt)}</TimelinePill>
          {activity.recordedBy?.name ? (
            <TimelinePill>Shared by {activity.recordedBy.name}</TimelinePill>
          ) : null}
          {mediaCount ? (
            <TimelinePill>
              {mediaCount} attachment{mediaCount === 1 ? "" : "s"}
            </TimelinePill>
          ) : null}
        </div>
      </article>
    </div>
  );
}

function TimelinePill({ children }) {
  return (
    <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
      {children}
    </span>
  );
}

function RecommendationCard({ recommendation }) {
  return (
    <article className={`rounded-[26px] border p-4 shadow-sm ${recommendation.tone}`}>
      <div className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
        {recommendation.tag}
      </div>
      <div className="mt-2 text-sm font-black tracking-tight text-slate-900 dark:text-slate-100">
        {recommendation.title}
      </div>
      <div className="mt-2 text-sm leading-6 text-slate-700 dark:text-slate-200">
        {recommendation.description}
      </div>
    </article>
  );
}

function buildOverview(rows) {
  const total = rows.length;
  const completed = rows.filter((row) =>
    ["COMPLETED", "PASSED"].includes(row.status),
  ).length;
  const inProgress = rows.filter((row) => row.status === "IN_PROGRESS").length;
  const failed = rows.filter((row) => row.status === "FAILED").length;
  const weighted = rows.reduce(
    (sum, row) => sum + (STATUS_META[row.status]?.weight ?? STATUS_META.NOT_STARTED.weight),
    0,
  );
  const score = total ? Math.round((weighted / total) * 100) : 0;

  let overallState = {
    label: "Waiting for updates",
    badge:
      "border-stone-200 bg-stone-50 text-stone-700 dark:border-stone-700 dark:bg-stone-900/60 dark:text-stone-200",
    ring: "amber",
  };
  let headline = "Waiting for the first progress update";
  let description =
    "The center has not shared a development goal yet. Once they do, this page will turn into a quick daily snapshot.";

  if (total > 0) {
    if (failed > 0) {
      overallState = {
        label: "Needs support",
        badge:
          "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200",
        ring: "rose",
      };
      headline =
        failed > 1
          ? "A few areas need extra support right now"
          : "One goal needs a little extra support right now";
      description =
        "There is still progress happening, but one or more goals need a gentler pace, repetition, or closer teacher support.";
    } else if (score >= 82 || completed >= Math.max(1, total - 1)) {
      overallState = {
        label: "On track",
        badge:
          "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-200",
        ring: "emerald",
      };
      headline = "Doing great this week";
      description =
        "Most current goals are moving smoothly, with steady classroom practice and no urgent concerns showing up.";
    } else {
      overallState = {
        label: "Improving",
        badge:
          "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200",
        ring: "amber",
      };
      headline = "Making steady progress right now";
      description =
        "There is active growth in progress, and the current goals are moving forward with continued practice and support.";
    }
  }

  return { total, completed, inProgress, failed, score, overallState, headline, description };
}

function buildDomainSnapshot(rows) {
  const grouped = new Map();

  for (const row of rows) {
    const key = inferDomainKey(row);
    const current = grouped.get(key) || {
      key,
      total: 0,
      score: 0,
      completed: 0,
      inProgress: 0,
      failed: 0,
      latestAt: null,
    };

    current.total += 1;
    current.score +=
      STATUS_META[row.status]?.weight ?? STATUS_META.NOT_STARTED.weight;

    if (row.status === "FAILED") current.failed += 1;
    else if (row.status === "IN_PROGRESS") current.inProgress += 1;
    else if (["COMPLETED", "PASSED"].includes(row.status)) current.completed += 1;

    const timestamp = toTimestamp(row.updatedAt || row.createdAt);
    if (!current.latestAt || timestamp > toTimestamp(current.latestAt)) {
      current.latestAt = row.updatedAt || row.createdAt;
    }

    grouped.set(key, current);
  }

  return DOMAIN_ORDER.map((key) => grouped.get(key))
    .filter(Boolean)
    .map((item) => {
      const progress = item.total
        ? Math.round((item.score / item.total) * 100)
        : 0;
      const status =
        item.failed > 0
          ? STATUS_META.FAILED
          : item.completed === item.total
            ? STATUS_META.COMPLETED
            : item.inProgress > 0 || progress >= 55
              ? STATUS_META.IN_PROGRESS
              : STATUS_META.NOT_STARTED;

      return {
        ...item,
        progress,
        status,
        summary:
          item.failed > 0
            ? "Needs extra practice"
            : item.completed === item.total
              ? "Strong and settled"
              : item.inProgress > 0
                ? "Moving forward"
                : "Ready for more updates",
      };
    });
}

function buildHeroInsights({
  child,
  overview,
  domainSnapshot,
  currentView,
  todayActivityCount,
  todayProgressCount,
  recentActivities,
}) {
  const childName = child?.firstName || "Your child";
  const strongest =
    domainSnapshot
      .filter((domain) => domain.progress >= 70)
      .sort((a, b) => b.progress - a.progress)[0] || null;
  const focus =
    domainSnapshot
      .filter((domain) => domain.failed > 0 || domain.progress < 60)
      .sort((a, b) => a.progress - b.progress)[0] || null;

  const cards = [];

  if (strongest) {
    const meta = DOMAIN_META[strongest.key] || DOMAIN_META.thinking;
    cards.push({
      tag: "Strong area",
      title: meta.label,
      description: `${childName} is showing steady confidence in ${meta.insightLabel}.`,
      tone:
        "border-emerald-200 bg-emerald-50/80 dark:border-emerald-900/60 dark:bg-emerald-950/30",
    });
  }

  if (focus) {
    const meta = DOMAIN_META[focus.key] || DOMAIN_META.thinking;
    cards.push({
      tag: "Focus area",
      title: meta.label,
      description: `${childName} may need a little more support in ${meta.insightLabel} right now.`,
      tone:
        "border-amber-200 bg-amber-50/80 dark:border-amber-900/60 dark:bg-amber-950/30",
    });
  }

  if (cards.length < 2) {
    cards.push({
      tag: "Fresh updates",
      title: `${todayActivityCount + todayProgressCount} new today`,
      description:
        todayActivityCount + todayProgressCount > 0
          ? "There has been new activity or goal movement shared today."
          : "No new update has been shared today yet, but this view stays ready for it.",
      tone:
        "border-sky-200 bg-sky-50/80 dark:border-sky-900/60 dark:bg-sky-950/30",
    });
  }

  if (cards.length < 2) {
    cards.push({
      tag: currentView.label,
      title: `${recentActivities.length} classroom moments`,
      description:
        recentActivities.length > 0
          ? "The timeline below shows the latest classroom moments at a glance."
          : "New classroom moments will appear below as soon as they are shared.",
      tone:
        "border-sky-200 bg-sky-50/80 dark:border-sky-900/60 dark:bg-sky-950/30",
    });
  }

  if (cards.length < 2) {
    cards.push({
      tag: "Progress",
      title: `${overview.completed} goal${overview.completed === 1 ? "" : "s"} on track`,
      description: "Current goals are being checked against what matters most right now.",
      tone:
        "border-emerald-200 bg-emerald-50/80 dark:border-emerald-900/60 dark:bg-emerald-950/30",
    });
  }

  return cards.slice(0, 2);
}

function buildRecommendations({ child, domainSnapshot, activeGoals, overview }) {
  const childName = child?.firstName || "your child";
  const ageMonths = ageInMonths(child?.birthDate);
  const weakest =
    domainSnapshot
      .filter((item) => item.total > 0)
      .sort((a, b) => a.progress - b.progress)[0] || null;
  const strongest =
    domainSnapshot
      .filter((item) => item.total > 0)
      .sort((a, b) => b.progress - a.progress)[0] || null;

  const items = [];

  if (weakest) {
    const meta = DOMAIN_META[weakest.key] || DOMAIN_META.thinking;
    items.push({
      tag: "Try at home",
      title: `A small ${meta.label.toLowerCase()} moment`,
      description: recommendationForDomain(meta.key, ageMonths),
      tone:
        "border-amber-200 bg-white/90 dark:border-amber-900/60 dark:bg-slate-950/80",
    });
  }

  items.push({
    tag: "Keep it simple",
    title: "Short, warm practice works best",
    description:
      overview.failed > 0
        ? `A few calm minutes of repetition and praise can help ${childName} feel safer trying again.`
        : "Five to ten minutes of playful repetition is enough. Small wins matter more than long sessions.",
    tone:
      "border-emerald-200 bg-white/90 dark:border-emerald-900/60 dark:bg-slate-950/80",
  });

  if (strongest) {
    const meta = DOMAIN_META[strongest.key] || DOMAIN_META.thinking;
    items.push({
      tag: "Celebrate",
      title: `Build on ${meta.label.toLowerCase()}`,
      description: celebrationTip(meta.key, childName),
      tone:
        "border-sky-200 bg-white/90 dark:border-sky-900/60 dark:bg-slate-950/80",
    });
  } else if (activeGoals.length) {
    items.push({
      tag: "Ask the teacher",
      title: "Request one clear next step",
      description:
        "If you want to help at home, ask the teacher for the one goal that would make the biggest difference this week.",
      tone:
        "border-sky-200 bg-white/90 dark:border-sky-900/60 dark:bg-slate-950/80",
    });
  }

  return items.slice(0, 3);
}

function recommendationForDomain(domainKey, ageMonths) {
  const isInfant = ageMonths !== null && ageMonths < 12;
  const isToddler = ageMonths !== null && ageMonths >= 12 && ageMonths < 36;

  if (domainKey === "communication") {
    if (isInfant) return "Talk through everyday routines, copy sounds, and pause so your child can answer back in their own way.";
    if (isToddler) return "Name familiar objects during meals, bath time, or walks, then invite your child to point, copy, or repeat.";
    return "Try short story time, naming games, or asking simple choice questions that invite a spoken answer.";
  }

  if (domainKey === "social") {
    if (isInfant) return "Use face-to-face play, smiles, and gentle turn-taking sounds to build connection and shared attention.";
    if (isToddler) return "Practice turn-taking with a toy, a song, or a short back-and-forth game and celebrate every calm try.";
    return "Use pretend play, sharing games, or simple routines like greeting and cleanup to support social confidence.";
  }

  if (domainKey === "motor") {
    if (isInfant) return "A little tummy time, reaching, and safe floor play can build strength in small, reassuring bursts.";
    if (isToddler) return "Try stacking, play dough, ball play, or easy obstacle games for a few playful minutes.";
    return "Cutting practice, drawing, dance, hopping, or building games can support both fine and gross motor growth.";
  }

  if (domainKey === "creative") {
    return "Offer music, drawing, pretend play, or open-ended materials and let curiosity lead the pace.";
  }

  if (isInfant) return "Simple sensory play, peekaboo, and naming what is happening can gently build thinking skills.";
  if (isToddler) return "Sorting colors, matching shapes, and counting small objects can make thinking practice feel like play.";
  return "Try counting, matching, simple puzzles, or sorting games to build problem-solving in a playful way.";
}

function celebrationTip(domainKey, childName) {
  if (domainKey === "communication") {
    return `Invite ${childName} to tell you about one favorite part of the day, even in a few words or gestures.`;
  }
  if (domainKey === "social") {
    return `Notice and praise kind moments, turn-taking, or calm transitions so ${childName} keeps feeling confident.`;
  }
  if (domainKey === "motor") {
    return `Offer a playful challenge like throwing a ball, drawing a shape, or building a tower and celebrate the effort.`;
  }
  if (domainKey === "creative") {
    return `Give ${childName} room to choose colors, sounds, or pretend roles and follow their lead for a few minutes.`;
  }
  return `Use puzzles, matching, or counting games and let ${childName} show you how they want to solve them.`;
}

function getLatestProgressRows(rows) {
  const map = new Map();

  for (const row of rows) {
    const existing = map.get(row.lessonId);
    if (!existing) {
      map.set(row.lessonId, row);
      continue;
    }

    const goalA = Number(existing.goalIndex || 0);
    const goalB = Number(row.goalIndex || 0);
    if (goalB > goalA) {
      map.set(row.lessonId, row);
      continue;
    }

    if (
      goalB === goalA &&
      toTimestamp(row.updatedAt || row.createdAt) >
        toTimestamp(existing.updatedAt || existing.createdAt)
    ) {
      map.set(row.lessonId, row);
    }
  }

  return [...map.values()].sort(
    (a, b) =>
      toTimestamp(b.updatedAt || b.createdAt) - toTimestamp(a.updatedAt || a.createdAt),
  );
}

function compareGoals(a, b) {
  const priority = (row) => {
    if (row.status === "FAILED") return 0;
    if (row.status === "IN_PROGRESS") return 1;
    if (row.status === "NOT_STARTED") return 2;
    return 3;
  };

  const priorityDiff = priority(a) - priority(b);
  if (priorityDiff !== 0) return priorityDiff;

  return (
    toTimestamp(b.updatedAt || b.createdAt) - toTimestamp(a.updatedAt || a.createdAt)
  );
}

function inferDomainKey(row) {
  const haystack = `${String(row?.lesson?.category?.name || "").toLowerCase()} ${String(
    row?.lesson?.title || "",
  ).toLowerCase()}`;

  if (
    haystack.includes("social") ||
    haystack.includes("emotion") ||
    haystack.includes("behavior")
  ) {
    return "social";
  }
  if (
    haystack.includes("physical") ||
    haystack.includes("motor") ||
    haystack.includes("movement")
  ) {
    return "motor";
  }
  if (
    haystack.includes("language") ||
    haystack.includes("literacy") ||
    haystack.includes("reading") ||
    haystack.includes("phonics") ||
    haystack.includes("communication")
  ) {
    return "communication";
  }
  if (
    haystack.includes("creative") ||
    haystack.includes("art") ||
    haystack.includes("music")
  ) {
    return "creative";
  }
  return "thinking";
}

function findStaffNote(entries) {
  if (!Array.isArray(entries)) return null;
  return (
    entries.find(
      (entry) =>
        String(entry?.notes || "").trim() &&
        ["TEACHER", "ADMIN", "COACH"].includes(entry?.recordedBy?.role),
    ) || null
  );
}

function activityMeta(type) {
  if (["MEAL", "SNACK", "BOTTLE"].includes(type)) {
    return {
      code: "FO",
      bubble:
        "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-200",
    };
  }
  if (type === "NAP") {
    return {
      code: "RS",
      bubble:
        "bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-200",
    };
  }
  if (type === "DIAPER_CHANGE") {
    return {
      code: "CR",
      bubble:
        "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-200",
    };
  }
  if (type === "ACTIVITY") {
    return {
      code: "AC",
      bubble:
        "bg-sky-100 text-sky-700 dark:bg-sky-950/60 dark:text-sky-200",
    };
  }
  if (type === "BEHAVIOR") {
    return {
      code: "BV",
      bubble:
        "bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-950/60 dark:text-fuchsia-200",
    };
  }
  return {
    code: "UP",
    bubble:
      "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
  };
}

function activityTitle(activity) {
  if (activity?.type === "ACTIVITY") return "Classroom activity";
  if (activity?.type === "NAP") return "Rest time";
  if (activity?.type === "DIAPER_CHANGE") return "Care routine";
  if (["MEAL", "SNACK", "BOTTLE"].includes(activity?.type)) return "Meals and nutrition";
  if (activity?.type === "BEHAVIOR") return "Behavior update";
  return "Classroom update";
}

function activityDescription(activity) {
  const note = String(activity?.notes || "").trim();
  if (note) return note;

  const details =
    activity?.details &&
    typeof activity.details === "object" &&
    !Array.isArray(activity.details)
      ? activity.details
      : {};

  if (activity?.type === "NAP") {
    if (details.startTime && details.endTime) {
      return `Rest time was logged from ${details.startTime} to ${details.endTime}.`;
    }
    return "Rest time was logged for the day.";
  }
  if (activity?.type === "DIAPER_CHANGE") return "A care routine update was recorded.";
  if (["MEAL", "SNACK", "BOTTLE"].includes(activity?.type)) {
    if (details.meal && details.quantity) {
      return `${details.meal} was recorded with quantity marked as ${String(details.quantity).toLowerCase()}.`;
    }
    if (details.meal) return `${details.meal} was served and recorded.`;
    return "A meal or bottle update was shared.";
  }
  if (activity?.type === "ACTIVITY") return "A classroom learning moment was shared.";
  if (activity?.type === "BEHAVIOR") return "A behavior or regulation update was shared.";
  return "A new classroom note was added.";
}

function extractMediaUrls(activity) {
  const details =
    activity?.details &&
    typeof activity.details === "object" &&
    !Array.isArray(activity.details)
      ? activity.details
      : {};
  const raw = Array.isArray(details.media) ? details.media : [];
  return raw
    .map((item) =>
      typeof item === "string" ? item.trim() : String(item?.url || "").trim(),
    )
    .filter(Boolean);
}

function formatChildAge(birthDate) {
  const age = formatAge(birthDate);
  return age ? `${age} old` : "";
}

function formatTimelineTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function formatRelativeDateTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  const now = new Date();
  const startToday = startOfDayTimestamp(now);
  const startTarget = startOfDayTimestamp(date);
  const diffDays = Math.round((startToday - startTarget) / DAY_MS);

  if (diffDays === 0) return `today at ${formatTime(date)}`;
  if (diffDays === 1) return `yesterday at ${formatTime(date)}`;
  return formatTimelineTime(date);
}

function dayPartLabel(value) {
  if (!value) return "Update";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Update";
  if (date.getHours() < 12) return "Morning";
  if (date.getHours() < 17) return "Afternoon";
  return "Evening";
}

function formatTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function initials(firstName, lastName) {
  const first = String(firstName || "").trim().slice(0, 1).toUpperCase();
  const last = String(lastName || "").trim().slice(0, 1).toUpperCase();
  return `${first}${last}` || "C";
}

function toTimestamp(value) {
  if (!value) return 0;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function startOfDayTimestamp(value) {
  const date = new Date(value);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}
