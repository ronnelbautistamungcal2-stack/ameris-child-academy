import { useEffect, useState } from "react";
import { apiJson } from "@/lib/api";

const STATUSES = ["NOT_STARTED", "IN_PROGRESS", "PASSED", "FAILED", "COMPLETED"];

const STATUS_BADGE = {
  NOT_STARTED: "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300",
  IN_PROGRESS: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  COMPLETED: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  PASSED: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  FAILED: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
};

const STATUS_LABEL = {
  NOT_STARTED: "Not Started",
  IN_PROGRESS: "In Progress",
  COMPLETED: "Completed",
  PASSED: "Passed",
  FAILED: "Failed",
};

const STATUS_ICON = {
  NOT_STARTED: (
    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
  ),
  IN_PROGRESS: (
    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
  ),
  COMPLETED: (
    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
  ),
  PASSED: (
    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
  ),
  FAILED: (
    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
  ),
};

function formatDate(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString();
}

export default function ActiveGoalsPanel({
  childId,
  childName,
  progressRows,
  lessons,
  remediationMap,
  onRefresh,
  maxGoals = 5,
}) {
  const [drafts, setDrafts] = useState({});
  const [saving, setSaving] = useState("");
  const [expanded, setExpanded] = useState({});
  const [assigningRemediation, setAssigningRemediation] = useState("");
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");

  const lessonMap = new Map();
  for (const l of lessons) lessonMap.set(l.id, l);

  const latestProgressByLesson = new Map();
  for (const pr of progressRows) {
    const existing = latestProgressByLesson.get(pr.lessonId);
    if (!existing || Number(pr.goalIndex || 0) > Number(existing.goalIndex || 0)) {
      latestProgressByLesson.set(pr.lessonId, pr);
    }
  }

  const activeGoals = [];
  for (const pr of progressRows) {
    const latest = latestProgressByLesson.get(pr.lessonId);
    if (latest && latest.id === pr.id) {
      if (["FAILED", "IN_PROGRESS", "NOT_STARTED"].includes(pr.status)) {
        activeGoals.push(pr);
      }
    }
  }

  const order = { FAILED: 0, IN_PROGRESS: 1, NOT_STARTED: 2 };
  activeGoals.sort((a, b) => (order[a.status] ?? 3) - (order[b.status] ?? 3));

  const displayed = activeGoals.slice(0, maxGoals);
  const totalActive = activeGoals.length;
  const failedCount = activeGoals.filter((g) => g.status === "FAILED").length;
  const inProgressCount = activeGoals.filter((g) => g.status === "IN_PROGRESS").length;
  const notStartedCount = activeGoals.filter((g) => g.status === "NOT_STARTED").length;

  function getDraft(progressId) {
    return drafts[progressId] || { status: "IN_PROGRESS", notes: "" };
  }

  function setDraft(progressId, next) {
    setDrafts((prev) => ({
      ...prev,
      [progressId]: { ...(prev[progressId] || {}), ...next },
    }));
  }

  async function recordEntry(progress) {
    const draft = getDraft(progress.id);
    setSaving(progress.id);
    setError("");
    setFeedback("");

    try {
      await apiJson(
        `/api/v1/progress/${encodeURIComponent(progress.id)}/entries`,
        {
          method: "POST",
          body: JSON.stringify({
            status: draft.status,
            notes: draft.notes || null,
          }),
        },
      );

      if (draft.status === "PASSED" || draft.status === "COMPLETED") {
        setFeedback(`Advancing to next goal for "${lessonMap.get(progress.lessonId)?.title || "lesson"}"`);
        setTimeout(() => setFeedback(""), 3000);
      }

      setDraft(progress.id, { notes: "" });
      if (onRefresh) await onRefresh();
    } catch (e) {
      setError(e.message || "Failed to record entry");
    } finally {
      setSaving("");
    }
  }

  async function assignRemediation(fromLessonId, toLessonId) {
    setAssigningRemediation(toLessonId);
    setError("");

    try {
      await apiJson("/api/v1/progress", {
        method: "POST",
        body: JSON.stringify({
          childId,
          lessonId: toLessonId,
          status: "NOT_STARTED",
          goalIndex: 1,
        }),
      });

      setFeedback("Corrective lesson assigned successfully");
      setTimeout(() => setFeedback(""), 3000);
      if (onRefresh) await onRefresh();
    } catch (e) {
      setError(e.message || "Failed to assign corrective lesson");
    } finally {
      setAssigningRemediation("");
    }
  }

  if (!childId) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50/50 py-16 dark:border-gray-700 dark:bg-gray-900">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100 dark:bg-gray-800">
          <svg className="h-7 w-7 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
        </div>
        <p className="mt-4 text-sm font-semibold text-gray-500 dark:text-gray-400">Select a child to view active goals</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with mini stats */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100 dark:bg-violet-900/40">
              <svg className="h-5 w-5 text-violet-600 dark:text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div>
              <h3 className="text-base font-extrabold text-gray-900 dark:text-gray-100">
                Active Goals{childName ? ` for ${childName}` : ""}
              </h3>
              <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                {totalActive} active goal{totalActive !== 1 ? "s" : ""} &middot; showing top {Math.min(maxGoals, totalActive)}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            {failedCount > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-1 text-[11px] font-bold text-red-700 dark:bg-red-900/40 dark:text-red-300">
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01" /></svg>
                {failedCount} failed
              </span>
            )}
            {inProgressCount > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-bold text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3" /></svg>
                {inProgressCount} in progress
              </span>
            )}
            {notStartedCount > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-bold text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                {notStartedCount} not started
              </span>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
          <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
          {error}
        </div>
      )}
      {feedback && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300">
          <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
          {feedback}
        </div>
      )}

      {displayed.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-green-50 py-12 dark:border-emerald-800 dark:from-emerald-900/20 dark:to-green-900/10">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 dark:bg-emerald-900/40">
            <svg className="h-7 w-7 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div className="mt-4 text-lg font-extrabold text-emerald-700 dark:text-emerald-400">All caught up!</div>
          <div className="mt-1 text-sm text-emerald-600/70 dark:text-emerald-400/50">
            No active goals. All goals are completed or no progress has been started yet.
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {displayed.map((pr) => {
            const lesson = lessonMap.get(pr.lessonId);
            const goals = lesson?.goals || [];
            const currentGoal = goals.find(
              (g) => Number(g.goalIndex || 0) === Number(pr.goalIndex || 0),
            );
            const totalGoals = goals.length;
            const recommended = remediationMap.get(pr.lessonId) || [];
            const isFailed = pr.status === "FAILED";
            const draft = getDraft(pr.id);
            const isSaving = saving === pr.id;
            const isExpanded = expanded[pr.id];

            return (
              <div
                key={pr.id}
                className={`rounded-2xl border shadow-sm transition hover:shadow-md ${
                  isFailed
                    ? "border-red-200 bg-gradient-to-br from-red-50/50 to-white dark:border-red-800 dark:from-red-900/20 dark:to-gray-900"
                    : "border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900"
                }`}
              >
                {/* Card Header */}
                <div className="border-b border-gray-100 p-5 dark:border-gray-800">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2.5">
                        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xs font-bold text-white ${isFailed ? "bg-red-500" : pr.status === "IN_PROGRESS" ? "bg-amber-500" : "bg-gray-400"}`}>
                          G{pr.goalIndex}
                        </div>
                        <div className="min-w-0">
                          <div className="font-extrabold text-gray-900 dark:text-gray-100">
                            {lesson?.title || "Unknown Lesson"}
                          </div>
                          <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                            {lesson?.category?.name && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-semibold text-sky-700 dark:bg-sky-900/40 dark:text-sky-300">
                                <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg>
                                {lesson.category.name}
                              </span>
                            )}
                            {pr.updatedAt && (
                              <span className="text-[10px] text-gray-400">Updated {formatDate(pr.updatedAt)}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                    <span
                      className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold ${
                        STATUS_BADGE[pr.status] || STATUS_BADGE.NOT_STARTED
                      }`}
                    >
                      {STATUS_ICON[pr.status]}
                      {STATUS_LABEL[pr.status] || pr.status}
                    </span>
                  </div>

                  {/* Step progress indicator */}
                  {totalGoals > 0 && (
                    <div className="mt-3 flex items-center gap-2">
                      <div className="flex flex-1 gap-0.5">
                        {Array.from({ length: totalGoals }, (_, i) => {
                          const stepIndex = i + 1;
                          const isComplete = stepIndex < pr.goalIndex;
                          const isCurrent = stepIndex === pr.goalIndex;
                          return (
                            <div
                              key={stepIndex}
                              className={`h-2 flex-1 rounded-full transition-all ${
                                isComplete
                                  ? "bg-emerald-400 dark:bg-emerald-500"
                                  : isCurrent
                                    ? isFailed ? "bg-red-400 dark:bg-red-500" : "bg-amber-400 dark:bg-amber-500"
                                    : "bg-gray-200 dark:bg-gray-700"
                              }`}
                              title={`Step ${stepIndex}${isComplete ? " (done)" : isCurrent ? " (current)" : ""}`}
                            />
                          );
                        })}
                      </div>
                      <span className="shrink-0 text-[11px] font-bold text-gray-500 dark:text-gray-400">
                        {pr.goalIndex}/{totalGoals}
                      </span>
                    </div>
                  )}

                  {/* Current Goal Title */}
                  {currentGoal?.title && (
                    <div className="mt-3 rounded-xl bg-gray-50 px-3.5 py-2.5 dark:bg-gray-800">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">Current Goal</div>
                      <div className="mt-0.5 text-sm font-medium text-gray-700 dark:text-gray-300">
                        {currentGoal.title}
                      </div>
                      {currentGoal.description && (
                        <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">{currentGoal.description}</div>
                      )}
                    </div>
                  )}
                </div>

                {/* Card Body */}
                <div className="p-5">
                  {/* Failed: Remediation suggestions */}
                  {isFailed && recommended.length > 0 && (
                    <div className="mb-4 rounded-xl border border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50/50 p-4 dark:border-amber-800 dark:from-amber-900/20 dark:to-orange-900/10">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-amber-800 dark:text-amber-300">
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                        Corrective Lessons Available
                      </div>
                      <ul className="mt-2 space-y-2">
                        {recommended.slice(0, 3).map((r) => (
                          <li
                            key={r.id}
                            className="flex items-center justify-between gap-2 rounded-lg bg-white/60 p-2 text-sm dark:bg-gray-900/40"
                          >
                            <span className="text-amber-800 dark:text-amber-200">{r.title}</span>
                            <button
                              type="button"
                              className="shrink-0 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-amber-700 active:scale-[0.98] disabled:opacity-60"
                              disabled={assigningRemediation === r.id}
                              onClick={() => assignRemediation(pr.lessonId, r.id)}
                            >
                              {assigningRemediation === r.id ? "Assigning..." : "Assign"}
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {isFailed && recommended.length === 0 && (
                    <div className="mb-4 flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 p-3 text-xs text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
                      <svg className="h-4 w-4 shrink-0 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      No corrective lessons linked. Use Curriculum Manager to add remediations.
                    </div>
                  )}

                  {/* Record section */}
                  <div className="space-y-2">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">Record Progress</div>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <select
                          className="w-full appearance-none rounded-xl border border-gray-200 bg-gray-50/50 px-3 py-2.5 pr-8 text-sm font-medium transition focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                          value={draft.status}
                          onChange={(e) => setDraft(pr.id, { status: e.target.value })}
                          disabled={isSaving}
                        >
                          {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                        </select>
                        <svg className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                      </div>
                      <button
                        type="button"
                        className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-violet-600 px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-violet-700 active:scale-[0.98] disabled:opacity-60"
                        onClick={() => recordEntry(pr)}
                        disabled={isSaving}
                      >
                        {isSaving ? (
                          <>
                            <svg className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                            Saving
                          </>
                        ) : (
                          <>
                            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                            Record
                          </>
                        )}
                      </button>
                    </div>
                    <input
                      type="text"
                      className="w-full rounded-xl border border-gray-200 bg-gray-50/50 px-3 py-2.5 text-sm transition focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                      placeholder="Optional notes..."
                      value={draft.notes || ""}
                      onChange={(e) => setDraft(pr.id, { notes: e.target.value })}
                      disabled={isSaving}
                    />
                  </div>

                  {/* Expand for history */}
                  <button
                    type="button"
                    className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-violet-600 transition hover:text-violet-700 dark:text-violet-400"
                    onClick={() => setExpanded((prev) => ({ ...prev, [pr.id]: !prev[pr.id] }))}
                  >
                    <svg className={`h-3.5 w-3.5 transition-transform ${isExpanded ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                    {isExpanded ? "Hide History" : "View History"}
                  </button>

                  {isExpanded && <ProgressHistory progressId={pr.id} />}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {totalActive > maxGoals && (
        <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 text-center dark:border-gray-700 dark:bg-gray-800">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            +{totalActive - maxGoals} more active goals. Switch to &quot;All Goals&quot; view to see everything.
          </p>
        </div>
      )}
    </div>
  );
}

/* ── Inline progress history ────────────────────────── */

function ProgressHistory({ progressId }) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const data = await apiJson(
          `/api/v1/progress/${encodeURIComponent(progressId)}/entries`,
        );
        setEntries(Array.isArray(data) ? data : []);
      } catch {
        setEntries([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [progressId]);

  if (loading) {
    return (
      <div className="mt-3 flex items-center gap-2 text-xs text-gray-500">
        <svg className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
        Loading history...
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="mt-3 flex items-center gap-2 rounded-xl bg-gray-50 p-3 text-xs text-gray-500 dark:bg-gray-800">
        <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        No entries recorded yet.
      </div>
    );
  }

  return (
    <div className="mt-3 space-y-0">
      <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-2">History</div>
      {entries.map((entry, idx) => (
        <div key={entry.id} className="relative flex gap-3 pb-3">
          {/* Timeline line */}
          {idx < entries.length - 1 && (
            <div className="absolute left-[11px] top-6 bottom-0 w-px bg-gray-200 dark:bg-gray-700" />
          )}
          {/* Timeline dot */}
          <div className={`relative mt-0.5 flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full ${
            entry.status === "PASSED" || entry.status === "COMPLETED" ? "bg-emerald-100 dark:bg-emerald-900/40" :
            entry.status === "FAILED" ? "bg-red-100 dark:bg-red-900/40" :
            entry.status === "IN_PROGRESS" ? "bg-amber-100 dark:bg-amber-900/40" :
            "bg-gray-100 dark:bg-gray-700"
          }`}>
            <div className={`h-2 w-2 rounded-full ${
              entry.status === "PASSED" || entry.status === "COMPLETED" ? "bg-emerald-500" :
              entry.status === "FAILED" ? "bg-red-500" :
              entry.status === "IN_PROGRESS" ? "bg-amber-500" :
              "bg-gray-400"
            }`} />
          </div>
          {/* Content */}
          <div className="min-w-0 flex-1 rounded-xl bg-gray-50 p-3 dark:bg-gray-800">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                  {entry.recordedBy?.name || "Unknown"}
                </span>
                {entry.recordedBy?.role && (
                  <span className="rounded-full bg-gray-200 px-1.5 py-0.5 text-[9px] font-bold uppercase text-gray-500 dark:bg-gray-700 dark:text-gray-400">
                    {entry.recordedBy.role}
                  </span>
                )}
              </div>
              <span className="text-[10px] text-gray-400">
                {formatDate(entry.occurredAt)}
              </span>
            </div>
            <div className="mt-1.5 flex items-center gap-2">
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                  STATUS_BADGE[entry.status] || STATUS_BADGE.NOT_STARTED
                }`}
              >
                {STATUS_ICON[entry.status]}
                {STATUS_LABEL[entry.status] || entry.status}
              </span>
              {entry.notes && (
                <span className="text-xs text-gray-600 dark:text-gray-400">{entry.notes}</span>
              )}
            </div>
            {entry?.details?.nextGoal ? (
              <div className="mt-2 rounded-lg border border-violet-100 bg-violet-50 px-2.5 py-2 text-[11px] text-violet-800 dark:border-violet-900/40 dark:bg-violet-900/20 dark:text-violet-200">
                <span className="font-semibold">Next goal:</span> {entry.details.nextGoal}
              </div>
            ) : null}
            {entry.media?.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {entry.media.map((url, i) => (
                  <a
                    key={i}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded-lg bg-violet-50 px-2 py-1 text-[10px] font-semibold text-violet-700 no-underline transition hover:bg-violet-100 dark:bg-violet-900/40 dark:text-violet-300"
                  >
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
                    Attachment {i + 1}
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
