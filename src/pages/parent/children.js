import ParentLayout from "@/components/parent/ParentLayout";
import { ParentButton, ParentPill, ParentSection } from "@/components/parent/ParentUI";
import CatchupPlansPanel from "@/components/reports/CatchupPlansPanel";
import MilestoneCalendarPanel from "@/components/reports/MilestoneCalendarPanel";
import EmptyState from "@/components/ui/EmptyState";
import Skeleton, { SkeletonCard } from "@/components/ui/Skeleton";
import { apiJson } from "@/lib/api";
import { useRouter } from "next/router";
import { useCallback, useEffect, useMemo, useState } from "react";

const TAB_LIST = [
  ["DAILY_REPORT", "Daily Report", "Latest teacher logs, photos, meals, and care notes."],
  ["PROGRESS_REPORT", "Progress Report", "How development is tracking across core domains."],
  ["STEPS", "Steps of Progression", "Detailed lesson-level progress and support needs."],
  ["CATCHUP", "Catch-up Plans", "Recommended next steps for growth and reinforcement."],
  ["MILESTONE", "Milestone Calendar", "A milestone view of recent development records."],
];

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
      try {
        const kids = await apiJson("/api/v1/children");
        const sorted = (Array.isArray(kids) ? kids : []).sort((a, b) =>
          (a.firstName || "").localeCompare(b.firstName || ""),
        );
        setChildren(sorted);
        const routeChildId =
          typeof router.query.childId === "string" ? router.query.childId : "";
        setSelectedChildId(
          sorted.some((ch) => ch.id === routeChildId)
            ? routeChildId
            : sorted[0]?.id || "",
        );
      } catch (e) {
        setError(e.message || "Failed to load children");
      } finally {
        setChildrenLoading(false);
      }
    })();
  }, [router.query.childId]);

  const loadChildRecords = useCallback(async (targetChildId, silent = false) => {
    if (!targetChildId) return;
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
        .slice(0, 20),
    [activities],
  );
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

  return (
    <ParentLayout title="My Children">
      <ParentSection className="bg-gradient-to-br from-white via-sky-50/25 to-white">
        <div className="flex flex-col gap-3 border-b border-gray-100 pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-sky-700">
              Children
            </div>
            <h2 className="mt-1 text-xl font-black tracking-tight text-gray-900">
              {selectedChild ? `${selectedChild.firstName}'s reports` : "My Children"}
            </h2>
            <p className="mt-1 text-sm text-gray-600">Simple view of reports, progress, and care updates.</p>
          </div>
          <ParentButton
            variant="secondary"
            onClick={() => selectedChildId && loadChildRecords(selectedChildId)}
          >
            Refresh now
          </ParentButton>
        </div>

        {error ? (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {error}
          </div>
        ) : null}

        {childrenLoading ? (
          <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-4">
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
            <div className="-mx-1 overflow-x-auto pb-1">
              <div className="flex min-w-max gap-2 px-1">
                {children.map((ch) => {
                  const active = ch.id === selectedChildId;
                  return (
                    <button
                      key={ch.id}
                      type="button"
                      onClick={() => setSelectedChildId(ch.id)}
                      className={[
                        "flex min-w-[190px] items-center gap-3 rounded-2xl border px-3 py-2.5 text-left transition-all duration-150",
                        active
                          ? "border-sky-300 bg-sky-50 shadow-sm ring-2 ring-sky-100"
                          : "border-gray-200 bg-white hover:border-sky-200 hover:bg-sky-50/60",
                      ].join(" ")}
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sky-500 text-xs font-extrabold text-white">
                        {initials(ch.firstName, ch.lastName)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-extrabold text-gray-900">
                          {ch.firstName} {ch.lastName || ""}
                        </div>
                        <div className="mt-0.5 text-[11px] text-gray-500">
                          {formatAgeLabel(ch.birthDate) || "Child profile"}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {selectedChild ? (
              <>
                <div className="rounded-[24px] border border-gray-200 bg-white p-4 shadow-sm">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-sky-600 text-sm font-black text-white">
                        {initials(selectedChild.firstName, selectedChild.lastName)}
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="truncate text-lg font-black tracking-tight text-gray-900">
                            {selectedChild.firstName} {selectedChild.lastName || ""}
                          </h3>
                          <span className="rounded-full bg-sky-50 px-2.5 py-1 text-[11px] font-bold text-sky-700">
                            {formatAgeLabel(selectedChild.birthDate) || "Profile"}
                          </span>
                        </div>
                        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-600">
                          <span>Parent: {selectedChild.parent?.name || selectedChild.parent?.email || "Not available"}</span>
                          <span>Last sync: {lastSyncAt ? formatTime(lastSyncAt) : "Waiting"}</span>
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                      <MiniStat label="Updates" value={activityFeed.length} tone="emerald" />
                      <MiniStat label="Meals" value={mealsNutrition.length} tone="amber" />
                      <MiniStat label="Steps" value={progressRows.length} />
                      <ParentButton
                        href={`/parent/messages?childId=${encodeURIComponent(selectedChildId)}`}
                        variant="secondary"
                        className="px-3"
                      >
                        Message
                      </ParentButton>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 border-b border-gray-200 pb-4">
                  {TAB_LIST.map(([key, label]) => (
                    <ParentPill
                      key={key}
                      active={activeTab === key}
                      onClick={() => setActiveTab(key)}
                    >
                      {label}
                    </ParentPill>
                  ))}
                </div>

                {(activeTab === "DAILY_REPORT" || activeTab === "PROGRESS_REPORT") && (
                  <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                    <CarePanel title="Meals & Nutrition" items={mealsNutrition} />
                    <CarePanel title="Diaper / Potty" items={diaperPotty} />
                  </div>
                )}

                {activeTab === "DAILY_REPORT" ? (
                  <DailyReportPanel activities={activityFeed} loading={activitiesLoading} />
                ) : null}
                {activeTab === "PROGRESS_REPORT" ? (
                  <ProgressPanel progressRows={progressRows} loading={progressLoading} />
                ) : null}
                {activeTab === "STEPS" ? (
                  <StepsPanel progressRows={progressRows} loading={progressLoading} />
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
              </>
            ) : null}
          </div>
        )}
      </ParentSection>
    </ParentLayout>
  );
}

function DailyReportPanel({ activities, loading }) {
  if (loading) return <SkeletonCard />;
  if (!activities.length) {
    return <EmptyState title="No daily activities" description="No activities have been logged for this child today." />;
  }

  return (
    <div className="space-y-3">
      {activities.map((activity, index) => (
        <div key={activity.id || `${activity.createdAt}-${index}`} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex gap-3">
            <div className="flex w-14 shrink-0 flex-col items-center">
              <div className="rounded-xl bg-sky-50 px-2 py-1 text-[11px] font-extrabold text-sky-700">
                {formatTime(activity.createdAt)}
              </div>
              <div className="mt-2 h-full w-px bg-gray-200" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="text-sm font-extrabold text-gray-900">{activityTitle(activity, index)}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-bold text-sky-700">
                      {formatActivityType(activity.type)}
                    </span>
                    <span className="text-xs text-gray-500">{formatDateTime(activity.createdAt)}</span>
                  </div>
                </div>
                <div className="text-xs font-semibold text-gray-500">
                  {activity.recordedBy?.name || activity.recordedBy?.email || "Teacher update"}
                </div>
              </div>
              {renderActivityDetails(activity)}
              <div className="mt-3 rounded-2xl bg-gray-50 px-3 py-2.5 text-sm text-gray-700">
                {activity.notes && String(activity.notes).trim() ? activity.notes : "No note entered by teacher for this log."}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function ProgressPanel({ progressRows, loading }) {
  if (loading) return <SkeletonCard />;
  const total = progressRows.length;
  const done = progressRows.filter((row) => ["COMPLETED", "PASSED"].includes(row.status)).length;
  const pct = total ? Math.round((done / total) * 100) : 0;
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4">
      <div className="text-base font-extrabold text-gray-900">Developmental Domains</div>
      <div className="mt-2 h-3 overflow-hidden rounded-full bg-gray-200">
        <div className="h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-2 text-sm text-gray-600">{done} of {total} progress records completed.</div>
    </div>
  );
}

function StepsPanel({ progressRows, loading }) {
  if (loading) return <SkeletonCard />;
  if (!progressRows.length) {
    return <EmptyState title="No progression records" description="Steps of progression will appear here once progress is tracked." />;
  }
  return (
    <div className="space-y-2">
      {progressRows.slice(0, 25).map((row) => (
        <div key={row.id} className="rounded-xl border border-gray-200 bg-white p-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <div className="text-sm font-extrabold text-gray-900">{row.lesson?.title || row.lessonId}</div>
              <div className="mt-0.5 text-xs text-gray-500">
                {row.lesson?.category?.name || inferDomain(row)} - Step {row.goalIndex || 1}
              </div>
            </div>
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-700">
              {humanizeStatus(row.status)}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

function CarePanel({ title, items }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-3.5">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-extrabold text-gray-900">{title}</h4>
        <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-semibold text-sky-700">{items.length}</span>
      </div>
      <div className="mt-3 space-y-2">
        {items.length ? items.map((row, index) => (
          <div key={row.id || `${row.createdAt}-${index}`} className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs font-extrabold text-gray-900">{formatTime(row.createdAt)}</div>
                <div className="mt-1 text-xs text-gray-600">{row.notes || "Update logged"}</div>
              </div>
              <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold text-gray-500 ring-1 ring-gray-200">
                {formatActivityType(row.type)}
              </span>
            </div>
          </div>
        )) : <div className="text-xs text-gray-500">No recent updates.</div>}
      </div>
    </div>
  );
}

function MiniStat({ label, value, tone = "gray" }) {
  const tones = { sky: "border-sky-200 bg-white text-sky-900", amber: "border-amber-200 bg-white text-amber-900", emerald: "border-emerald-200 bg-white text-emerald-900", gray: "border-gray-200 bg-white/90 text-gray-700" };
  return <div className={`rounded-2xl border px-3 py-2.5 ${tones[tone] || tones.gray}`}><div className="text-[10px] font-extrabold uppercase tracking-[0.16em] opacity-70">{label}</div><div className="mt-1 text-sm font-black">{value}</div></div>;
}
function inferDomain(row) {
  const text = `${String(row?.lesson?.category?.name || "").toLowerCase()} ${String(row?.lesson?.title || "").toLowerCase()}`;
  if (text.includes("social") || text.includes("emotion") || text.includes("behavior")) return "Social-Emotional";
  if (text.includes("physical") || text.includes("motor") || text.includes("movement")) return "Physical";
  if (text.includes("language") || text.includes("literacy") || text.includes("reading") || text.includes("phonics")) return "Language & Literacy";
  return "Cognitive";
}
function humanizeStatus(status) { if (status === "COMPLETED") return "Completed"; if (status === "PASSED") return "Passed"; if (status === "IN_PROGRESS") return "In Progress"; if (status === "FAILED") return "Needs Support"; return "Not Started"; }
function activityTitle(activity, index) { if (activity?.type === "ACTIVITY") return "Teacher's Summary"; if (["MEAL", "SNACK", "BOTTLE"].includes(activity?.type)) return "Meals & Nutrition"; if (activity?.type === "DIAPER_CHANGE") return "Diaper / Potty"; if (activity?.type === "NAP") return "Rest Time"; return `${formatActivityType(activity?.type) || "Update"} ${index + 1}`; }
function formatActivityType(type) { return String(type || "OTHER").toLowerCase().split("_").map((part) => part.slice(0, 1).toUpperCase() + part.slice(1)).join(" "); }
function renderActivityDetails(activity) { const media = extractMediaUrls(activity); return media.length ? <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">{media.slice(0, 3).map((url, idx) => <img key={`${activity?.id || activity?.createdAt || "activity"}-${idx}`} src={resolveMediaUrl(url)} alt={`Activity media ${idx + 1}`} className="h-24 w-full rounded-lg border border-gray-200 object-cover" />)}</div> : null; }
function extractMediaUrls(activity) { const details = activity?.details && typeof activity.details === "object" && !Array.isArray(activity.details) ? activity.details : {}; const raw = Array.isArray(details.media) ? details.media : []; return [...new Set(raw.map((m) => typeof m === "string" ? m.trim() : m?.url?.trim?.() || "").filter(Boolean))]; }
function resolveMediaUrl(url) { if (!url) return ""; const value = String(url).trim(); if (!value) return ""; if (/^https?:\/\//i.test(value) || value.startsWith("/")) return value; return `/${value}`; }
function formatAgeLabel(birthDate) { if (!birthDate) return ""; const dob = new Date(birthDate); if (Number.isNaN(dob.getTime())) return ""; const now = new Date(); let months = (now.getFullYear() - dob.getFullYear()) * 12 + (now.getMonth() - dob.getMonth()); if (now.getDate() < dob.getDate()) months -= 1; if (months < 0) return ""; if (months <= 11) return "0-12 months"; if (months <= 23) return "12-24 months"; if (months <= 35) return "2-3 years"; if (months <= 59) return "4-5 years"; return `${Math.floor(months / 12)} years`; }
function formatDate(value) { if (!value) return "-"; const date = new Date(value); if (Number.isNaN(date.getTime())) return "-"; return date.toLocaleDateString(); }
function formatDateTime(value) { if (!value) return "-"; const date = new Date(value); if (Number.isNaN(date.getTime())) return "-"; return date.toLocaleString(); }
function formatTime(value) { if (!value) return "-"; const date = new Date(value); if (Number.isNaN(date.getTime())) return "-"; return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }); }
function initials(firstName, lastName) { const f = (firstName || "").trim().slice(0, 1).toUpperCase(); const l = (lastName || "").trim().slice(0, 1).toUpperCase(); return `${f}${l}` || "C"; }
