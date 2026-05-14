import { useEffect, useMemo, useState } from "react";
import CoachLayout from "@/components/coach/CoachLayout";
import {
  CoachBadge,
  CoachChipButton,
  CoachEmptyPanel,
  CoachMetricCard,
  CoachPageHero,
  CoachPanel,
  coachInputClass,
  coachSecondaryButtonClass,
} from "@/components/coach/CoachPage";
import useSyncedCenterId from "@/hooks/useSyncedCenterId";
import { SkeletonTable } from "@/components/ui/Skeleton";
import { apiJson } from "@/lib/api";
import { collectChecklistLessonAttachments } from "@/lib/checklistLessonResources";
import {
  describeChecklistSchedule,
  summarizeChecklistFrequency,
  summarizeChecklistSchedule,
} from "@/lib/checklistSchedule";

const CATEGORIES = [
  { key: "ALL", label: "All" },
  { key: "OPENING", label: "Opening" },
  { key: "CLOSING", label: "Closing" },
  { key: "HEALTH_SAFETY", label: "Health & Safety" },
  { key: "CLEANING", label: "Cleaning" },
  { key: "MEALS", label: "Meals" },
  { key: "CLASSROOM", label: "Classroom" },
];

const FREQ_TONES = {
  DAILY: "sky",
  WEEKLY: "amber",
  MONTHLY: "rose",
  ONE_TIME: "rose",
  MIXED: "slate",
};
const CATEGORY_TONES = {
  OPENING: "amber",
  CLOSING: "sky",
  HEALTH_SAFETY: "rose",
  CLEANING: "emerald",
  MEALS: "amber",
  CLASSROOM: "sky",
  OTHER: "slate",
};

