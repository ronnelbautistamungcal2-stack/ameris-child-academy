import TeacherLayout from "@/components/teacher/TeacherLayout";
import { apiJson } from "@/lib/api";
import { useEffect, useMemo, useState } from "react";

function byString(a, b) {
  return String(a || "").localeCompare(String(b || ""));
}

function isProbablyLink(value) {
  const s = String(value || "").trim();
  if (!s) return false;
  return s.startsWith("http://") || s.startsWith("https://") || s.startsWith("/");
}

export default function TeacherLessons() {
  const [centers, setCenters] = useState([]);
  const [centerId, setCenterId] = useState("");
  const [lessons, setLessons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [visibleCount, setVisibleCount] = useState(50);
  const [expandedLessonId, setExpandedLessonId] = useState("");

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
        setLessons([]);
        setQuery("");
        setCategory("");
        setVisibleCount(50);
        setExpandedLessonId("");
        return;
      }
      setLoading(true);
      setError("");
      try {
        const l = await apiJson(
          `/api/v1/lessons?centerId=${encodeURIComponent(centerId)}`,
        );
        setLessons(Array.isArray(l) ? l : []);
      } catch (e) {
        setError(e.message || "Failed to load lessons");
      } finally {
        setLoading(false);
      }
    })();
  }, [centerId]);

  const categories = useMemo(() => {
    const set = new Set();
    for (const l of lessons) {
      const name = l?.category?.name;
      if (name) set.add(name);
    }
    return [...set].sort((a, b) => byString(a, b));
  }, [lessons]);

  const filteredLessons = useMemo(() => {
    const q = String(query || "").trim().toLowerCase();
    const filtered = [...lessons].filter((l) => {
      if (category && (l?.category?.name || "") !== category) return false;
      if (!q) return true;
      const haystack = [l?.title, l?.description, l?.category?.name]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });

    return filtered.sort((a, b) => byString(a.title, b.title));
  }, [lessons, query, category]);

  return (
    <TeacherLayout title="Lessons & Media">
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="text-lg font-extrabold">Lesson Plans & Training Media</h2>
        <p className="mt-1 text-sm text-gray-600">
          View lesson guides (steps, testing questions) and linked media for your
          center.
        </p>

        {error ? (
          <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {error}
          </div>
        ) : null}

        <div className="mt-4">
          <label className="block max-w-lg">
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
        </div>

        {centerId ? (
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
            <label className="block md:col-span-2">
              <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
                Search
              </div>
              <input
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                placeholder="Lesson title, description, category…"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setVisibleCount(50);
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
                  setVisibleCount(50);
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
        ) : null}

        <div className="mt-4">
          {loading ? (
            <div className="text-sm text-gray-600">Loading…</div>
          ) : filteredLessons.length === 0 ? (
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
              No lessons found.
            </div>
          ) : (
            <div className="space-y-3">
              <div className="text-xs text-gray-600">
                Showing {Math.min(visibleCount, filteredLessons.length)} of{" "}
                {filteredLessons.length} lessons.
              </div>

              {filteredLessons.slice(0, visibleCount).map((l) => {
                const expanded = expandedLessonId === l.id;
                const goals = Array.isArray(l.goals) ? l.goals : [];
                const guideCount = goals.length;

                return (
                  <div key={l.id} className="rounded-xl border border-gray-200 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-base font-extrabold text-gray-900">
                          {l.title}
                        </div>
                        <div className="mt-1 text-xs text-gray-500">
                          {(l?.category?.name || "Uncategorized") +
                            (guideCount ? ` • ${guideCount} steps` : "")}
                        </div>
                        <div className="text-sm text-gray-600">
                          {l.description || "—"}
                        </div>
                      </div>

                      <button
                        type="button"
                        className="shrink-0 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-800 hover:bg-gray-50"
                        onClick={() => setExpandedLessonId(expanded ? "" : l.id)}
                      >
                        {expanded ? "Hide guide" : "View guide"}
                      </button>
                    </div>

                    <div className="mt-3">
                      <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                        Media
                      </div>
                      {Array.isArray(l.media) && l.media.length ? (
                        <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
                          {l.media.map((m) => (
                            <li key={m}>
                              <a
                                href={m}
                                target="_blank"
                                rel="noreferrer"
                                className="text-blue-600 hover:text-blue-700"
                              >
                                {m}
                              </a>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <div className="mt-1 text-sm text-gray-600">—</div>
                      )}
                    </div>

                    {expanded ? (
                      <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-4">
                        <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                          Lesson Guide (Steps)
                        </div>
                        {goals.length ? (
                          <div className="mt-2 space-y-2">
                            {goals
                              .slice()
                              .sort(
                                (a, b) =>
                                  Number(a.goalIndex || 0) -
                                  Number(b.goalIndex || 0),
                              )
                              .map((g) => {
                                const criteria = g?.passingCriteria || {};
                                const resource = criteria?.resource || "";
                                const additional =
                                  criteria?.additionalResources || "";
                                const notes = criteria?.notes || "";

                                return (
                                  <div
                                    key={g.id || `${l.id}:${g.goalIndex}`}
                                    className="rounded-lg border border-gray-200 bg-white p-3"
                                  >
                                    <div className="text-sm font-semibold text-gray-900">
                                      Step {g.goalIndex}: {g.title}
                                    </div>

                                    {g.description ? (
                                      <div className="mt-1 text-sm text-gray-700">
                                        <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                                          Testing question / criteria
                                        </div>
                                        <div className="mt-1 whitespace-pre-wrap">
                                          {g.description}
                                        </div>
                                      </div>
                                    ) : null}

                                    {resource || additional || notes ? (
                                      <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-3">
                                        {resource ? (
                                          <div className="text-xs text-gray-700">
                                            <div className="font-semibold text-gray-500">
                                              Resource
                                            </div>
                                            {isProbablyLink(resource) ? (
                                              <a
                                                className="text-blue-600 hover:text-blue-700"
                                                href={resource}
                                                target="_blank"
                                                rel="noreferrer"
                                              >
                                                {resource}
                                              </a>
                                            ) : (
                                              <div className="whitespace-pre-wrap">
                                                {String(resource)}
                                              </div>
                                            )}
                                          </div>
                                        ) : null}
                                        {additional ? (
                                          <div className="text-xs text-gray-700">
                                            <div className="font-semibold text-gray-500">
                                              Additional
                                            </div>
                                            <div className="whitespace-pre-wrap">
                                              {String(additional)}
                                            </div>
                                          </div>
                                        ) : null}
                                        {notes ? (
                                          <div className="text-xs text-gray-700">
                                            <div className="font-semibold text-gray-500">
                                              Notes
                                            </div>
                                            <div className="whitespace-pre-wrap">
                                              {String(notes)}
                                            </div>
                                          </div>
                                        ) : null}
                                      </div>
                                    ) : null}
                                  </div>
                                );
                              })}
                          </div>
                        ) : (
                          <div className="mt-2 text-sm text-gray-600">
                            No steps added yet.
                          </div>
                        )}
                      </div>
                    ) : null}
                  </div>
                );
              })}

              {filteredLessons.length > visibleCount ? (
                <button
                  type="button"
                  className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
                  onClick={() => setVisibleCount((n) => n + 50)}
                >
                  Load 50 more
                </button>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </TeacherLayout>
  );
}

