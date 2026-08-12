import TeacherLayout from "@/components/teacher/TeacherLayout";
import { SkeletonCard } from "@/components/ui/Skeleton";
import EmptyState from "@/components/ui/EmptyState";
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
  const [loadingMore, setLoadingMore] = useState(false);

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
            <div className="space-y-3">
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </div>
          ) : filteredLessons.length === 0 ? (
            <EmptyState
              title="No lessons found"
              description={query || category ? "Try adjusting your search or category filter." : "No lessons are available for this center yet."}
              icon={
                <svg viewBox="0 0 24 24" className="h-12 w-12" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                </svg>
              }
            />
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
                        {l.policyDocument && (
                          <a href={l.policyDocument.url} target="_blank" rel="noreferrer"
                            className="mt-1 inline-block rounded-full bg-indigo-100 px-2 py-0.5 text-xs text-indigo-700 hover:bg-indigo-200 no-underline">
                            Policy: {l.policyDocument.title}
                          </a>
                        )}
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
                                const link = criteria?.link || "";
                                const timeRequired = criteria?.timeRequired || "";
                                const instructionalSetting =
                                  criteria?.instructionalSetting || "";
                                const introduction = criteria?.introduction || "";
                                const essentialQuestions =
                                  criteria?.essentialQuestions || "";
                                const keyVocabulary = criteria?.keyVocabulary || "";
                                const learningActivities =
                                  criteria?.learningActivities || "";
                                const accommodations = criteria?.accommodations || "";
                                const notesToTeacher = criteria?.notesToTeacher || "";

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

                                    {timeRequired || instructionalSetting || link ? (
                                      <div className="mt-2 flex flex-wrap gap-3 text-xs text-gray-600">
                                        {timeRequired ? (
                                          <span>
                                            <span className="font-semibold text-gray-500">Time: </span>
                                            {timeRequired}
                                          </span>
                                        ) : null}
                                        {instructionalSetting ? (
                                          <span>
                                            <span className="font-semibold text-gray-500">Setting: </span>
                                            {instructionalSetting}
                                          </span>
                                        ) : null}
                                        {link ? (
                                          <a
                                            className="text-blue-600 hover:text-blue-700"
                                            href={link}
                                            target="_blank"
                                            rel="noreferrer"
                                          >
                                            {link}
                                          </a>
                                        ) : null}
                                      </div>
                                    ) : null}

                                    {introduction ||
                                    essentialQuestions ||
                                    keyVocabulary ||
                                    learningActivities ||
                                    accommodations ||
                                    notesToTeacher ? (
                                      <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
                                        {[
                                          { label: "Introduction", value: introduction },
                                          { label: "Essential questions", value: essentialQuestions },
                                          { label: "Key vocabulary", value: keyVocabulary },
                                          { label: "Learning activities", value: learningActivities },
                                          { label: "Accommodations/Modifications", value: accommodations },
                                          { label: "Notes to teacher", value: notesToTeacher },
                                        ]
                                          .filter((item) => item.value)
                                          .map((item) => (
                                            <div key={item.label} className="text-xs text-gray-700">
                                              <div className="font-semibold text-gray-500">
                                                {item.label}
                                              </div>
                                              <div className="mt-0.5 whitespace-pre-wrap">
                                                {item.value}
                                              </div>
                                            </div>
                                          ))}
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

                        {l.supplies && l.supplies.length > 0 ? (
                          <div className="mt-4">
                            <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                              Supplies Needed
                            </div>
                            <div className="mt-2 space-y-1">
                              {l.supplies.map((s, sIdx) => (
                                <div
                                  key={s.id || sIdx}
                                  className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
                                >
                                  <div>
                                    <span className="font-semibold text-gray-900">{s.name}</span>
                                    <span className="ml-2 text-gray-500">
                                      x{s.quantity}{s.unit ? ` ${s.unit}` : ""}
                                      {" · "}
                                      {s.quantityType === "per_student" ? "per student" : "total"}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-600">{s.category}</span>
                                    {s.estimatedCost ? (
                                      <span className="text-xs text-gray-500">${Number(s.estimatedCost).toFixed(2)}</span>
                                    ) : null}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    ) : null}

                    <div className="mt-3 border-t border-gray-100 pt-2 text-[11px] text-gray-400">
                      &copy; {new Date().getFullYear()} Ameris Academy Inc. All rights reserved.
                    </div>
                  </div>
                );
              })}

              {filteredLessons.length > visibleCount ? (
                <button
                  type="button"
                  disabled={loadingMore}
                  className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-800 hover:bg-gray-50 disabled:opacity-60 transition"
                  onClick={() => {
                    setLoadingMore(true);
                    setTimeout(() => {
                      setVisibleCount((n) => n + 50);
                      setLoadingMore(false);
                    }, 100);
                  }}
                >
                  {loadingMore ? (
                    <svg className="h-4 w-4 animate-spin text-gray-500" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  ) : null}
                  Load 50 more ({filteredLessons.length - visibleCount} remaining)
                </button>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </TeacherLayout>
  );
}

