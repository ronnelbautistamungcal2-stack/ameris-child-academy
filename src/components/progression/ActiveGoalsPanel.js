import { useEffect, useState } from "react";
import { apiJson } from "@/lib/api";

const STATUSES = ["NOT_STARTED", "IN_PROGRESS", "PASSED", "FAILED", "COMPLETED"];

const STATUS_BADGE = {
  NOT_STARTED: "bg-gray-100 text-gray-700",
  IN_PROGRESS: "bg-amber-100 text-amber-800",
  COMPLETED: "bg-emerald-100 text-emerald-800",
  PASSED: "bg-emerald-100 text-emerald-800",
  FAILED: "bg-red-100 text-red-800",
};

const STATUS_LABEL = {
  NOT_STARTED: "Not Started",
  IN_PROGRESS: "In Progress",
  COMPLETED: "Completed",
  PASSED: "Passed",
  FAILED: "Failed",
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

  // Build the latest progress per (lesson, goalIndex)
  const latestProgressByLesson = new Map();
  for (const pr of progressRows) {
    const existing = latestProgressByLesson.get(pr.lessonId);
    if (!existing || Number(pr.goalIndex || 0) > Number(existing.goalIndex || 0)) {
      latestProgressByLesson.set(pr.lessonId, pr);
    }
  }

  // Active goals: FAILED, IN_PROGRESS, NOT_STARTED only
  const activeGoals = [];
  for (const pr of progressRows) {
    const latest = latestProgressByLesson.get(pr.lessonId);
    if (latest && latest.id === pr.id) {
      if (["FAILED", "IN_PROGRESS", "NOT_STARTED"].includes(pr.status)) {
        activeGoals.push(pr);
      }
    }
  }

  // Sort: FAILED first, then IN_PROGRESS, then NOT_STARTED
  const order = { FAILED: 0, IN_PROGRESS: 1, NOT_STARTED: 2 };
  activeGoals.sort((a, b) => (order[a.status] ?? 3) - (order[b.status] ?? 3));

  const displayed = activeGoals.slice(0, maxGoals);
  const totalActive = activeGoals.length;

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
      const result = await apiJson(
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
      // Create progress for the child on the remediation lesson
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
      <div className="rounded-2xl border border-gray-200 bg-white p-6 text-center text-sm text-gray-500">
        Select a child to view active goals.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-extrabold text-gray-900">
            Active Goals{childName ? ` for ${childName}` : ""}
          </h3>
          <p className="mt-0.5 text-xs text-gray-500">
            {totalActive} active goal{totalActive !== 1 ? "s" : ""} &middot; showing top {Math.min(maxGoals, totalActive)}
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </div>
      )}
      {feedback && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
          {feedback}
        </div>
      )}

      {displayed.length === 0 ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">
          No active goals. All goals are completed or no progress has been started.
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
                className={`rounded-2xl border p-5 transition ${
                  isFailed
                    ? "border-red-200 bg-red-50/30"
                    : "border-gray-200 bg-white"
                }`}
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="font-extrabold text-gray-900">
                      {lesson?.title || "Unknown Lesson"}
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                      {lesson?.category?.name && (
                        <span className="rounded-full bg-sky-100 px-2 py-0.5 text-sky-700">
                          {lesson.category.name}
                        </span>
                      )}
                      <span>
                        Step {pr.goalIndex} of {totalGoals || "?"}
                      </span>
                      {pr.updatedAt && (
                        <span>&middot; Updated {formatDate(pr.updatedAt)}</span>
                      )}
                    </div>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${
                      STATUS_BADGE[pr.status] || STATUS_BADGE.NOT_STARTED
                    }`}
                  >
                    {STATUS_LABEL[pr.status] || pr.status}
                  </span>
                </div>

                {/* Current Goal Title */}
                {currentGoal?.title && (
                  <div className="mt-2 rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-700">
                    {currentGoal.title}
                  </div>
                )}

                {/* Failed: Remediation suggestions */}
                {isFailed && recommended.length > 0 && (
                  <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
                    <div className="text-xs font-semibold text-amber-900">
                      Corrective Lessons Available
                    </div>
                    <ul className="mt-1.5 space-y-1.5">
                      {recommended.slice(0, 3).map((r) => (
                        <li
                          key={r.id}
                          className="flex items-center justify-between gap-2 text-sm"
                        >
                          <span className="text-amber-800">{r.title}</span>
                          <button
                            type="button"
                            className="shrink-0 rounded-lg bg-amber-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-60"
                            disabled={assigningRemediation === r.id}
                            onClick={() =>
                              assignRemediation(pr.lessonId, r.id)
                            }
                          >
                            {assigningRemediation === r.id
                              ? "Assigning..."
                              : "Assign"}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {isFailed && recommended.length === 0 && (
                  <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs text-gray-600">
                    No corrective lessons linked. Use the Curriculum Manager to add remediations.
                  </div>
                )}

                {/* Record section */}
                <div className="mt-3 space-y-2">
                  <div className="flex gap-2">
                    <select
                      className="flex-1 rounded-lg border border-gray-200 px-2.5 py-2 text-sm"
                      value={draft.status}
                      onChange={(e) =>
                        setDraft(pr.id, { status: e.target.value })
                      }
                      disabled={isSaving}
                    >
                      {STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {STATUS_LABEL[s]}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="shrink-0 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                      onClick={() => recordEntry(pr)}
                      disabled={isSaving}
                    >
                      {isSaving ? "Saving..." : "Record"}
                    </button>
                  </div>
                  <input
                    type="text"
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                    placeholder="Optional notes..."
                    value={draft.notes || ""}
                    onChange={(e) =>
                      setDraft(pr.id, { notes: e.target.value })
                    }
                    disabled={isSaving}
                  />
                </div>

                {/* Expand for entries / history */}
                <button
                  type="button"
                  className="mt-2 text-xs font-semibold text-blue-600 hover:text-blue-700"
                  onClick={() =>
                    setExpanded((prev) => ({
                      ...prev,
                      [pr.id]: !prev[pr.id],
                    }))
                  }
                >
                  {isExpanded ? "Hide History" : "View History"}
                </button>

                {isExpanded && (
                  <ProgressHistory progressId={pr.id} />
                )}
              </div>
            );
          })}
        </div>
      )}

      {totalActive > maxGoals && (
        <p className="text-center text-xs text-gray-500">
          +{totalActive - maxGoals} more active goals. Switch to &quot;All Goals&quot; view to see everything.
        </p>
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
    return <div className="mt-2 text-xs text-gray-500">Loading history...</div>;
  }

  if (entries.length === 0) {
    return <div className="mt-2 text-xs text-gray-500">No entries recorded yet.</div>;
  }

  return (
    <div className="mt-2 space-y-2">
      {entries.map((entry) => (
        <div
          key={entry.id}
          className="rounded-lg border border-gray-100 bg-gray-50 p-2.5 text-xs"
        >
          <div className="flex items-center justify-between">
            <span className="font-semibold text-gray-700">
              {entry.recordedBy?.name || "Unknown"}
            </span>
            <span className="text-gray-400">
              {formatDate(entry.occurredAt)}
            </span>
          </div>
          <div className="mt-1 flex items-center gap-2">
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                STATUS_BADGE[entry.status] || STATUS_BADGE.NOT_STARTED
              }`}
            >
              {STATUS_LABEL[entry.status] || entry.status}
            </span>
            {entry.notes && (
              <span className="text-gray-600">{entry.notes}</span>
            )}
          </div>
          {entry.media?.length > 0 && (
            <div className="mt-1.5 flex gap-1.5">
              {entry.media.map((url, i) => (
                <a
                  key={i}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 underline"
                >
                  Attachment {i + 1}
                </a>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
