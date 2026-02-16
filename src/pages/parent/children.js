import ParentLayout from "@/components/parent/ParentLayout";
import CatchupPlansPanel from "@/components/reports/CatchupPlansPanel";
import MilestoneCalendarPanel from "@/components/reports/MilestoneCalendarPanel";
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
            <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              {error}
            </div>
          ) : null}

          {childrenLoading ? (
            <div className="mt-4 text-sm text-gray-600">Loading...</div>
          ) : children.length === 0 ? (
            <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
              No children found for this account.
            </div>
          ) : (
            <div className="mt-4 space-y-4">
              <div className="grid grid-cols-2 gap-2 md:grid-cols-4 lg:grid-cols-6">
                {children.map((ch) => {
                  const active = ch.id === selectedChildId;
                  return (
                    <button
                      key={ch.id}
                      type="button"
                      onClick={() => setSelectedChildId(ch.id)}
                      className={[
                        "rounded-xl border px-3 py-2 text-left transition",
                        active
                          ? "border-sky-200 bg-sky-50"
                          : "border-gray-200 bg-white hover:bg-gray-50",
                      ].join(" ")}
                    >
                      <div className="truncate text-sm font-extrabold text-gray-900">
                        {ch.firstName} {ch.lastName || ""}
                      </div>
                      <div className="mt-1 text-xs text-gray-500">
                        {active ? "Selected" : "View details"}
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
                          <div className="mt-1 text-xs text-gray-600">
                            Parent: Family Account
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                      <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                        Class
                      </div>
                      <div className="mt-1 text-sm font-semibold text-gray-900">
                        {selectedChild.classRoomId || "Infant Care"}
                      </div>
                      <div className="mt-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                        Center
                      </div>
                      <div className="mt-1 text-sm text-gray-700">
                        {selectedChild.centerId || "-"}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2 border-b border-gray-200 pb-3">
                    {tabList.map((tab) => (
                      <button
                        key={tab.key}
                        type="button"
                        onClick={() => setActiveTab(tab.key)}
                        className={[
                          "rounded-xl px-3 py-2 text-xs font-semibold",
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
                      className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Refresh
                    </button>
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
      <div className="rounded-2xl border border-gray-200 bg-white p-4 text-sm text-gray-600">
        Loading report...
      </div>
    );
  }

  if (!activities.length) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
        No daily activities yet for this child.
      </div>
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

function ProgressReportPanel({ selectedChildId, progressRows, loading }) {
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
          <div className="mt-3 text-sm text-gray-600">Loading progress records...</div>
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
          <span>Comparison based on age-appropriate milestone for 18-24 months</span>
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
          <div className="mt-3 text-sm text-gray-600">Loading milestones...</div>
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
  const sorted = [...(progressRows || [])].sort(
    (a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt),
  );
  const counts = sorted.reduce(
    (acc, row) => {
      const s = String(row?.status || "");
      if (s === "COMPLETED" || s === "PASSED") acc.done += 1;
      else if (s === "IN_PROGRESS") acc.inProgress += 1;
      else if (s === "FAILED") acc.needsSupport += 1;
      else acc.notStarted += 1;
      return acc;
    },
    { done: 0, inProgress: 0, needsSupport: 0, notStarted: 0 },
  );

  function statusTone(status) {
    if (status === "COMPLETED" || status === "PASSED") return "bg-emerald-100 text-emerald-800";
    if (status === "IN_PROGRESS") return "bg-sky-100 text-sky-800";
    if (status === "FAILED") return "bg-rose-100 text-rose-800";
    return "bg-gray-100 text-gray-800";
  }

  function statusPercent(status) {
    if (status === "COMPLETED" || status === "PASSED") return 100;
    if (status === "IN_PROGRESS") return 60;
    if (status === "FAILED") return 35;
    return 10;
  }

  function statusBar(status) {
    if (status === "COMPLETED" || status === "PASSED") return "bg-emerald-500";
    if (status === "IN_PROGRESS") return "bg-sky-500";
    if (status === "FAILED") return "bg-rose-500";
    return "bg-gray-400";
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4">
      <h4 className="text-base font-extrabold text-gray-900">Steps of Progression</h4>
      <p className="mt-1 text-sm text-gray-600">
        Live progress records for {childName || "this child"}.
      </p>

      {loading ? (
        <div className="mt-3 text-sm text-gray-600">Loading progression steps...</div>
      ) : sorted.length === 0 ? (
        <div className="mt-3 rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm text-gray-600">
          No progression records yet.
        </div>
      ) : (
        <div className="mt-3 space-y-3">
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

          <div className="space-y-2">
            {sorted.slice(0, 25).map((row) => (
              <div key={row.id} className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-extrabold text-gray-900">
                      {row.lesson?.title || row.lessonId}
                    </div>
                    <div className="mt-0.5 text-xs text-gray-600">
                      {row.lesson?.category?.name || inferDomain(row)} | Goal {row.goalIndex || 1}
                    </div>
                  </div>
                  <span className={["rounded-full px-2 py-1 text-[11px] font-semibold", statusTone(row.status)].join(" ")}>
                    {row.status}
                  </span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-200">
                  <div
                    className={["h-full rounded-full", statusBar(row.status)].join(" ")}
                    style={{ width: `${statusPercent(row.status)}%` }}
                  />
                </div>
                <div className="mt-2 text-[11px] text-gray-500">
                  Updated {formatDateTime(row.updatedAt || row.createdAt)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function CarePanel({ title, items }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4">
      <h4 className="text-sm font-extrabold text-gray-900">{title}</h4>
      {items.length ? (
        <div className="mt-2 space-y-2">
          {items.map((row, index) => (
            <div
              key={row.id || `${row.createdAt}-${index}`}
              className="rounded-xl border border-gray-200 bg-gray-50 p-2"
            >
              <div className="text-xs font-semibold text-gray-800">
                {formatTime(row.createdAt)}
              </div>
              <div className="mt-1 text-xs text-gray-600">{row.notes || "Update logged"}</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-2 text-xs text-gray-600">No recent updates.</div>
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

function activityTitle(activity, index) {
  if (activity?.type === "ACTIVITY") return "Teacher's Summary";
  if (activity?.type === "OTHER" && activity?.details?.kind === "DAILY_GRADE") {
    return "Daily Grade";
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
  const media = extractMediaUrls(activity);

  return (
    <>
      {grade !== null ? (
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
