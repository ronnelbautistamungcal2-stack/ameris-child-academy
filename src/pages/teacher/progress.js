import TeacherLayout from "@/components/teacher/TeacherLayout";
import { apiJson } from "@/lib/api";
import { useEffect, useMemo, useState } from "react";

const STATUSES = ["NOT_STARTED", "IN_PROGRESS", "PASSED", "FAILED", "COMPLETED"];

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

  const [children, setChildren] = useState([]);
  const [childId, setChildId] = useState("");

  const [lessons, setLessons] = useState([]);
  const [progressRows, setProgressRows] = useState([]);

  const [drafts, setDrafts] = useState({});
  const [savingLessonId, setSavingLessonId] = useState("");

  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [failedOnly, setFailedOnly] = useState(false);
  const [visibleCount, setVisibleCount] = useState(100);

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
        setLessons([]);
        setChildId("");
        setProgressRows([]);
        setQuery("");
        setCategory("");
        setFailedOnly(false);
        setVisibleCount(100);
        return;
      }

      setLoading(true);
      setError("");
      try {
        const [kids, l] = await Promise.all([
          apiJson(`/api/v1/children?centerId=${encodeURIComponent(centerId)}`),
          apiJson(`/api/v1/lessons?centerId=${encodeURIComponent(centerId)}`),
        ]);
        setChildren(Array.isArray(kids) ? kids : []);
        setLessons(Array.isArray(l) ? l : []);
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

  const childOptions = useMemo(() => {
    return [...children].sort((a, b) => byString(a.firstName, b.firstName));
  }, [children]);

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
    const filtered = sorted.filter(({ lesson, progress }) => {
      if (failedOnly && (progress?.status || "") !== "FAILED") return false;
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
    query,
    category,
    failedOnly,
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

  return (
    <TeacherLayout title="Progress Tracking">
      <div className="space-y-4">
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="text-lg font-extrabold text-gray-900">Progress Tracking</h2>
          <p className="mt-1 text-sm text-gray-600">
            Record steps of progression updates for a child and see recommended lessons when a step fails.
          </p>

          {error ? (
            <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              {error}
            </div>
          ) : null}

          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
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
                <option value="">Select a center…</option>
                {centers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
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
                <option value="">Select a child…</option>
                {childOptions.map((ch) => (
                  <option key={ch.id} value={ch.id}>
                    {ch.firstName} {ch.lastName || ""}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-extrabold text-gray-900">Lessons</h3>
            {loading ? <div className="text-xs text-gray-600">Loading…</div> : null}
          </div>

          {!centerId ? (
            <div className="mt-3 text-sm text-gray-600">Select a center.</div>
          ) : !childId ? (
            <div className="mt-3 text-sm text-gray-600">Select a child.</div>
          ) : lessonRows.length === 0 ? (
            <div className="mt-3 text-sm text-gray-600">No lessons found.</div>
          ) : (
            <div className="mt-3 space-y-3">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <label className="block">
                  <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Search
                  </div>
                  <input
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                    placeholder="Lesson title, category…"
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
                <label className="flex items-end gap-2">
                  <input
                    type="checkbox"
                    checked={failedOnly}
                    onChange={(e) => {
                      setFailedOnly(e.target.checked);
                      setVisibleCount(100);
                    }}
                  />
                  <span className="text-sm text-gray-800">Show failed only</span>
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
                            placeholder="Optional notes…"
                            value={draft.notes || ""}
                            onChange={(e) => setDraft(lesson.id, { notes: e.target.value })}
                            disabled={savingLessonId === lesson.id}
                          />
                        </td>

                        <td className="px-4 py-3 align-top">
                          <button
                            type="button"
                            className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                            onClick={() => recordEntry(lesson.id)}
                            disabled={savingLessonId === lesson.id}
                          >
                            {savingLessonId === lesson.id ? "Saving…" : "Record"}
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
      </div>
    </TeacherLayout>
  );
}
