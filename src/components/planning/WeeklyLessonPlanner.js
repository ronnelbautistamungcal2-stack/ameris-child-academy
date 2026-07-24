import { apiJson } from "@/lib/api";
import { useCallback, useEffect, useRef, useState } from "react";

const ROW_COUNT = 10;
const DEFAULT_PLAN_TITLE = "Lesson Planner";

const DEFAULT_ROW_LABELS = [
  "Hymn",
  "Large Group 1",
  "Small Group 1",
  "Small Group 2",
  "Outdoor Time 1",
  "Transition Activity 1",
  "Transition Activity 2",
  "Large Group 2",
  "Small Group 3",
  "Small Group 4",
];

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfWeekMonday(date) {
  const d = startOfDay(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function toDateKey(date) {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "";
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function toIsoDate(date) {
  return startOfDay(date).toISOString();
}

function formatDayHeader(date) {
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function formatWeekRange(weekStart) {
  const end = addDays(weekStart, 4);
  const opts = { month: "short", day: "numeric" };
  return `${weekStart.toLocaleDateString(undefined, opts)} – ${end.toLocaleDateString(undefined, opts)}`;
}

export default function WeeklyLessonPlanner({
  centerId,
  classId = "",
  mode = "teacher",
}) {
  const [anchorDate, setAnchorDate] = useState(() => startOfWeekMonday(new Date()));

  // Category row labels
  const [rowLabels, setRowLabels] = useState(() =>
    Array.from({ length: ROW_COUNT }, (_, i) => DEFAULT_ROW_LABELS[i] || ""),
  );
  const [labelDrafts, setLabelDrafts] = useState(() =>
    Array.from({ length: ROW_COUNT }, (_, i) => DEFAULT_ROW_LABELS[i] || ""),
  );

  // plans: one per day key → { id, items: [{id, sortOrder, title}] }
  const [planByDayKey, setPlanByDayKey] = useState({});

  // cell drafts: "dayKey:rowIndex" → text
  const [cellDrafts, setCellDrafts] = useState({});
  // cell lesson attachments: "dayKey:rowIndex" → lessonId | null
  const [cellLessonIds, setCellLessonIds] = useState({});

  // curriculum lessons for this center, used for the cell typeahead (admin only)
  const [lessons, setLessons] = useState([]);
  const [openComboKey, setOpenComboKey] = useState("");

  // lesson detail viewer (teacher/coach click-through)
  const [viewLessonId, setViewLessonId] = useState("");
  const [viewLesson, setViewLesson] = useState(null);
  const [viewLessonLoading, setViewLessonLoading] = useState(false);
  const [viewLessonError, setViewLessonError] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const weekStart = startOfWeekMonday(anchorDate);
  const weekDays = Array.from({ length: 5 }, (_, i) => addDays(weekStart, i));

  const abortRef = useRef({ aborted: false });
  useEffect(() => {
    abortRef.current.aborted = false;
    return () => { abortRef.current.aborted = true; };
  }, []);

  // Load row labels for this classroom
  useEffect(() => {
    if (!centerId || !classId) {
      setRowLabels(Array.from({ length: ROW_COUNT }, (_, i) => DEFAULT_ROW_LABELS[i] || ""));
      setLabelDrafts(Array.from({ length: ROW_COUNT }, (_, i) => DEFAULT_ROW_LABELS[i] || ""));
      return;
    }
    (async () => {
      try {
        const data = await apiJson(
          `/api/v1/lesson-plan-rows?centerId=${encodeURIComponent(centerId)}&classRoomId=${encodeURIComponent(classId)}`,
        );
        if (abortRef.current.aborted) return;
        const arr = Array.isArray(data) ? data : [];
        const labels = Array.from({ length: ROW_COUNT }, (_, i) => {
          const found = arr.find((r) => r.rowIndex === i);
          return found?.label || DEFAULT_ROW_LABELS[i] || "";
        });
        setRowLabels(labels);
        setLabelDrafts(labels);
      } catch {
        // keep defaults
      }
    })();
  }, [centerId, classId]);

  // Load curriculum lessons for the typeahead (admin only)
  useEffect(() => {
    if (!centerId || mode !== "admin") {
      setLessons([]);
      return;
    }
    (async () => {
      try {
        const data = await apiJson(`/api/v1/lessons?centerId=${encodeURIComponent(centerId)}`);
        if (abortRef.current.aborted) return;
        setLessons(Array.isArray(data) ? data : []);
      } catch {
        // typeahead just won't have suggestions
      }
    })();
  }, [centerId, mode]);

  // Load plans for the current week
  const loadPlans = useCallback(async () => {
    if (!centerId || !classId) {
      setPlanByDayKey({});
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const from = toIsoDate(weekStart);
      const to = toIsoDate(addDays(weekStart, 5));
      const qs = new URLSearchParams({ centerId, classRoomId: classId, period: "DAY", from, to });
      const data = await apiJson(`/api/v1/milestone-checklists?${qs}`);
      if (abortRef.current.aborted) return;
      const plans = Array.isArray(data) ? data : [];
      const map = {};
      for (const plan of plans) {
        const key = toDateKey(plan.periodStart);
        // keep the first plan per day (title = DEFAULT_PLAN_TITLE preferred)
        if (!map[key] || plan.title === DEFAULT_PLAN_TITLE) {
          map[key] = plan;
        }
      }
      setPlanByDayKey(map);
      // initialise cell drafts from loaded data
      setCellDrafts((prev) => {
        const next = { ...prev };
        for (const [dayKey, plan] of Object.entries(map)) {
          for (const item of Array.isArray(plan.items) ? plan.items : []) {
            const cellKey = `${dayKey}:${item.sortOrder}`;
            if (!(cellKey in next)) next[cellKey] = item.title || "";
          }
        }
        return next;
      });
      setCellLessonIds((prev) => {
        const next = { ...prev };
        for (const [dayKey, plan] of Object.entries(map)) {
          for (const item of Array.isArray(plan.items) ? plan.items : []) {
            const cellKey = `${dayKey}:${item.sortOrder}`;
            if (!(cellKey in next)) next[cellKey] = item.lessonId || null;
          }
        }
        return next;
      });
    } catch (e) {
      if (!abortRef.current.aborted) setError(e.message || "Failed to load plans");
    } finally {
      if (!abortRef.current.aborted) setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [centerId, classId, toDateKey(weekStart)]);

  useEffect(() => { loadPlans(); }, [loadPlans]);

  function getCellText(dayKey, rowIndex) {
    const cellKey = `${dayKey}:${rowIndex}`;
    if (cellKey in cellDrafts) return cellDrafts[cellKey];
    const plan = planByDayKey[dayKey];
    const item = (plan?.items || []).find((it) => it.sortOrder === rowIndex);
    return item?.title || "";
  }

  function getCellLessonId(dayKey, rowIndex) {
    const cellKey = `${dayKey}:${rowIndex}`;
    if (cellKey in cellLessonIds) return cellLessonIds[cellKey];
    const plan = planByDayKey[dayKey];
    const item = (plan?.items || []).find((it) => it.sortOrder === rowIndex);
    return item?.lessonId || null;
  }

  function suggestionsFor(cellKey) {
    const q = String(cellDrafts[cellKey] ?? "").trim().toLowerCase();
    const pool = q
      ? lessons.filter((l) => (l.title || "").toLowerCase().includes(q))
      : lessons;
    return pool.slice(0, 8);
  }

  async function ensurePlan(dayKey) {
    if (planByDayKey[dayKey]) return planByDayKey[dayKey];
    if (!centerId || !classId) return null;
    const day = new Date(dayKey);
    if (Number.isNaN(day.getTime())) return null;

    const created = await apiJson("/api/v1/milestone-checklists", {
      method: "POST",
      body: JSON.stringify({
        centerId,
        classRoomId: classId,
        title: DEFAULT_PLAN_TITLE,
        description: null,
        period: "DAY",
        periodStart: toIsoDate(day),
        active: true,
        items: [],
      }),
    });
    setPlanByDayKey((cur) => ({ ...cur, [dayKey]: created }));
    return created;
  }

  async function saveCellValue(dayKey, rowIndex, text, lessonId = null) {
    if (mode !== "admin") return;
    setSaving(true);
    setError("");
    try {
      const plan = await ensurePlan(dayKey);
      if (!plan) return;

      const existingItems = Array.isArray(plan.items) ? plan.items : [];
      // build new items array: replace/add the item at this rowIndex, keep others
      const others = existingItems.filter((it) => it.sortOrder !== rowIndex);
      const nextItems = [
        ...others.map((it) => ({
          title: it.title || "",
          sortOrder: it.sortOrder,
          lessonId: it.lessonId || null,
          lessonGoalId: it.lessonGoalId || null,
          policyDocumentId: it.policyDocumentId || null,
          url: it.url || null,
          notes: it.notes || null,
        })),
      ];
      if (text.trim() || lessonId) {
        nextItems.push({ title: text.trim(), sortOrder: rowIndex, lessonId: lessonId || null });
      }
      nextItems.sort((a, b) => a.sortOrder - b.sortOrder);

      const updated = await apiJson(
        `/api/v1/milestone-checklists/${encodeURIComponent(plan.id)}`,
        { method: "PUT", body: JSON.stringify({ items: nextItems }) },
      );
      setPlanByDayKey((cur) => ({ ...cur, [dayKey]: updated }));
    } catch (e) {
      setError(e.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  function selectLessonForCell(dayKey, rowIndex, lesson) {
    const cellKey = `${dayKey}:${rowIndex}`;
    setCellDrafts((prev) => ({ ...prev, [cellKey]: lesson.title }));
    setCellLessonIds((prev) => ({ ...prev, [cellKey]: lesson.id }));
    setOpenComboKey("");
    saveCellValue(dayKey, rowIndex, lesson.title, lesson.id);
  }

  async function openLessonDetail(lessonId) {
    if (!lessonId) return;
    setViewLessonId(lessonId);
    setViewLesson(null);
    setViewLessonError("");
    setViewLessonLoading(true);
    try {
      const data = await apiJson(`/api/v1/lessons/${encodeURIComponent(lessonId)}`);
      setViewLesson(data);
    } catch (e) {
      setViewLessonError(e.message || "Failed to load lesson");
    } finally {
      setViewLessonLoading(false);
    }
  }

  function closeLessonDetail() {
    setViewLessonId("");
    setViewLesson(null);
    setViewLessonError("");
  }

  async function saveLabelValue(rowIndex, label) {
    if (mode !== "admin") return;
    const trimmed = label.trim();
    setRowLabels((prev) => {
      const next = [...prev];
      next[rowIndex] = trimmed;
      return next;
    });
    try {
      await apiJson("/api/v1/lesson-plan-rows", {
        method: "PUT",
        body: JSON.stringify({ centerId, classRoomId: classId, rowIndex, label: trimmed }),
      });
    } catch {
      // non-critical, label already updated in state
    }
  }

  function goToPrevWeek() {
    setAnchorDate((d) => addDays(d, -7));
    setCellDrafts({});
    setCellLessonIds({});
    setOpenComboKey("");
  }

  function goToNextWeek() {
    setAnchorDate((d) => addDays(d, 7));
    setCellDrafts({});
    setCellLessonIds({});
    setOpenComboKey("");
  }

  function goToToday() {
    setAnchorDate(startOfWeekMonday(new Date()));
    setCellDrafts({});
    setCellLessonIds({});
    setOpenComboKey("");
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white">
      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 px-4 py-3">
        <div>
          <div className="text-sm font-extrabold text-gray-900">Lesson Plan</div>
          <div className="mt-0.5 text-xs text-gray-500">{formatWeekRange(weekStart)}</div>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={goToPrevWeek}
            className="rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
          >
            Prev
          </button>
          <button
            type="button"
            onClick={goToToday}
            className="rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
          >
            Today
          </button>
          <button
            type="button"
            onClick={goToNextWeek}
            className="rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
          >
            Next
          </button>
          {saving && (
            <span className="ml-1 text-xs text-sky-600 font-semibold">Saving…</span>
          )}
        </div>
      </div>

      {error ? (
        <div className="mx-4 mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="px-4 py-8 text-center text-sm text-gray-500">Loading…</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px] border-collapse text-sm">
            <thead>
              <tr className="bg-gray-50">
                <th className="border-b border-r border-gray-200 px-3 py-2 text-left text-xs font-semibold text-gray-500 w-36">
                  Categories
                </th>
                {weekDays.map((d) => (
                  <th
                    key={toDateKey(d)}
                    className="border-b border-r border-gray-200 px-3 py-2 text-center text-xs font-semibold text-gray-700"
                  >
                    {formatDayHeader(d)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: ROW_COUNT }, (_, rowIndex) => (
                <tr key={rowIndex} className="group hover:bg-gray-50/60">
                  {/* Category label cell */}
                  <td className="border-b border-r border-gray-200 px-2 py-1.5 align-middle bg-gray-50/80">
                    {mode === "admin" ? (
                      <input
                        type="text"
                        value={labelDrafts[rowIndex] ?? rowLabels[rowIndex] ?? ""}
                        onChange={(e) =>
                          setLabelDrafts((prev) => {
                            const next = [...prev];
                            next[rowIndex] = e.target.value;
                            return next;
                          })
                        }
                        onBlur={(e) => saveLabelValue(rowIndex, e.target.value)}
                        placeholder={DEFAULT_ROW_LABELS[rowIndex] || `Row ${rowIndex + 1}`}
                        className="w-full rounded border border-transparent bg-transparent px-1 py-0.5 text-xs font-semibold text-gray-700 placeholder-gray-300 outline-none transition focus:border-sky-300 focus:bg-white focus:ring-1 focus:ring-sky-100"
                      />
                    ) : (
                      <span className="block px-1 text-xs font-semibold text-gray-700">
                        {rowLabels[rowIndex] || DEFAULT_ROW_LABELS[rowIndex] || `Row ${rowIndex + 1}`}
                      </span>
                    )}
                  </td>

                  {/* Lesson cells for each day */}
                  {weekDays.map((d) => {
                    const dayKey = toDateKey(d);
                    const cellKey = `${dayKey}:${rowIndex}`;
                    const cellText = getCellText(dayKey, rowIndex);
                    const cellLessonId = getCellLessonId(dayKey, rowIndex);

                    return (
                      <td key={dayKey} className="border-b border-r border-gray-200 px-1.5 py-1 align-middle">
                        {mode === "admin" ? (
                          <div className="relative">
                            <input
                              type="text"
                              value={cellDrafts[cellKey] !== undefined ? cellDrafts[cellKey] : cellText}
                              onChange={(e) => {
                                const val = e.target.value;
                                setCellDrafts((prev) => ({ ...prev, [cellKey]: val }));
                                // any manual edit detaches the previously linked lesson
                                setCellLessonIds((prev) => ({ ...prev, [cellKey]: null }));
                                setOpenComboKey(cellKey);
                              }}
                              onFocus={() => setOpenComboKey(cellKey)}
                              onBlur={(e) => {
                                const val = e.target.value;
                                setTimeout(() => {
                                  setOpenComboKey((k) => (k === cellKey ? "" : k));
                                }, 120);
                                const plan = planByDayKey[dayKey];
                                const item = (plan?.items || []).find((it) => it.sortOrder === rowIndex);
                                const storedText = item?.title || "";
                                const storedLessonId = item?.lessonId || null;
                                const nextLessonId = cellLessonIds[cellKey] ?? null;
                                if (val !== storedText || nextLessonId !== storedLessonId) {
                                  saveCellValue(dayKey, rowIndex, val, nextLessonId);
                                }
                              }}
                              placeholder="Type a note or pick a lesson…"
                              className="w-full rounded border border-transparent bg-transparent px-1.5 py-0.5 text-xs text-gray-800 placeholder-gray-300 outline-none transition focus:border-sky-300 focus:bg-white focus:ring-1 focus:ring-sky-100"
                            />
                            {openComboKey === cellKey && suggestionsFor(cellKey).length > 0 ? (
                              <ul className="absolute left-0 top-full z-20 mt-1 max-h-52 w-56 overflow-auto rounded-lg border border-gray-200 bg-white py-1 text-xs shadow-lg">
                                {suggestionsFor(cellKey).map((l) => (
                                  <li
                                    key={l.id}
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={() => selectLessonForCell(dayKey, rowIndex, l)}
                                    className="cursor-pointer px-2.5 py-1.5 hover:bg-sky-50"
                                  >
                                    <div className="font-semibold text-gray-800">{l.title}</div>
                                    {l.category?.name ? (
                                      <div className="text-[10px] text-gray-400">{l.category.name}</div>
                                    ) : null}
                                  </li>
                                ))}
                              </ul>
                            ) : null}
                          </div>
                        ) : (
                          <span className="block px-1.5 text-xs text-gray-800">
                            {cellText ? (
                              cellLessonId ? (
                                <button
                                  type="button"
                                  onClick={() => openLessonDetail(cellLessonId)}
                                  className="text-left text-sky-700 underline decoration-dotted underline-offset-2 hover:text-sky-900"
                                >
                                  {cellText}
                                </button>
                              ) : (
                                cellText
                              )
                            ) : (
                              <span className="text-gray-300">—</span>
                            )}
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {mode === "admin" && (
        <div className="border-t border-gray-100 px-4 py-2 text-xs text-gray-400">
          Click any category name to rename it. Click any cell to type a note, or start typing a
          lesson title to attach it from the curriculum.
        </div>
      )}

      {viewLessonId ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={closeLessonDetail}
        >
          <div
            className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {viewLessonLoading ? (
              <div className="py-8 text-center text-sm text-gray-500">Loading…</div>
            ) : viewLessonError ? (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                {viewLessonError}
              </div>
            ) : viewLesson ? (
              <>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-base font-extrabold text-gray-900">{viewLesson.title}</div>
                    <div className="mt-1 text-xs text-gray-500">
                      {viewLesson.category?.name || "Uncategorized"}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={closeLessonDetail}
                    className="shrink-0 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                  >
                    Close
                  </button>
                </div>

                {viewLesson.policyDocument ? (
                  <a
                    href={viewLesson.policyDocument.url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-block rounded-full bg-indigo-100 px-2 py-0.5 text-xs text-indigo-700 hover:bg-indigo-200 no-underline"
                  >
                    Policy: {viewLesson.policyDocument.title}
                  </a>
                ) : null}

                {viewLesson.description ? (
                  <div className="mt-3 whitespace-pre-wrap text-sm text-gray-700">
                    {viewLesson.description}
                  </div>
                ) : null}

                {viewLesson.reference ? (
                  <div className="mt-3 text-xs text-gray-500">
                    Reference: {viewLesson.reference}
                  </div>
                ) : null}

                <div className="mt-4">
                  <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Media
                  </div>
                  {Array.isArray(viewLesson.media) && viewLesson.media.length ? (
                    <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
                      {viewLesson.media.map((m) => (
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

                {Array.isArray(viewLesson.goals) && viewLesson.goals.length ? (
                  <div className="mt-4">
                    <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Steps
                    </div>
                    <div className="mt-2 space-y-2">
                      {viewLesson.goals
                        .slice()
                        .sort((a, b) => Number(a.goalIndex || 0) - Number(b.goalIndex || 0))
                        .map((g) => (
                          <div
                            key={g.id || g.goalIndex}
                            className="rounded-lg border border-gray-200 bg-gray-50 p-2.5 text-sm"
                          >
                            <div className="font-semibold text-gray-900">
                              Step {g.goalIndex}: {g.title}
                            </div>
                            {g.description ? (
                              <div className="mt-1 whitespace-pre-wrap text-xs text-gray-700">
                                {g.description}
                              </div>
                            ) : null}
                          </div>
                        ))}
                    </div>
                  </div>
                ) : null}
              </>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