function formatTaskTime(value) {
  if (!value) return "";
  const [hour, minute] = String(value).split(":");
  const date = new Date();
  date.setHours(Number(hour), Number(minute || 0), 0, 0);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function sortByTaskTime(items) {
  return (Array.isArray(items) ? items : []).slice().sort((a, b) => {
    const at = a.taskTime || "99:99";
    const bt = b.taskTime || "99:99";
    if (at !== bt) return at.localeCompare(bt);
    return Number(a.sortOrder || 0) - Number(b.sortOrder || 0);
  });
}

export default function CoachChecklists() {
  const [centers, setCenters] = useState([]);
  const [centerId, setCenterId] = useState("");
  const [checklists, setChecklists] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [activeCategory, setActiveCategory] = useState("ALL");
  const [selectedDate, setSelectedDate] = useState(todayStr());
  const [completing, setCompleting] = useState("");

  useSyncedCenterId(centerId, setCenterId, centers);

  useEffect(() => {
    (async () => {
      try {
        const response = await apiJson("/api/v1/centers");
        const nextCenters = Array.isArray(response) ? response : [];
        setCenters(nextCenters);
      } catch {
        // ignore, page fetch will surface errors
      }
    })();
  }, []);

  async function loadChecklists() {
    if (!centerId) return;

    setLoading(true);
    setError("");

    try {
      const response = await apiJson(
        `/api/v1/daily-checklists?centerId=${encodeURIComponent(centerId)}&date=${encodeURIComponent(selectedDate)}`,
      );
      setChecklists(Array.isArray(response) ? response : []);
    } catch (err) {
      setError(err.message || "Failed to load checklists");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadChecklists();
  }, [centerId, selectedDate]);

  async function toggleItem(itemId, isCompleted) {
    setCompleting(itemId);

    try {
      await apiJson("/api/v1/daily-checklists/complete", {
        method: "POST",
        body: JSON.stringify({
          itemId,
          date: selectedDate,
          undo: isCompleted,
        }),
      });
      await loadChecklists();
    } catch (err) {
      setError(err.message || "Failed to update checklist");
    } finally {
      setCompleting("");
    }
  }

  const filtered = useMemo(() => {
    if (activeCategory === "ALL") return checklists;
    return checklists.filter((list) => list.category === activeCategory);
  }, [checklists, activeCategory]);

  const grouped = useMemo(() => {
    const groups = {};
    for (const checklist of filtered) {
      if (!groups[checklist.category]) groups[checklist.category] = [];
      groups[checklist.category].push(checklist);
    }
    return groups;
  }, [filtered]);

  const stats = useMemo(() => {
    let total = 0;
    let completed = 0;

    for (const checklist of checklists) {
      for (const item of checklist.items || []) {
        total += 1;
        if ((item.completions || []).length > 0) completed += 1;
      }
    }

    return {
      total,
      completed,
      remaining: Math.max(total - completed, 0),
      pct: total > 0 ? Math.round((completed / total) * 100) : 0,
    };
  }, [checklists]);

  const categoryStats = useMemo(() => {
    const map = {};

    for (const checklist of checklists) {
      if (!map[checklist.category]) map[checklist.category] = { total: 0, completed: 0 };

      for (const item of checklist.items || []) {
        map[checklist.category].total += 1;
        if ((item.completions || []).length > 0) map[checklist.category].completed += 1;
      }
    }

    return map;
  }, [checklists]);

  const activeCenterName = centers.find((center) => center.id === centerId)?.name || "";
  const completedCategories = Object.values(categoryStats).filter(
    (category) => category.total > 0 && category.total === category.completed,
  ).length;

  return (
    <CoachLayout title="Daily Checklists">
      <div className="space-y-5">
        <CoachPageHero
          eyebrow="Operations Checklists"
          title="Watch execution quality across the daily operating rhythm."
          description="Review opening, closing, safety, cleaning, and classroom tasks in one place, then spot where routines are slipping."
          meta={
            <>
              {activeCenterName ? <CoachBadge tone="sky">{activeCenterName}</CoachBadge> : null}
              <CoachBadge tone="amber">{new Date(selectedDate).toLocaleDateString("en-US")}</CoachBadge>
              {checklists.length ? (
                <CoachBadge tone="slate">{checklists.length} checklist groups loaded</CoachBadge>
              ) : null}
            </>
          }
          controls={
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <label className="block sm:col-span-2">
                <div className="mb-1.5 text-xs font-black uppercase tracking-[0.16em] text-gray-500 dark:text-gray-400">
                  Center View
                </div>
                <select
                  value={centerId}
                  onChange={(event) => setCenterId(event.target.value)}
                  className={coachInputClass}
                >
                  <option value="">Select a center to load checklists...</option>
                  {centers.map((center) => (
                    <option key={center.id} value={center.id}>
                      {center.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <div className="mb-1.5 text-xs font-black uppercase tracking-[0.16em] text-gray-500 dark:text-gray-400">
                  Date
                </div>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(event) => setSelectedDate(event.target.value)}
                  className={coachInputClass}
                />
              </label>
            </div>
          }
          actions={
            centerId ? (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-1">
                <button
                  type="button"
                  onClick={() => setSelectedDate(todayStr())}
                  className={coachSecondaryButtonClass}
                >
                  Jump to Today
                </button>
                <button
                  type="button"
                  onClick={() => setActiveCategory("ALL")}
                  className={coachSecondaryButtonClass}
                >
                  Show All Categories
                </button>
              </div>
            ) : null
          }
          stats={
            centerId ? (
              <>
                <CoachMetricCard
                  label="Completed"
                  value={String(stats.completed)}
                  hint={`${stats.total} total tasks`}
                  tone="emerald"
                  icon={<CheckIcon />}
                />
                <CoachMetricCard
                  label="Remaining"
                  value={String(stats.remaining)}
                  hint="Items still open"
                  tone={stats.remaining ? "amber" : "emerald"}
                  icon={<ListIcon />}
                />
                <CoachMetricCard
                  label="Completion Rate"
                  value={`${stats.pct}%`}
                  hint="Across this date"
                  tone="sky"
                  icon={<ProgressIcon />}
                />
                <CoachMetricCard
                  label="Finished Categories"
                  value={String(completedCategories)}
                  hint={`${Object.keys(categoryStats).length} categories active`}
                  tone="amber"
                  icon={<GridIcon />}
                />
              </>
            ) : null
          }
        />

        {error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">
            {error}
          </div>
        ) : null}

        {!centerId ? (
          <CoachEmptyPanel
            title="Select a center to review operations."
            description="Daily checklists are scoped by center and date so coaches can see exactly where routines are complete or slipping."
          />
        ) : null}

        {centerId ? (
          <CoachPanel
            title="Checklist Progress"
            description="Filter by category to isolate one operational lane, or keep the full view to scan the entire day."
          >
            <div className="space-y-4">
              <div className="h-4 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                <div
                  className={`h-full rounded-full transition-all ${
                    stats.pct === 100
                      ? "bg-emerald-500"
                      : stats.pct >= 60
                        ? "bg-sky-500"
                        : stats.pct > 0
                          ? "bg-amber-500"
                          : "bg-slate-300 dark:bg-slate-700"
                  }`}
                  style={{ width: `${stats.pct}%` }}
                />
              </div>

              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map((category) => {
                  const summary =
                    category.key === "ALL"
                      ? { completed: stats.completed, total: stats.total }
                      : categoryStats[category.key] || { completed: 0, total: 0 };

                  return (
                    <CoachChipButton
                      key={category.key}
                      active={activeCategory === category.key}
                      onClick={() => setActiveCategory(category.key)}
                      tone={category.key === "ALL" ? "slate" : CATEGORY_TONES[category.key] || "slate"}
                    >
                      {category.label} {summary.total ? `${summary.completed}/${summary.total}` : ""}
                    </CoachChipButton>
                  );
                })}
              </div>
            </div>

            {loading ? (
              <div className="mt-4">
                <SkeletonTable rows={5} cols={3} />
              </div>
            ) : filtered.length === 0 ? (
              <div className="mt-4">
                <CoachEmptyPanel
                  title={
                    checklists.length === 0
                      ? "No checklists are available for this date."
                      : "No checklists match the selected category."
                  }
                  description={
                    checklists.length === 0
                      ? "Ask an admin to create operational checklists if the center should be tracking them."
                      : "Switch categories or return to the full view to continue reviewing task completion."
                  }
                  icon={<ListIcon />}
                />
              </div>
            ) : (
              <div className="mt-4 space-y-5">
                {Object.entries(grouped).map(([category, lists]) => (
                  <div key={category} className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="text-sm font-black uppercase tracking-[0.16em] text-gray-500 dark:text-gray-400">
                        {catLabel(category)}
                      </div>
                      <CoachBadge tone={CATEGORY_TONES[category] || "slate"}>
                        {lists.reduce((sum, list) => sum + (list.items?.length || 0), 0)} tasks
                      </CoachBadge>
                    </div>

                    {lists.map((checklist) => (
                      <ChecklistCard
                        key={checklist.id}
                        checklist={checklist}
                        onToggle={toggleItem}
                        completing={completing}
                      />
                    ))}
                  </div>
                ))}
              </div>
            )}
          </CoachPanel>
        ) : null}
      </div>
    </CoachLayout>
  );
}

function ChecklistCard({ checklist, onToggle, completing }) {
  const [expanded, setExpanded] = useState(true);

  const items = sortByTaskTime(checklist.items);
  const completedCount = items.filter((item) => (item.completions || []).length > 0).length;
  const percent = items.length > 0 ? Math.round((completedCount / items.length) * 100) : 0;
  const allDone = items.length > 0 && completedCount === items.length;
  const tone = CATEGORY_TONES[checklist.category] || "slate";
  const scheduleKey = summarizeChecklistFrequency(checklist);
  const scheduleLabel = summarizeChecklistSchedule(checklist);

  return (
    <div
      className={`rounded-[1.75rem] border p-1 shadow-sm ${
        tone === "rose"
          ? "border-rose-200 bg-rose-50/60 dark:border-rose-900/60 dark:bg-rose-950/20"
          : tone === "emerald"
            ? "border-emerald-200 bg-emerald-50/60 dark:border-emerald-900/60 dark:bg-emerald-950/20"
            : tone === "amber"
              ? "border-amber-200 bg-amber-50/60 dark:border-amber-900/60 dark:bg-amber-950/20"
              : "border-sky-200 bg-sky-50/60 dark:border-sky-900/60 dark:bg-sky-950/20"
      }`}
    >
      <div className="rounded-[1.5rem] bg-white/90 p-4 dark:bg-slate-900/80">
        <button
          type="button"
          onClick={() => setExpanded((current) => !current)}
          className="flex w-full items-start justify-between gap-4 text-left"
        >
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <div className="text-base font-black text-gray-900 dark:text-gray-100">
                {checklist.title}
              </div>
              <CoachBadge tone={FREQ_TONES[scheduleKey] || "slate"}>
                {scheduleLabel}
              </CoachBadge>
              {checklist.classRoom ? (
                <CoachBadge tone="sky">{checklist.classRoom.name}</CoachBadge>
              ) : null}
              {allDone ? <CoachBadge tone="emerald">Complete</CoachBadge> : null}
            </div>

            {checklist.description ? (
              <p className="mt-2 text-sm leading-6 text-gray-600 dark:text-gray-400">
                {checklist.description}
              </p>
            ) : null}

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <div className="h-3 min-w-[160px] flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                <div
                  className={`h-full rounded-full transition-all ${
                    allDone ? "bg-emerald-500" : "bg-sky-500"
                  }`}
                  style={{ width: `${Math.max(percent, 4)}%` }}
                />
              </div>
              <CoachBadge tone={allDone ? "emerald" : "slate"}>
                {completedCount}/{items.length} complete
              </CoachBadge>
            </div>
          </div>

          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            className={`mt-1 h-5 w-5 shrink-0 text-gray-400 transition-transform ${
              expanded ? "rotate-180" : ""
            }`}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25L12 15.75 4.5 8.25" />
          </svg>
        </button>

        {expanded ? (
          <div className="mt-4 space-y-3 border-t border-slate-200 pt-4 dark:border-slate-700">
            {items.map((item) => {
              const done = (item.completions || []).length > 0;
              const completion = (item.completions || [])[0];
              const isCompleting = completing === item.id;
              const lessonAttachments = collectChecklistLessonAttachments(
                item.lesson,
                item.lessonGoal,
              );

              return (
                <div
                  key={item.id}
                  className={`rounded-[1.35rem] border p-4 ${
                    done
                      ? "border-emerald-200 bg-emerald-50/60 dark:border-emerald-900/60 dark:bg-emerald-950/20"
                      : "border-slate-200 bg-slate-50/80 dark:border-slate-700 dark:bg-slate-800/50"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <button
                      type="button"
                      onClick={() => onToggle(item.id, done)}
                      disabled={isCompleting}
                      className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-xl border-2 transition ${
                        done
                          ? "border-emerald-500 bg-emerald-500 text-white"
                          : "border-slate-300 bg-white hover:border-sky-400 dark:border-slate-600 dark:bg-slate-900"
                      } ${isCompleting ? "animate-pulse" : ""}`}
                    >
                      {done ? (
                        <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                          <path
                            fillRule="evenodd"
                            d="M16.704 5.29a1 1 0 010 1.414L8.818 14.59a1 1 0 01-1.414 0L3.296 10.48a1 1 0 011.414-1.414l3.401 3.4 7.179-7.178a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                      ) : null}
                    </button>

                    <div className="min-w-0 flex-1">
                      {item.taskTime ? (
                        <div className="mb-1 text-xs font-black uppercase tracking-[0.12em] text-sky-700 dark:text-sky-300">
                          {formatTaskTime(item.taskTime)}
                        </div>
                      ) : null}
                      <div className={`text-sm font-bold ${done ? "text-emerald-800 dark:text-emerald-200" : "text-gray-900 dark:text-gray-100"}`}>
                        {item.title}
                      </div>
                      {item.description ? (
                        <p className="mt-1 text-sm leading-6 text-gray-600 dark:text-gray-400">
                          {item.description}
                        </p>
                      ) : null}

                      <div className="mt-3 flex flex-wrap gap-2">
                        {item.lesson ? (
                          <details className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-black uppercase tracking-[0.12em] text-sky-700 dark:border-sky-900/60 dark:bg-sky-950/20 dark:text-sky-300">
                            <summary className="cursor-pointer list-none">Lesson</summary>
                            <div className="mt-2 w-64 rounded-2xl border border-slate-200 bg-white p-3 text-left normal-case tracking-normal text-gray-700 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                              <div className="font-bold text-gray-900 dark:text-gray-100">{item.lesson.title}</div>
                              {item.lesson.term || item.lesson.reference ? (
                                <div className="mt-1 text-[10px] uppercase tracking-[0.12em] text-gray-500 dark:text-gray-400">
                                  {[item.lesson.term, item.lesson.reference].filter(Boolean).join(" • ")}
                                </div>
                              ) : null}
                              {item.lesson.description ? (
                                <p className="mt-2 text-xs leading-5 text-gray-600 dark:text-gray-300">{item.lesson.description}</p>
                              ) : null}
                              {item.lesson.goals?.length ? (
                                <div className="mt-2 text-xs text-gray-600 dark:text-gray-300">
                                  {item.lesson.goals.length} step{item.lesson.goals.length === 1 ? "" : "s"}
                                </div>
                              ) : null}
                              {lessonAttachments.length ? (
                                <div className="mt-3 flex flex-wrap gap-1.5">
                                  {lessonAttachments.map((attachment) => (
                                    <a
                                      key={attachment.href}
                                      href={attachment.href}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[10px] font-semibold text-sky-700 transition hover:bg-sky-100 dark:border-sky-900/60 dark:bg-sky-950/20 dark:text-sky-300"
                                    >
                                      Attachment: {attachment.label}
                                    </a>
                                  ))}
                                </div>
                              ) : null}
                            </div>
                          </details>
                        ) : null}
                        {item.policyDocument ? (
                          <a
                            href={item.policyDocument.url}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-black uppercase tracking-[0.12em] text-sky-700 transition hover:bg-sky-100 dark:border-sky-900/60 dark:bg-sky-950/20 dark:text-sky-300"
                          >
                            Policy
                          </a>
                        ) : null}
                        {item.directLink ? (
                          <a
                            href={item.directLink}
                            className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-black uppercase tracking-[0.12em] text-sky-700 transition hover:bg-sky-100 dark:border-sky-900/60 dark:bg-sky-950/20 dark:text-sky-300"
                          >
                            {item.directLinkLabel || "Open link"}
                          </a>
                        ) : null}
                        {item.policyLink ? (
                          <a
                            href={item.policyLink}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-black uppercase tracking-[0.12em] text-sky-700 transition hover:bg-sky-100 dark:border-sky-900/60 dark:bg-sky-950/20 dark:text-sky-300"
                          >
                            Reference
                          </a>
                        ) : null}
                        {item.mediaLink ? (
                          <a
                            href={item.mediaLink}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-black uppercase tracking-[0.12em] text-amber-700 transition hover:bg-amber-100 dark:border-amber-900/60 dark:bg-amber-950/20 dark:text-amber-300"
                          >
                            Video
                          </a>
                        ) : null}
                      </div>

                      {done && completion ? (
                        <div className="mt-3 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                          Completed by {completion.completedBy?.name || completion.completedBy?.email || "Staff"} at{" "}
                          {new Date(completion.completedAt).toLocaleTimeString("en-US", {
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function todayStr() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function catLabel(category) {
  const map = {
    OPENING: "Opening",
    CLOSING: "Closing",
    HEALTH_SAFETY: "Health & Safety",
    CLEANING: "Cleaning",
    MEALS: "Meals",
    CLASSROOM: "Classroom",
    OTHER: "Other",
  };

  return map[category] || category;
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
    </svg>
  );
}

function ListIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12M8.25 17.25h12M3.75 7.5h.008v.008H3.75V7.5zm0 5.25h.008v.008H3.75v-.008zm0 5.25h.008v.008H3.75V18z" />
    </svg>
  );
}

function ProgressIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function GridIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75h6.5v6.5h-6.5zm10 0h6.5v6.5h-6.5zm-10 10h6.5v6.5h-6.5zm10 0h6.5v6.5h-6.5z" />
    </svg>
  );
}
