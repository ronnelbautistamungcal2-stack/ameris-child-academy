import TeacherLayout from "@/components/teacher/TeacherLayout";
import ActiveGoalsPanel from "@/components/progression/ActiveGoalsPanel";
import { AGE_GROUPS, ageGroupKeyFromBirthDate } from "@/lib/ageUtils";
import { apiJson } from "@/lib/api";
import { useEffect, useMemo, useState } from "react";

const STATUSES = ["NOT_STARTED", "IN_PROGRESS", "PASSED", "FAILED", "COMPLETED"];

const STAGE_FILTERS = [
  { value: "active", label: "Active Goals" },
  { value: "all", label: "All Goals" },
  { value: "completed", label: "Completed" },
  { value: "failed", label: "Failed" },
];

function byString(a, b) {
  return String(a || "").localeCompare(String(b || ""));
}

function formatDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

export default function TeacherProgress() {
  const [centers, setCenters] = useState([]);
  const [centerId, setCenterId] = useState("");

  const [classes, setClasses] = useState([]);
  const [classId, setClassId] = useState("");

  const [children, setChildren] = useState([]);
  const [childId, setChildId] = useState("");

  const [lessons, setLessons] = useState([]);
  const [progressRows, setProgressRows] = useState([]);

  const [drafts, setDrafts] = useState({});
  const [savingLessonId, setSavingLessonId] = useState("");

  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [stage, setStage] = useState("all");
  const [ageGroup, setAgeGroup] = useState("");
  const [visibleCount, setVisibleCount] = useState(100);

  const [overviewProgress, setOverviewProgress] = useState([]);
  const [overviewLoading, setOverviewLoading] = useState(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError("");
      try {
        const c = await apiJson("/api/v1/centers");
        const arr = Array.isArray(c) ? c : [];
        setCenters(arr);
        if (arr.length === 1) setCenterId(arr[0].id);
      } catch (e) {
        setError(e.message || "Failed to load centers");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      if (!centerId) {
        setChildren([]);
        setClasses([]);
        setLessons([]);
        setChildId("");
        setClassId("");
        setProgressRows([]);
        setQuery("");
        setCategory("");
        setStage("all");
        setAgeGroup("");
        setVisibleCount(100);
        return;
      }

      setLoading(true);
      setError("");
      try {
        const [kids, l, cls] = await Promise.all([
          apiJson(`/api/v1/children?centerId=${encodeURIComponent(centerId)}`),
          apiJson(`/api/v1/lessons?centerId=${encodeURIComponent(centerId)}`),
          apiJson(`/api/v1/classes?centerId=${encodeURIComponent(centerId)}`),
        ]);
        setChildren(Array.isArray(kids) ? kids : []);
        setLessons(Array.isArray(l) ? l : []);
        setClasses(Array.isArray(cls) ? cls : []);
      } catch (e) {
        setError(e.message || "Failed to load center data");
      } finally {
        setLoading(false);
      }
    })();
  }, [centerId]);

  useEffect(() => {
    (async () => {
      if (!childId) {
        setProgressRows([]);
        return;
      }

      setLoading(true);
      setError("");
      try {
        const p = await apiJson(`/api/v1/progress?childId=${encodeURIComponent(childId)}`);
        setProgressRows(Array.isArray(p) ? p : []);
      } catch (e) {
        setError(e.message || "Failed to load child progress");
      } finally {
        setLoading(false);
      }
    })();
  }, [childId]);

  // Filter children by class and age group
  const filteredChildren = useMemo(() => {
    let result = children;
    if (classId) {
      result = result.filter((ch) => ch.classRoomId === classId);
    }
    if (ageGroup) {
      result = result.filter((ch) => ageGroupKeyFromBirthDate(ch.birthDate) === ageGroup);
    }
    return result;
  }, [children, classId, ageGroup]);

  const childOptions = useMemo(() => {
    return [...filteredChildren].sort((a, b) => byString(a.firstName, b.firstName));
  }, [filteredChildren]);

  // Reset child selection when class changes and child is no longer in list
  useEffect(() => {
    if (classId && childId) {
      const stillValid = filteredChildren.some((ch) => ch.id === childId);
      if (!stillValid) setChildId("");
    }
  }, [classId, childId, filteredChildren]);

  const selectedChild = useMemo(() => {
    return children.find((ch) => ch.id === childId) || null;
  }, [children, childId]);

  const remediationMap = useMemo(() => {
    const map = new Map();
    for (const lesson of lessons) {
      const toLessons = (lesson?.remediationsFrom || [])
        .map((r) => r?.toLesson)
        .filter(Boolean);
      map.set(lesson.id, toLessons);
    }
    return map;
  }, [lessons]);

  const currentProgressByLessonId = useMemo(() => {
    const map = new Map();
    for (const pr of progressRows) {
      const existing = map.get(pr.lessonId);
      if (!existing) {
        map.set(pr.lessonId, pr);
        continue;
      }

      const a = Number(existing.goalIndex || 0);
      const b = Number(pr.goalIndex || 0);
      if (b > a) map.set(pr.lessonId, pr);
    }
    return map;
  }, [progressRows]);

  // Track all statuses per lesson (not just latest goal) for completed/failed filters
  const lessonStatusFlags = useMemo(() => {
    const map = new Map();
    for (const pr of progressRows) {
      if (!map.has(pr.lessonId)) map.set(pr.lessonId, { hasCompleted: false, hasFailed: false });
      const flags = map.get(pr.lessonId);
      if (pr.status === "COMPLETED" || pr.status === "PASSED") flags.hasCompleted = true;
      if (pr.status === "FAILED") flags.hasFailed = true;
    }
    return map;
  }, [progressRows]);

  const lessonRows = useMemo(() => {
    const rows = lessons.map((l) => {
      const pr = currentProgressByLessonId.get(l.id) || null;
      const draft = drafts[l.id] || { status: "IN_PROGRESS", notes: "" };
      const recommended = remediationMap.get(l.id) || [];

      return {
        lesson: l,
        progress: pr,
        draft,
        recommended,
      };
    });

    const sorted = rows.sort((a, b) => {
      const catA = a.lesson?.category?.name || "";
      const catB = b.lesson?.category?.name || "";
      const cmpCat = catA.localeCompare(catB);
      if (cmpCat !== 0) return cmpCat;
      return byString(a.lesson?.title, b.lesson?.title);
    });

    const q = String(query || "").trim().toLowerCase();
    const filtered = sorted.filter(({ lesson }) => {
      // Use lessonStatusFlags to check across ALL goals, not just the latest
      const flags = lessonStatusFlags.get(lesson.id);
      if (stage === "completed" && !flags?.hasCompleted) return false;
      if (stage === "failed" && !flags?.hasFailed) return false;
      if (category && (lesson?.category?.name || "") !== category) return false;
      if (!q) return true;
      const haystack = [
        lesson?.title,
        lesson?.description,
        lesson?.category?.name,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });

    return filtered;
  }, [
    lessons,
    currentProgressByLessonId,
    drafts,
    remediationMap,
    lessonStatusFlags,
    query,
    category,
    stage,
  ]);

  const categories = useMemo(() => {
    const set = new Set();
    for (const l of lessons) {
      const name = l?.category?.name;
      if (name) set.add(name);
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [lessons]);

  function setDraft(lessonId, next) {
    setDrafts((prev) => ({ ...prev, [lessonId]: { ...(prev[lessonId] || {}), ...next } }));
  }

  async function recordEntry(lessonId) {
    if (!childId) {
      setError("Select a child first.");
      return;
    }

    const draft = drafts[lessonId] || { status: "IN_PROGRESS", notes: "" };
    setSavingLessonId(lessonId);
    setError("");

    try {
      let progress = currentProgressByLessonId.get(lessonId) || null;
      if (!progress) {
        progress = await apiJson("/api/v1/progress", {
          method: "POST",
          body: JSON.stringify({
            childId,
            lessonId,
            status: "NOT_STARTED",
            goalIndex: 1,
          }),
        });
      }

      await apiJson(`/api/v1/progress/${encodeURIComponent(progress.id)}/entries`, {
        method: "POST",
        body: JSON.stringify({
          status: draft.status,
          notes: draft.notes || null,
        }),
      });

      const refreshed = await apiJson(`/api/v1/progress?childId=${encodeURIComponent(childId)}`);
      setProgressRows(Array.isArray(refreshed) ? refreshed : []);
      setDraft(lessonId, { notes: "" });
    } catch (e) {
      setError(e.message || "Failed to record progress");
    } finally {
      setSavingLessonId("");
    }
  }

  async function refreshProgress() {
    if (!childId) return;
    try {
      const p = await apiJson(`/api/v1/progress?childId=${encodeURIComponent(childId)}`);
      setProgressRows(Array.isArray(p) ? p : []);
    } catch {
      // silent
    }
  }

  // Fetch overview progress when center selected but no child
  useEffect(() => {
    if (!centerId || childId) {
      setOverviewProgress([]);
      return;
    }
    (async () => {
      setOverviewLoading(true);
      try {
        const allProgress = await apiJson("/api/v1/progress");
        setOverviewProgress(Array.isArray(allProgress) ? allProgress : []);
      } catch {
        setOverviewProgress([]);
      } finally {
        setOverviewLoading(false);
      }
    })();
  }, [centerId, childId]);

  const classById = useMemo(() => {
    const map = new Map();
    for (const cls of classes) map.set(cls.id, cls);
    return map;
  }, [classes]);

  const overviewStats = useMemo(() => {
    if (!overviewProgress.length) return null;

    let filtered = overviewProgress;
    if (classId) {
      filtered = filtered.filter((p) => p.child?.classRoomId === classId);
    }
    if (ageGroup) {
      filtered = filtered.filter((p) => ageGroupKeyFromBirthDate(p.child?.birthDate) === ageGroup);
    }

    // Count ALL progress records (every goal step counts)
    const statusCounts = { NOT_STARTED: 0, IN_PROGRESS: 0, COMPLETED: 0, PASSED: 0, FAILED: 0 };
    for (const p of filtered) {
      const s = p.status || "NOT_STARTED";
      if (s in statusCounts) statusCounts[s] += 1;
    }

    // Group by classroom
    const byClass = new Map();
    for (const p of filtered) {
      const cId = p.child?.classRoomId || "unassigned";
      if (!byClass.has(cId)) byClass.set(cId, { IN_PROGRESS: 0, done: 0, FAILED: 0, NOT_STARTED: 0 });
      const counts = byClass.get(cId);
      const s = p.status || "NOT_STARTED";
      if (s === "COMPLETED" || s === "PASSED") counts.done += 1;
      else if (s === "IN_PROGRESS") counts.IN_PROGRESS += 1;
      else if (s === "FAILED") counts.FAILED += 1;
      else counts.NOT_STARTED += 1;
    }

    // Group by age
    const byAge = new Map();
    for (const p of filtered) {
      const ageKey = ageGroupKeyFromBirthDate(p.child?.birthDate) || "Unknown";
      if (!byAge.has(ageKey)) byAge.set(ageKey, { IN_PROGRESS: 0, done: 0, FAILED: 0, NOT_STARTED: 0 });
      const counts = byAge.get(ageKey);
      const s = p.status || "NOT_STARTED";
      if (s === "COMPLETED" || s === "PASSED") counts.done += 1;
      else if (s === "IN_PROGRESS") counts.IN_PROGRESS += 1;
      else if (s === "FAILED") counts.FAILED += 1;
      else counts.NOT_STARTED += 1;
    }

    const uniqueChildren = new Set(filtered.map((p) => p.childId));

    return {
      totalGoals: filtered.length,
      totalChildren: uniqueChildren.size,
      statusCounts,
      byClass: [...byClass.entries()].sort(([a], [b]) => {
        const nameA = classById.get(a)?.name || a;
        const nameB = classById.get(b)?.name || b;
        return nameA.localeCompare(nameB);
      }),
      byAge: [...byAge.entries()].sort(([a], [b]) => {
        const idxA = AGE_GROUPS.findIndex((g) => g.key === a);
        const idxB = AGE_GROUPS.findIndex((g) => g.key === b);
        return (idxA === -1 ? 999 : idxA) - (idxB === -1 ? 999 : idxB);
      }),
    };
  }, [overviewProgress, classId, ageGroup, classById]);

  const childName = selectedChild
    ? `${selectedChild.firstName} ${selectedChild.lastName || ""}`.trim()
    : "";

  return (
    <TeacherLayout title="Progression Tracking">
      <div className="space-y-4">
        {/* Filters */}
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="text-lg font-extrabold text-gray-900">Progression Tracking</h2>
          <p className="mt-1 text-sm text-gray-600">
            Record developmental milestones, track goal progression, and manage corrective learning paths.
          </p>

          {error ? (
            <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              {error}
            </div>
          ) : null}

          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-5">
            <label className="block">
              <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
                Center
              </div>
              <select
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                value={centerId}
                onChange={(e) => setCenterId(e.target.value)}
                disabled={loading}
              >
                <option value="">Select a center...</option>
                {centers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
                Class / Group
              </div>
              <select
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                value={classId}
                onChange={(e) => setClassId(e.target.value)}
                disabled={!centerId || loading}
              >
                <option value="">All classes</option>
                {classes.map((cls) => (
                  <option key={cls.id} value={cls.id}>
                    {cls.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
                Age Group
              </div>
              <select
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                value={ageGroup}
                onChange={(e) => {
                  setAgeGroup(e.target.value);
                  setChildId("");
                }}
                disabled={!centerId || loading}
              >
                <option value="">All ages</option>
                {AGE_GROUPS.map((g) => (
                  <option key={g.key} value={g.key}>
                    {g.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
                Child
              </div>
              <select
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                value={childId}
                onChange={(e) => setChildId(e.target.value)}
                disabled={!centerId || loading}
              >
                <option value="">{centerId && !childId ? "Overview (all children)" : "Select a child..."}</option>
                {childOptions.map((ch) => (
                  <option key={ch.id} value={ch.id}>
                    {ch.firstName} {ch.lastName || ""}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
                Stage
              </div>
              <select
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                value={stage}
                onChange={(e) => {
                  setStage(e.target.value);
                  setVisibleCount(100);
                }}
              >
                {STAGE_FILTERS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        {/* Overview: shown under "All Goals" when no child is selected */}
        {stage !== "active" && !childId && centerId && (
          <ProgressOverview
            stats={overviewStats}
            loading={overviewLoading}
            classById={classById}
          />
        )}

        {/* Active Goals View */}
        {stage === "active" && childId && (
          <ActiveGoalsPanel
            childId={childId}
            childName={childName}
            progressRows={progressRows}
            lessons={lessons}
            remediationMap={remediationMap}
            onRefresh={refreshProgress}
          />
        )}
        {stage === "active" && !childId && centerId && (
          <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">
            Select a child to view their active goals.
          </div>
        )}

        {/* All Goals / Completed / Failed Table View (child selected) */}
        {stage !== "active" && childId && (
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-extrabold text-gray-900">
                {stage === "all" ? "All Lessons" : stage === "completed" ? "Completed Goals" : "Failed Goals"}
              </h3>
              {loading ? <div className="text-xs text-gray-600">Loading...</div> : null}
            </div>

            {!centerId ? (
              <div className="mt-3 text-sm text-gray-600">Select a center.</div>
            ) : lessonRows.length === 0 ? (
              <div className="mt-3 text-sm text-gray-600">No lessons found.</div>
            ) : (
              <div className="mt-3 space-y-3">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <label className="block">
                    <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Search
                    </div>
                    <input
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                      placeholder="Lesson title, category..."
                      value={query}
                      onChange={(e) => {
                        setQuery(e.target.value);
                        setVisibleCount(100);
                      }}
                    />
                  </label>
                  <label className="block">
                    <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Category
                    </div>
                    <select
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                      value={category}
                      onChange={(e) => {
                        setCategory(e.target.value);
                        setVisibleCount(100);
                      }}
                    >
                      <option value="">All categories</option>
                      {categories.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="text-xs text-gray-600">
                  Showing {Math.min(visibleCount, lessonRows.length)} of {lessonRows.length} lessons.
                </div>

                <div className="overflow-hidden rounded-xl border border-gray-200">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-500">
                    <tr>
                      <th className="px-4 py-3">Lesson</th>
                      <th className="px-4 py-3">Current Step</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Notes</th>
                      <th className="px-4 py-3">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {lessonRows.slice(0, visibleCount).map(({ lesson, progress, draft, recommended }) => {
                      const isFailed = (progress?.status || "") === "FAILED";
                      const lastUpdate = progress?.updatedAt || progress?.createdAt || null;

                      return (
                        <tr key={lesson.id} className={isFailed ? "bg-red-50/40" : ""}>
                          <td className="px-4 py-3 align-top">
                            <div className="font-semibold text-gray-900">{lesson.title}</div>
                            <div className="text-xs text-gray-500">
                              {(lesson?.category?.name || "Uncategorized") + " • Last: " + formatDate(lastUpdate)}
                            </div>
                            {isFailed && recommended.length ? (
                              <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">
                                <div className="font-semibold">Recommended lessons</div>
                                <ul className="mt-1 list-disc pl-5">
                                  {recommended.slice(0, 5).map((r) => (
                                    <li key={r.id}>{r.title}</li>
                                  ))}
                                </ul>
                              </div>
                            ) : null}
                          </td>

                          <td className="px-4 py-3 align-top text-gray-700">
                            {progress ? (
                              <div>
                                <div className="font-semibold text-gray-900">
                                  Goal {progress.goalIndex}
                                </div>
                                <div className="mt-1 text-xs text-gray-600">
                                  {(() => {
                                    const goals = Array.isArray(lesson?.goals)
                                      ? lesson.goals
                                      : [];
                                    const goal = goals.find(
                                      (g) =>
                                        Number(g.goalIndex || 0) ===
                                        Number(progress.goalIndex || 0),
                                    );
                                    return goal?.title || "—";
                                  })()}
                                </div>
                              </div>
                            ) : (
                              "—"
                            )}
                          </td>

                          <td className="px-4 py-3 align-top">
                            <div className="text-xs text-gray-500">Current: {progress?.status || "—"}</div>
                            <select
                              className="mt-1 w-full rounded-lg border border-gray-200 px-2 py-2 text-sm"
                              value={draft.status || "IN_PROGRESS"}
                              onChange={(e) => setDraft(lesson.id, { status: e.target.value })}
                              disabled={savingLessonId === lesson.id}
                            >
                              {STATUSES.map((s) => (
                                <option key={s} value={s}>
                                  {s}
                                </option>
                              ))}
                            </select>
                          </td>

                          <td className="px-4 py-3 align-top">
                            <input
                              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                              placeholder="Optional notes..."
                              value={draft.notes || ""}
                              onChange={(e) => setDraft(lesson.id, { notes: e.target.value })}
                              disabled={savingLessonId === lesson.id}
                            />
                          </td>

                          <td className="px-4 py-3 align-top">
                            <button
                              type="button"
                              className="rounded-lg bg-gradient-to-r from-violet-600 to-pink-500 px-3 py-2 text-xs font-semibold text-white hover:from-violet-700 hover:to-pink-600 disabled:opacity-60"
                              onClick={() => recordEntry(lesson.id)}
                              disabled={savingLessonId === lesson.id}
                            >
                              {savingLessonId === lesson.id ? "Saving..." : "Record"}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                </div>

                {lessonRows.length > visibleCount ? (
                  <button
                    type="button"
                    className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
                    onClick={() => setVisibleCount((n) => n + 100)}
                  >
                    Load 100 more
                  </button>
                ) : null}
              </div>
            )}
          </div>
        )}
      </div>
    </TeacherLayout>
  );
}

/* ── Progress Overview Panel ───────────────────────── */

function ProgressOverview({ stats, loading, classById }) {
  if (loading) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">
        Loading progress overview...
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">
        No progress data found. Select a child to start tracking goals.
      </div>
    );
  }

  const { statusCounts, byClass, byAge, totalGoals, totalChildren } = stats;

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <OverviewCard label="Total Goals" count={totalGoals} color="sky" sub={`${totalChildren} children`} />
        <OverviewCard label="In Progress" count={statusCounts.IN_PROGRESS} color="amber" />
        <OverviewCard label="Completed" count={statusCounts.COMPLETED + statusCounts.PASSED} color="emerald" />
        <OverviewCard label="Failed" count={statusCounts.FAILED} color="red" />
        <OverviewCard label="Not Started" count={statusCounts.NOT_STARTED} color="gray" />
      </div>

      {/* By Classroom */}
      {byClass.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <h3 className="text-sm font-extrabold text-gray-900">Progress by Classroom</h3>
          <div className="mt-3 overflow-hidden rounded-lg border border-gray-200">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-2">Classroom</th>
                  <th className="px-4 py-2 text-center">In Progress</th>
                  <th className="px-4 py-2 text-center">Completed</th>
                  <th className="px-4 py-2 text-center">Failed</th>
                  <th className="px-4 py-2 text-center">Not Started</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {byClass.map(([classRoomId, counts]) => (
                  <tr key={classRoomId}>
                    <td className="px-4 py-2 font-semibold text-gray-900">
                      {classById.get(classRoomId)?.name || (classRoomId === "unassigned" ? "Unassigned" : classRoomId)}
                    </td>
                    <td className="px-4 py-2 text-center">
                      {counts.IN_PROGRESS > 0 ? <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">{counts.IN_PROGRESS}</span> : <span className="text-gray-300">0</span>}
                    </td>
                    <td className="px-4 py-2 text-center">
                      {counts.done > 0 ? <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">{counts.done}</span> : <span className="text-gray-300">0</span>}
                    </td>
                    <td className="px-4 py-2 text-center">
                      {counts.FAILED > 0 ? <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-800">{counts.FAILED}</span> : <span className="text-gray-300">0</span>}
                    </td>
                    <td className="px-4 py-2 text-center">
                      {counts.NOT_STARTED > 0 ? <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-700">{counts.NOT_STARTED}</span> : <span className="text-gray-300">0</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* By Age Group */}
      {byAge.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <h3 className="text-sm font-extrabold text-gray-900">Progress by Age Group</h3>
          <div className="mt-3 overflow-hidden rounded-lg border border-gray-200">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-2">Age Group</th>
                  <th className="px-4 py-2 text-center">In Progress</th>
                  <th className="px-4 py-2 text-center">Completed</th>
                  <th className="px-4 py-2 text-center">Failed</th>
                  <th className="px-4 py-2 text-center">Not Started</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {byAge.map(([ageKey, counts]) => {
                  const group = AGE_GROUPS.find((g) => g.key === ageKey);
                  return (
                    <tr key={ageKey}>
                      <td className="px-4 py-2 font-semibold text-gray-900">
                        {group?.label || ageKey}
                      </td>
                      <td className="px-4 py-2 text-center">
                        {counts.IN_PROGRESS > 0 ? <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">{counts.IN_PROGRESS}</span> : <span className="text-gray-300">0</span>}
                      </td>
                      <td className="px-4 py-2 text-center">
                        {counts.done > 0 ? <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">{counts.done}</span> : <span className="text-gray-300">0</span>}
                      </td>
                      <td className="px-4 py-2 text-center">
                        {counts.FAILED > 0 ? <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-800">{counts.FAILED}</span> : <span className="text-gray-300">0</span>}
                      </td>
                      <td className="px-4 py-2 text-center">
                        {counts.NOT_STARTED > 0 ? <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-700">{counts.NOT_STARTED}</span> : <span className="text-gray-300">0</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function OverviewCard({ label, count, color, sub }) {
  const colorMap = {
    sky: "border-sky-200 bg-sky-50 text-sky-800",
    amber: "border-amber-200 bg-amber-50 text-amber-800",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-800",
    red: "border-red-200 bg-red-50 text-red-800",
    gray: "border-gray-200 bg-gray-50 text-gray-700",
  };
  return (
    <div className={`rounded-xl border p-4 ${colorMap[color] || colorMap.gray}`}>
      <div className="text-2xl font-extrabold">{count}</div>
      <div className="text-xs font-semibold uppercase tracking-wide">{label}</div>
      {sub ? <div className="mt-0.5 text-xs opacity-70">{sub}</div> : null}
    </div>
  );
}
