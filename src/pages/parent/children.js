import ParentLayout from "@/components/parent/ParentLayout";
import CatchupPlansPanel from "@/components/reports/CatchupPlansPanel";
import MilestoneCalendarPanel from "@/components/reports/MilestoneCalendarPanel";
import Skeleton, { SkeletonCard } from "@/components/ui/Skeleton";
import EmptyState from "@/components/ui/EmptyState";
import { apiJson } from "@/lib/api";
import Link from "next/link";
import { useRouter } from "next/router";
import { useCallback, useEffect, useMemo, useState } from "react";

export default function ParentChildren() {
  const [children, setChildren] = useState([]);
  const [selectedChildId, setSelectedChildId] = useState("");
  const [activities, setActivities] = useState([]);
  const [progressRows, setProgressRows] = useState([]);
  const [childrenLoading, setChildrenLoading] = useState(true);
  const [activitiesLoading, setActivitiesLoading] = useState(false);
  const [progressLoading, setProgressLoading] = useState(false);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("DAILY_REPORT");
  const [lastSyncAt, setLastSyncAt] = useState(null);
  const router = useRouter();

  useEffect(() => {
    (async () => {
      setChildrenLoading(true);
      setError("");
      try {
        const kids = await apiJson("/api/v1/children");
        const sortedKids = (Array.isArray(kids) ? kids : []).sort((a, b) =>
          (a.firstName || "").localeCompare(b.firstName || ""),
        );
        setChildren(sortedKids);

        const routeChildId =
          typeof router.query.childId === "string" ? router.query.childId : "";
        const hasRouteChild = sortedKids.some((ch) => ch.id === routeChildId);
        setSelectedChildId(
          hasRouteChild ? routeChildId : (sortedKids[0] && sortedKids[0].id) || "",
        );
      } catch (e) {
        setError(e.message || "Failed to load children");
      } finally {
        setChildrenLoading(false);
      }
    })();
  }, [router.query.childId]);

  const loadChildRecords = useCallback(async (targetChildId, silent = false) => {
    if (!targetChildId) {
      setActivities([]);
      setProgressRows([]);
      return;
    }
    if (!silent) {
      setActivitiesLoading(true);
      setProgressLoading(true);
    }
    setError("");
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
      if (!silent) {
        setActivitiesLoading(false);
        setProgressLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    if (!selectedChildId) {
      setActivities([]);
      setProgressRows([]);
      return;
    }
    loadChildRecords(selectedChildId);
  }, [selectedChildId, loadChildRecords]);

  useEffect(() => {
    if (!selectedChildId) return;
    const id = setInterval(() => {
      loadChildRecords(selectedChildId, true);
    }, 20000);
    return () => clearInterval(id);
  }, [selectedChildId, loadChildRecords]);

  const selectedChild = useMemo(
    () => children.find((ch) => ch.id === selectedChildId) || null,
    [children, selectedChildId],
  );

  const activityFeed = useMemo(() => {
    return [...activities]
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 20);
  }, [activities]);

  const diaperPotty = useMemo(() => {
    return activityFeed.filter((a) => a.type === "DIAPER_CHANGE").slice(0, 5);
  }, [activityFeed]);

  const mealsNutrition = useMemo(() => {
    return activityFeed
      .filter((a) => ["MEAL", "SNACK", "BOTTLE"].includes(a.type))
      .slice(0, 5);
  }, [activityFeed]);

  const tabList = [
    { key: "DAILY_REPORT", label: "Daily Report" },
    { key: "PROGRESS_REPORT", label: "Progress Report" },
    { key: "STEPS", label: "Steps of Progression" },
    { key: "CATCHUP", label: "Catch-up Plans" },
    { key: "MILESTONE", label: "Milestone Calendar" },
  ];

  return (
    <ParentLayout title="My Children">
      <div className="space-y-4">
        <div className="rounded-2xl border border-gray-200 bg-white p-5">
          <h2 className="text-lg font-extrabold text-gray-900">My Children</h2>
          <p className="mt-1 text-sm text-gray-600">
            Click a child to open the detailed daily view.
          </p>

          {error ? (
            <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              <span>{error}</span>
              <button
                type="button"
                onClick={() => { setError(""); loadChildRecords(selectedChildId); }}
                className="shrink-0 rounded-lg bg-red-100 px-3 py-1 text-xs font-semibold text-red-700 hover:bg-red-200 transition"
              >
                Retry
              </button>
            </div>
          ) : null}

          {childrenLoading ? (
            <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-4 lg:grid-cols-6">
              {Array.from({ length: 4 }, (_, i) => (
                <Skeleton key={i} variant="card" className="h-16 rounded-xl" />
              ))}
            </div>
          ) : children.length === 0 ? (
            <EmptyState
              title="No children found"
              description="No children are linked to your account yet. Please contact your center administrator."
              className="mt-4"
            />
          ) : (
            <div className="mt-4 space-y-4">
              <div className="flex flex-wrap gap-2">
                {children.map((ch) => {
                  const active = ch.id === selectedChildId;
                  const childInitials = initials(ch.firstName, ch.lastName);
                  return (
                    <button
                      key={ch.id}
                      type="button"
                      onClick={() => setSelectedChildId(ch.id)}
                      className={[
                        "flex items-center gap-2.5 rounded-2xl border px-3 py-2 text-left transition-all duration-150",
                        active
                          ? "border-sky-300 bg-sky-50 shadow-sm ring-2 ring-sky-200"
                          : "border-gray-200 bg-white hover:border-sky-200 hover:bg-sky-50/50",
                      ].join(" ")}
                    >
                      <div className={[
                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-extrabold",
                        active ? "bg-sky-500 text-white" : "bg-gray-100 text-gray-600",
                      ].join(" ")}>
                        {childInitials}
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-extrabold text-gray-900">
                          {ch.firstName} {ch.lastName || ""}
                        </div>
                        {active && (
                          <div className="text-[10px] font-semibold text-sky-600">Selected</div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>

              {selectedChild ? (
                <div className="rounded-2xl border border-gray-200 bg-white p-4">
                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_260px]">
                    <div className="rounded-2xl bg-gradient-to-r from-sky-50 to-cyan-50 p-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-white text-sm font-extrabold text-sky-700">
                          {initials(selectedChild.firstName, selectedChild.lastName)}
                        </div>
                        <div className="min-w-0">
                          <div className="truncate text-base font-extrabold text-gray-900">
                            {selectedChild.firstName} {selectedChild.lastName || ""}
                          </div>
                          <div className="mt-1 text-xs text-gray-600">
                            DOB: {formatDate(selectedChild.birthDate)}
                          </div>
                          {selectedChild.enrollmentStartDate && (
                            <div className="mt-1 text-xs text-gray-600">
                              Enrolled: {formatDate(selectedChild.enrollmentStartDate)}
                              {selectedChild.enrollmentEndDate
                                ? ` — ${formatDate(selectedChild.enrollmentEndDate)}`
                                : " — Present"}
                            </div>
                          )}
                          {selectedChild.parent?.name || selectedChild.parent?.email ? (
                            <div className="mt-1 text-xs text-gray-600">
                              Parent: {selectedChild.parent?.name || selectedChild.parent?.email}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 space-y-3">
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                          Classroom
                        </div>
                        <div className="mt-1 flex items-center gap-2">
                          <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0 text-sky-400">
                            <path d="M10.75 16.82A7.462 7.462 0 0115 15.5c.71 0 1.396.098 2.046.282A.75.75 0 0018 15.06v-11a.75.75 0 00-.546-.721A9.006 9.006 0 0015 3a8.963 8.963 0 00-4.25 1.065V16.82zM9.25 4.065A8.963 8.963 0 005 3c-.85 0-1.673.118-2.454.339A.75.75 0 002 4.06v11a.75.75 0 00.954.721A7.506 7.506 0 015 15.5c1.579 0 3.042.487 4.25 1.32V4.065z" />
                          </svg>
                          <span className="text-sm font-semibold text-gray-900">
                            {selectedChild.classRoom?.name || selectedChild.className || (selectedChild.classRoomId ? "Assigned" : "Not assigned")}
                          </span>
                        </div>
                      </div>
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                          Center
                        </div>
                        <div className="mt-1 flex items-center gap-2">
                          <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0 text-violet-400">
                            <path fillRule="evenodd" d="M1 2.75A.75.75 0 011.75 2h10.5a.75.75 0 010 1.5H12v13.75a.75.75 0 01-.75.75h-1.5a.75.75 0 01-.75-.75v-2.5a.75.75 0 00-.75-.75h-2.5a.75.75 0 00-.75.75v2.5a.75.75 0 01-.75.75h-2.5a.75.75 0 010-1.5H2V3.5h-.25A.75.75 0 011 2.75zM4 5.5a.5.5 0 01.5-.5h1a.5.5 0 01.5.5v1a.5.5 0 01-.5.5h-1a.5.5 0 01-.5-.5v-1zM4.5 9a.5.5 0 00-.5.5v1a.5.5 0 00.5.5h1a.5.5 0 00.5-.5v-1a.5.5 0 00-.5-.5h-1zM8 5.5a.5.5 0 01.5-.5h1a.5.5 0 01.5.5v1a.5.5 0 01-.5.5h-1a.5.5 0 01-.5-.5v-1zM8.5 9a.5.5 0 00-.5.5v1a.5.5 0 00.5.5h1a.5.5 0 00.5-.5v-1a.5.5 0 00-.5-.5h-1zM14.25 6a.75.75 0 00-.75.75V17H18V6.75a.75.75 0 00-.75-.75h-3zM15 9.5a.5.5 0 01.5-.5h1a.5.5 0 01.5.5v1a.5.5 0 01-.5.5h-1a.5.5 0 01-.5-.5v-1zm.5 3.5a.5.5 0 00-.5.5v1a.5.5 0 00.5.5h1a.5.5 0 00.5-.5v-1a.5.5 0 00-.5-.5h-1z" clipRule="evenodd" />
                          </svg>
                          <span className="text-sm text-gray-700">
                            {selectedChild.center?.name || selectedChild.centerName || (selectedChild.centerId ? "Assigned" : "Not assigned")}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 -mx-1 overflow-x-auto border-b border-gray-200 pb-3" role="tablist" aria-label="Child reports">
                    <div className="flex gap-2 px-1 min-w-max">
                      {tabList.map((tab) => (
                        <button
                          key={tab.key}
                          type="button"
                          role="tab"
                          aria-selected={activeTab === tab.key}
                          onClick={() => setActiveTab(tab.key)}
                          className={[
                            "whitespace-nowrap rounded-xl px-3 py-2 text-xs font-semibold transition",
                            activeTab === tab.key
                              ? "bg-sky-100 text-sky-900"
                              : "border border-gray-200 bg-white text-gray-700 hover:bg-gray-50",
                          ].join(" ")}
                        >
                          {tab.label}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => loadChildRecords(selectedChildId)}
                        disabled={!selectedChildId || activitiesLoading || progressLoading}
                        className="whitespace-nowrap rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Refresh
                      </button>
                    </div>
                  </div>
                  <div className="mt-2 text-xs text-gray-500">
                    Last synced: {lastSyncAt ? formatDateTime(lastSyncAt) : "-"}
                  </div>

                  <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[1fr_260px]">
                    <div className="space-y-3">
                      {activeTab === "DAILY_REPORT" ? (
                        <DailyReportPanel
                          activities={activityFeed}
                          loading={activitiesLoading}
                        />
                      ) : null}

                      {activeTab === "PROGRESS_REPORT" ? (
                        <ProgressReportPanel
                          selectedChildId={selectedChildId}
                          progressRows={progressRows}
                          loading={progressLoading}
                          birthDate={selectedChild.birthDate}
                        />
                      ) : null}

                      {activeTab === "STEPS" ? (
                        <StepsProgressionPanel
                          progressRows={progressRows}
                          loading={progressLoading}
                          childName={selectedChild.firstName}
                        />
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
                          noteLabel="Teacher's Note"
                        />
                      ) : null}
                    </div>

                    <aside className="space-y-3">
                      <CarePanel title="Diaper / Potty" items={diaperPotty} />
                      <CarePanel title="Meals & Nutrition" items={mealsNutrition} />
                      <Link
                        href="/parent/messages"
                        className="inline-flex w-full items-center justify-center rounded-xl bg-sky-600 px-3 py-2 text-sm font-extrabold text-white hover:bg-sky-700"
                      >
                        Go to Messages
                      </Link>
                    </aside>
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </ParentLayout>
  );
}

function DailyReportPanel({ activities, loading }) {
  if (loading) {
    return (
      <div className="space-y-3">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  if (!activities.length) {
    return (
      <EmptyState
        title="No daily activities"
        description="No activities have been logged for this child today."
        icon={
          <svg viewBox="0 0 24 24" className="h-12 w-12" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        }
      />
    );
  }

  const photoItems = activities
    .flatMap((a) =>
      extractMediaUrls(a).map((url, idx) => ({
        key: `${a.id || a.createdAt || "activity"}-${idx}`,
        url: resolveMediaUrl(url),
        createdAt: a.createdAt,
      })),
    )
    .slice(0, 18);

  return (
    <div className="space-y-3">
      {photoItems.length ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-4">
          <div className="text-sm font-extrabold text-gray-900">Photos</div>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {photoItems.map((item, index) => (
              <a
                key={item.key}
                href={item.url}
                target="_blank"
                rel="noreferrer"
                className="group overflow-hidden rounded-lg border border-gray-200 bg-gray-50"
                title={formatDateTime(item.createdAt)}
              >
                <img
                  src={item.url}
                  alt={`Child activity photo ${index + 1}`}
                  className="h-28 w-full object-cover transition group-hover:scale-[1.02]"
                />
              </a>
            ))}
          </div>
        </div>
      ) : null}
      {activities.slice(0, 20).map((a, index) => (
        <div
          key={a.id || `${a.createdAt}-${index}`}
          className="rounded-2xl border border-gray-200 bg-gray-50 p-4"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-extrabold text-gray-900">
              {activityTitle(a, index)}
            </div>
            <div className="text-xs text-gray-500">{formatDateTime(a.createdAt)}</div>
          </div>
          <div className="mt-2 text-xs font-semibold text-sky-700">
            Type: {formatActivityType(a.type)}
          </div>
          {renderActivityDetails(a)}
          <div className="mt-2 text-sm text-gray-700">
            {a.notes && String(a.notes).trim()
              ? a.notes
              : "No note entered by teacher for this log."}
          </div>
          <div className="mt-3 text-xs font-semibold text-gray-500">
            {a.recordedBy?.name || a.recordedBy?.email || "Teacher update"}
          </div>
        </div>
      ))}
    </div>
  );
}

function ProgressReportPanel({ selectedChildId, progressRows, loading, birthDate }) {
  const domainStats = useMemo(() => {
    const config = [
      { name: "Cognitive", barClass: "bg-sky-400" },
      { name: "Social-Emotional", barClass: "bg-emerald-400" },
      { name: "Physical", barClass: "bg-amber-400" },
      { name: "Language & Literacy", barClass: "bg-pink-400" },
    ];
    const byDomain = Object.fromEntries(
      config.map((item) => [item.name, { total: 0, complete: 0, barClass: item.barClass }]),
    );

    (progressRows || []).forEach((row) => {
      const domain = inferDomain(row);
      if (!byDomain[domain]) return;
      byDomain[domain].total += 1;
      if (isCompletedStatus(row.status)) byDomain[domain].complete += 1;
    });

    return config.map((item) => {
      const stat = byDomain[item.name];
      const score = stat.total ? Math.round((stat.complete / stat.total) * 100) : 0;
      return {
        name: item.name,
        score,
        barClass: item.barClass,
      };
    });
  }, [progressRows]);

  const milestoneCards = useMemo(() => {
    const now = new Date();
    const inMonth = (progressRows || []).filter((row) => {
      if (!isCompletedStatus(row.status)) return false;
      const sourceDate = row.achievedAt || row.updatedAt || row.createdAt;
      const date = new Date(sourceDate);
      return (
        !Number.isNaN(date.getTime()) &&
        date.getMonth() === now.getMonth() &&
        date.getFullYear() === now.getFullYear()
      );
    });

    const source = inMonth.length
      ? inMonth
      : (progressRows || []).filter((row) => isCompletedStatus(row.status));

    return source.slice(0, 3).map((row, index) => ({
      title: row.lesson?.title || `Milestone ${index + 1}`,
      detail: row.lesson?.description || `Goal ${row.goalIndex || 1}`,
      status: `Achieved ${formatDate(row.achievedAt || row.updatedAt || row.createdAt)}`,
    }));
  }, [progressRows]);

  const completionRatio = useMemo(() => {
    const total = (progressRows || []).length;
    if (!total) return 0;
    const done = (progressRows || []).filter((row) => isCompletedStatus(row.status)).length;
    return Math.round((done / total) * 100);
  }, [progressRows]);

  const moodLabel =
    completionRatio >= 70
      ? "Sunny & Active"
      : completionRatio >= 35
        ? "Focused & Growing"
        : "Building Momentum";

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-gray-200 bg-white p-4">
        <div className="flex items-center justify-between gap-3">
          <h4 className="text-base font-extrabold text-gray-900">
            Developmental Domains
          </h4>
          <div className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
            Today's mood: {moodLabel}
          </div>
        </div>

        {loading ? (
          <div className="mt-3"><Skeleton variant="line" count={4} /></div>
        ) : null}

        <div className="mt-3 space-y-3">
          {domainStats.map((domain) => (
            <ProgressDomainBar
              key={domain.name}
              label={domain.name}
              value={domain.score}
              barClass={domain.barClass}
            />
          ))}
        </div>

        <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600">
          <span>Comparison based on age-appropriate milestones{birthDate ? ` for ${formatAgeLabel(birthDate)}` : ""}</span>
          <span>{formatDateTime(new Date())}</span>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-4">
        <div className="flex items-center justify-between gap-3">
          <h4 className="text-base font-extrabold text-gray-900">
            Milestones Achieved This Month
          </h4>
          <Link
            href={`/parent/progress?childId=${encodeURIComponent(selectedChildId)}`}
            className="text-xs font-semibold text-sky-700 hover:text-sky-800"
          >
            View all Milestone History
          </Link>
        </div>

        {loading ? (
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <SkeletonCard />
            <SkeletonCard />
          </div>
        ) : milestoneCards.length ? (
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {milestoneCards.map((item, index) => (
              <div
                key={`${item.title}-${index}`}
                className="rounded-xl border border-gray-200 bg-gray-50 p-3"
              >
                <div className="text-sm font-extrabold text-gray-900">{item.title}</div>
                <div className="mt-1 text-xs text-gray-600">{item.detail}</div>
                <div className="mt-2 text-xs font-semibold text-sky-700">
                  {item.status}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-3 rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm text-gray-600">
            No completed milestone records found yet.
          </div>
        )}
      </div>
    </div>
  );
}

function StepsProgressionPanel({ progressRows, loading, childName }) {
  const [filter, setFilter] = useState("ALL");

  const sorted = useMemo(() => [...(progressRows || [])].sort(
    (a, b) => {
      const order = { FAILED: 0, IN_PROGRESS: 1, NOT_STARTED: 2, COMPLETED: 3, PASSED: 3 };
      const oa = order[a.status] ?? 2;
      const ob = order[b.status] ?? 2;
      if (oa !== ob) return oa - ob;
      return new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt);
    },
  ), [progressRows]);

  const counts = useMemo(() => sorted.reduce(
    (acc, row) => {
      const s = String(row?.status || "");
      if (s === "COMPLETED" || s === "PASSED") acc.done += 1;
      else if (s === "IN_PROGRESS") acc.inProgress += 1;
      else if (s === "FAILED") acc.needsSupport += 1;
      else acc.notStarted += 1;
      return acc;
    },
    { done: 0, inProgress: 0, needsSupport: 0, notStarted: 0 },
  ), [sorted]);

  const filtered = useMemo(() => {
    if (filter === "ALL") return sorted;
    if (filter === "DONE") return sorted.filter((r) => r.status === "COMPLETED" || r.status === "PASSED");
    if (filter === "IN_PROGRESS") return sorted.filter((r) => r.status === "IN_PROGRESS");
    if (filter === "FAILED") return sorted.filter((r) => r.status === "FAILED");
    if (filter === "NOT_STARTED") return sorted.filter((r) => r.status === "NOT_STARTED");
    return sorted;
  }, [sorted, filter]);

  const totalSteps = sorted.length;
  const completionPct = totalSteps ? Math.round((counts.done / totalSteps) * 100) : 0;
  const isDone = (status) => status === "COMPLETED" || status === "PASSED";

  function statusLabel(status) {
    if (status === "COMPLETED") return "Completed";
    if (status === "PASSED") return "Passed";
    if (status === "IN_PROGRESS") return "In Progress";
    if (status === "FAILED") return "Needs Support";
    return "Not Started";
  }

  function rowBorder(status) {
    if (isDone(status)) return "border-emerald-200 bg-emerald-50/50";
    if (status === "IN_PROGRESS") return "border-sky-200 bg-sky-50/50";
    if (status === "FAILED") return "border-rose-200 bg-rose-50/50";
    return "border-gray-200 bg-gray-50";
  }

  function pillStyle(status) {
    if (isDone(status)) return "bg-emerald-100 text-emerald-800";
    if (status === "IN_PROGRESS") return "bg-sky-100 text-sky-800";
    if (status === "FAILED") return "bg-rose-100 text-rose-800";
    return "bg-gray-100 text-gray-700";
  }

  const filterTabs = [
    { key: "ALL", label: "All", count: totalSteps, activeBg: "bg-gray-900", activeText: "text-white", bg: "bg-white", text: "text-gray-700", border: "border-gray-200" },
    { key: "FAILED", label: "Needs Support", count: counts.needsSupport, activeBg: "bg-rose-600", activeText: "text-white", bg: "bg-rose-50", text: "text-rose-700", border: "border-rose-200" },
    { key: "IN_PROGRESS", label: "In Progress", count: counts.inProgress, activeBg: "bg-sky-600", activeText: "text-white", bg: "bg-sky-50", text: "text-sky-700", border: "border-sky-200" },
    { key: "NOT_STARTED", label: "Not Started", count: counts.notStarted, activeBg: "bg-gray-600", activeText: "text-white", bg: "bg-gray-50", text: "text-gray-600", border: "border-gray-200" },
    { key: "DONE", label: "Completed", count: counts.done, activeBg: "bg-emerald-600", activeText: "text-white", bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
  ];

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4">
      <h4 className="text-base font-extrabold text-gray-900">Steps of Progression</h4>
      <p className="mt-1 text-sm text-gray-600">
        Progress records for {childName || "this child"}.
      </p>

      {loading ? (
        <div className="mt-3 space-y-3">
          <Skeleton variant="card" className="h-16 rounded-xl" />
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} variant="card" className="h-20 rounded-xl" />
            ))}
          </div>
          <Skeleton variant="line" count={3} />
        </div>
      ) : sorted.length === 0 ? (
        <EmptyState
          title="No progression records"
          description="Steps of progression will appear here once progress is tracked."
          className="mt-3"
        />
      ) : (
        <div className="mt-3 space-y-3">
          {/* Overall progress bar */}
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
            <div className="flex items-center justify-between text-xs font-semibold text-gray-700">
              <span>Overall Progress</span>
              <span>{counts.done}/{totalSteps} completed ({completionPct}%)</span>
            </div>
            <div className="mt-2 h-3 overflow-hidden rounded-full bg-gray-200">
              <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${completionPct}%` }} />
            </div>
          </div>

          {/* Summary cards */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700">Done</div>
              <div className="mt-1 text-xl font-extrabold text-emerald-900">{counts.done}</div>
            </div>
            <div className="rounded-xl border border-sky-200 bg-sky-50 p-3">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-sky-700">In Progress</div>
              <div className="mt-1 text-xl font-extrabold text-sky-900">{counts.inProgress}</div>
            </div>
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-3">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-rose-700">Needs Support</div>
              <div className="mt-1 text-xl font-extrabold text-rose-900">{counts.needsSupport}</div>
            </div>
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-600">Not Started</div>
              <div className="mt-1 text-xl font-extrabold text-gray-900">{counts.notStarted}</div>
            </div>
          </div>

          {/* Filter tabs */}
          <div className="flex flex-wrap gap-1.5">
            {filterTabs.map((tab) => {
              const active = filter === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setFilter(tab.key)}
                  className={[
                    "rounded-lg border px-3 py-2 text-xs font-semibold transition",
                    active
                      ? `${tab.activeBg} ${tab.activeText} border-transparent`
                      : `${tab.bg} ${tab.text} ${tab.border} hover:opacity-80`,
                  ].join(" ")}
                >
                  {tab.label} ({tab.count})
                </button>
              );
            })}
          </div>

          {/* Steps list */}
          <div className="space-y-2">
            {filtered.length === 0 ? (
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm text-gray-600">
                No steps match this filter.
              </div>
            ) : filtered.slice(0, 25).map((row) => {
              const done = isDone(row.status);
              return (
                <div key={row.id} className={["rounded-xl border p-3 transition", rowBorder(row.status)].join(" ")}>
                  <div className="flex items-start gap-3">
                    <div className={[
                      "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border text-xs font-bold",
                      done
                        ? "border-emerald-400 bg-emerald-500 text-white"
                        : row.status === "IN_PROGRESS"
                          ? "border-sky-300 bg-sky-100 text-sky-600"
                          : row.status === "FAILED"
                            ? "border-rose-300 bg-rose-100 text-rose-600"
                            : "border-gray-300 bg-white text-gray-400",
                    ].join(" ")}>
                      {done ? "\u2713" : row.status === "FAILED" ? "!" : ""}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className={["text-sm font-extrabold", done ? "text-gray-500 line-through" : "text-gray-900"].join(" ")}>
                            {row.lesson?.title || row.lessonId}
                          </div>
                          <div className="mt-0.5 text-xs text-gray-500">
                            {row.lesson?.category?.name || inferDomain(row)} &middot; Step {row.goalIndex || 1}
                            {row.achievedAt ? ` \u00b7 Done ${formatDate(row.achievedAt)}` : ""}
                          </div>
                        </div>
                        <span className={["shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold", pillStyle(row.status)].join(" ")}>
                          {statusLabel(row.status)}
                        </span>
                      </div>
                      <div className="mt-1.5 text-[10px] text-gray-400">
                        Updated {formatDateTime(row.updatedAt || row.createdAt)}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function CarePanel({ title, items }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-extrabold text-gray-900">{title}</h4>
        {items.length ? (
          <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-semibold text-sky-700">
            {items.length}
          </span>
        ) : null}
      </div>
      {items.length ? (
        <div className="mt-2 space-y-2">
          {items.map((row, index) => (
            <div
              key={row.id || `${row.createdAt}-${index}`}
              className="rounded-xl border border-gray-200 bg-gray-50 p-2"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-gray-800">
                  {formatTime(row.createdAt)}
                </span>
                <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold text-gray-500">
                  {formatActivityType(row.type)}
                </span>
              </div>
              <div className="mt-1 text-xs text-gray-600">{row.notes || "Update logged"}</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-2 text-xs text-gray-500">No recent updates.</div>
      )}
    </div>
  );
}

function ProgressDomainBar({ label, value, barClass }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-3">
        <span className="text-sm font-semibold text-gray-700">{label}</span>
        <span className="text-sm font-semibold text-gray-700">{value}%</span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-gray-200">
        <div className={["h-full rounded-full", barClass].join(" ")} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function isCompletedStatus(status) {
  return status === "COMPLETED" || status === "PASSED";
}

function inferDomain(row) {
  const categoryName = String(row?.lesson?.category?.name || "").toLowerCase();
  const lessonTitle = String(row?.lesson?.title || "").toLowerCase();
  const text = `${categoryName} ${lessonTitle}`;

  if (
    text.includes("social") ||
    text.includes("emotion") ||
    text.includes("behavior")
  ) {
    return "Social-Emotional";
  }
  if (
    text.includes("physical") ||
    text.includes("motor") ||
    text.includes("movement")
  ) {
    return "Physical";
  }
  if (
    text.includes("language") ||
    text.includes("literacy") ||
    text.includes("reading") ||
    text.includes("phonics")
  ) {
    return "Language & Literacy";
  }
  return "Cognitive";
}

const PARENT_DOMAIN_LABELS = {
  cognitive: "Cognitive", social: "Social-Emotional", physical: "Physical",
  language: "Language", creative: "Creative",
};
const PARENT_LEVEL_NAMES = { 1: "Emerging", 2: "Developing", 3: "Proficient", 4: "Advanced" };
const PARENT_LEVEL_COLORS = {
  1: "bg-amber-100 text-amber-800", 2: "bg-sky-100 text-sky-800",
  3: "bg-emerald-100 text-emerald-800", 4: "bg-violet-100 text-violet-800",
};

function activityTitle(activity, index) {
  if (activity?.type === "ACTIVITY") return "Teacher's Summary";
  if (activity?.type === "OTHER" && activity?.details?.kind === "DAILY_GRADE") {
    return activity?.details?.domains ? "Developmental Assessment" : "Daily Grade";
  }
  if (activity?.type === "MEAL" || activity?.type === "SNACK" || activity?.type === "BOTTLE") {
    return "Meals & Nutrition";
  }
  if (activity?.type === "DIAPER_CHANGE") return "Diaper / Potty";
  if (activity?.type === "NAP") return "Rest Time";
  return `${formatActivityType(activity?.type) || "Update"} ${index + 1}`;
}

function formatActivityType(type) {
  return String(type || "OTHER")
    .toLowerCase()
    .split("_")
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(" ");
}

function renderActivityDetails(activity) {
  const details =
    activity?.details && typeof activity.details === "object" && !Array.isArray(activity.details)
      ? activity.details
      : {};
  const grade =
    details.kind === "DAILY_GRADE" && Number.isFinite(Number(details.grade))
      ? Number(details.grade)
      : null;
  const domains = details.kind === "DAILY_GRADE" && details.domains ? details.domains : null;
  const media = extractMediaUrls(activity);

  return (
    <>
      {domains ? (
        <div className="mt-2">
          <div className="flex flex-wrap gap-1">
            {Object.entries(domains).map(([k, v]) => (
              <span key={k} className={`inline-block rounded-lg px-2 py-0.5 text-xs font-semibold ${PARENT_LEVEL_COLORS[v] || "bg-gray-100 text-gray-700"}`}>
                {PARENT_DOMAIN_LABELS[k] || k}: {PARENT_LEVEL_NAMES[v] || v}
              </span>
            ))}
          </div>
          {details.domainAvg != null && (
            <div className="mt-1 text-xs text-gray-600">
              Overall: {PARENT_LEVEL_NAMES[Math.round(details.domainAvg)] || details.domainAvg + "/4"}
            </div>
          )}
        </div>
      ) : grade !== null ? (
        <div className="mt-2 text-xs font-semibold text-emerald-700">Daily grade: {grade}/5</div>
      ) : null}
      {media.length ? (
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {media.slice(0, 3).map((url, idx) => (
            <img
              key={`${activity?.id || activity?.createdAt || "activity"}-media-${idx}`}
              src={resolveMediaUrl(url)}
              alt={`Activity media ${idx + 1}`}
              className="h-24 w-full rounded-lg border border-gray-200 object-cover"
            />
          ))}
        </div>
      ) : null}
    </>
  );
}

function extractMediaUrls(activity) {
  const details =
    activity?.details && typeof activity.details === "object" && !Array.isArray(activity.details)
      ? activity.details
      : {};
  const raw = Array.isArray(details.media) ? details.media : [];
  const urls = raw
    .map((m) => {
      if (typeof m === "string") return m.trim();
      if (m && typeof m === "object" && typeof m.url === "string") return m.url.trim();
      return "";
    })
    .filter(Boolean);
  return [...new Set(urls)];
}

function resolveMediaUrl(url) {
  if (!url) return "";
  const value = String(url).trim();
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;
  if (value.startsWith("/")) return value;
  return `/${value}`;
}

function formatAgeLabel(birthDate) {
  if (!birthDate) return "";
  const dob = new Date(birthDate);
  if (Number.isNaN(dob.getTime())) return "";
  const now = new Date();
  let months = (now.getFullYear() - dob.getFullYear()) * 12 + (now.getMonth() - dob.getMonth());
  if (now.getDate() < dob.getDate()) months -= 1;
  if (months < 0) return "";
  if (months <= 11) return "0-12 months";
  if (months <= 23) return "12-24 months";
  if (months <= 35) return "2-3 years";
  if (months <= 59) return "4-5 years";
  return `${Math.floor(months / 12)} years`;
}

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString();
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

function initials(firstName, lastName) {
  const f = (firstName || "").trim().slice(0, 1).toUpperCase();
  const l = (lastName || "").trim().slice(0, 1).toUpperCase();
  return `${f}${l}` || "C";
}
