import { apiJson } from "@/lib/api";
import { formatTermDaysLabel, normalizeTermDaySelections } from "@/lib/lessonScheduling";
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

// Parses a "YYYY-MM-DD" key as a local-time date. `new Date("YYYY-MM-DD")`
// parses as UTC midnight, which rolls back to the previous local calendar
// day (once passed through startOfDay's local setHours) in any timezone
// behind UTC — shifting every saved plan a day earlier than intended.
function fromDateKey(key) {
  const match = String(key || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    const d = new Date(key);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const [, y, m, d] = match;
  return new Date(Number(y), Number(m) - 1, Number(d));
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

function currentWeekdayIndex() {
  const day = new Date().getDay();
  if (day === 0) return 0;
  if (day === 6) return 4;
  return day - 1;
}

export default function WeeklyLessonPlanner({
  centerId,
  classId = "",
  mode = "teacher",
  singleDay = false,
}) {
  const [anchorDate, setAnchorDate] = useState(() => startOfWeekMonday(new Date()));
  const [selectedDayIndex, setSelectedDayIndex] = useState(currentWeekdayIndex);

  // Category rows: [{ rowIndex, label }], in display order
  const [rows, setRows] = useState(() =>
    Array.from({ length: ROW_COUNT }, (_, i) => ({ rowIndex: i, label: DEFAULT_ROW_LABELS[i] || "" })),
  );
  const [labelDrafts, setLabelDrafts] = useState({});
  const [addingRow, setAddingRow] = useState(false);
  const [deletingRowIndex, setDeletingRowIndex] = useState(null);
  const [dragRowIndex, setDragRowIndex] = useState(null);
  const [dragOverRowIndex, setDragOverRowIndex] = useState(null);

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

  // Load category rows for this classroom
  const loadRows = useCallback(async () => {
    const defaults = Array.from({ length: ROW_COUNT }, (_, i) => ({
      rowIndex: i,
      label: DEFAULT_ROW_LABELS[i] || "",
    }));
    if (!centerId || !classId) {
      setRows(defaults);
      setLabelDrafts(Object.fromEntries(defaults.map((r) => [r.rowIndex, r.label])));
      return;
    }
    try {
      const data = await apiJson(
        `/api/v1/lesson-plan-rows?centerId=${encodeURIComponent(centerId)}&classRoomId=${encodeURIComponent(classId)}`,
      );
      if (abortRef.current.aborted) return;
      const arr = Array.isArray(data) ? data : [];
      // Server already returns rows in display order (position, falling back to
      // rowIndex) — don't re-sort by rowIndex here or dragged order would be lost.
      const normalized = arr.map((r) => ({
        rowIndex: r.rowIndex,
        label: r.label || DEFAULT_ROW_LABELS[r.rowIndex] || "",
      }));
      setRows(normalized.length ? normalized : defaults);
      setLabelDrafts(
        Object.fromEntries((normalized.length ? normalized : defaults).map((r) => [r.rowIndex, r.label])),
      );
    } catch {
      setRows(defaults);
      setLabelDrafts(Object.fromEntries(defaults.map((r) => [r.rowIndex, r.label])));
    }
  }, [centerId, classId]);

  useEffect(() => { loadRows(); }, [loadRows]);

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

  const pendingPlanCreates = useRef({});

  async function ensurePlan(dayKey) {
    if (planByDayKey[dayKey]) return planByDayKey[dayKey];
    if (!centerId || !classId) return null;
    // If a create for this day is already in flight, piggyback on it instead
    // of firing a second POST that would collide on the unique constraint.
    if (pendingPlanCreates.current[dayKey]) return pendingPlanCreates.current[dayKey];

    const day = fromDateKey(dayKey);
    if (!day || Number.isNaN(day.getTime())) return null;

    const promise = (async () => {
      try {
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
      } finally {
        delete pendingPlanCreates.current[dayKey];
      }
    })();
    pendingPlanCreates.current[dayKey] = promise;
    return promise;
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
    setRows((prev) => prev.map((r) => (r.rowIndex === rowIndex ? { ...r, label: trimmed } : r)));
    try {
      await apiJson("/api/v1/lesson-plan-rows", {
        method: "PUT",
        body: JSON.stringify({ centerId, classRoomId: classId, rowIndex, label: trimmed }),
      });
    } catch {
      // non-critical, label already updated in state
    }
  }

  async function addCategory() {
    if (mode !== "admin" || !centerId || !classId || addingRow) return;
    setAddingRow(true);
    setError("");
    try {
      const created = await apiJson("/api/v1/lesson-plan-rows", {
        method: "POST",
        body: JSON.stringify({ centerId, classRoomId: classId, label: "New Category" }),
      });
      setRows((prev) => [...prev, { rowIndex: created.rowIndex, label: created.label || "" }]);
      setLabelDrafts((prev) => ({ ...prev, [created.rowIndex]: created.label || "" }));
    } catch (e) {
      setError(e.message || "Failed to add category");
    } finally {
      setAddingRow(false);
    }
  }

  async function deleteCategory(rowIndex) {
    if (mode !== "admin" || !centerId || !classId || rows.length <= 1) return;
    const row = rows.find((r) => r.rowIndex === rowIndex);
    const label = row?.label || DEFAULT_ROW_LABELS[rowIndex] || `Row ${rowIndex + 1}`;
    if (typeof window !== "undefined") {
      const ok = window.confirm(`Remove the "${label}" category from this class's planner?`);
      if (!ok) return;
    }
    setDeletingRowIndex(rowIndex);
    setError("");
    try {
      await apiJson("/api/v1/lesson-plan-rows", {
        method: "DELETE",
        body: JSON.stringify({ centerId, classRoomId: classId, rowIndex }),
      });
      setRows((prev) => prev.filter((r) => r.rowIndex !== rowIndex));
      setLabelDrafts((prev) => {
        const next = { ...prev };
        delete next[rowIndex];
        return next;
      });
    } catch (e) {
      setError(e.message || "Failed to remove category");
    } finally {
      setDeletingRowIndex(null);
    }
  }

  // Drag-and-drop category reordering. Rows are keyed by rowIndex, which is
  // also the identity that lesson-plan cells attach to (`dayKey:rowIndex`),
  // so reordering only ever changes display order — never rowIndex — and
  // every cell/lesson stays with its category as it's dragged around.
  async function persistRowOrder(order) {
    if (mode !== "admin" || !centerId || !classId) return;
    try {
      const updated = await apiJson("/api/v1/lesson-plan-rows", {
        method: "PUT",
        body: JSON.stringify({ centerId, classRoomId: classId, order }),
      });
      if (Array.isArray(updated)) {
        setRows(updated.map((r) => ({ rowIndex: r.rowIndex, label: r.label || "" })));
      }
    } catch (e) {
      setError(e.message || "Failed to save category order");
      loadRows();
    }
  }

  function handleRowDragStart(e, rowIndex) {
    if (mode !== "admin" || rows.length <= 1) return;
    setDragRowIndex(rowIndex);
    e.dataTransfer.effectAllowed = "move";
    try {
      e.dataTransfer.setData("text/plain", String(rowIndex));
    } catch {
      // some browsers restrict setData outside real drag events (e.g. tests); ignore
    }
  }

  function handleRowDragOver(e, rowIndex) {
    if (dragRowIndex === null || mode !== "admin") return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (rowIndex !== dragOverRowIndex) setDragOverRowIndex(rowIndex);
  }

  function handleRowDrop(e, targetRowIndex) {
    e.preventDefault();
    const sourceRowIndex = dragRowIndex;
    setDragRowIndex(null);
    setDragOverRowIndex(null);
    if (sourceRowIndex === null || sourceRowIndex === targetRowIndex) return;

    setRows((prev) => {
      const sourcePos = prev.findIndex((r) => r.rowIndex === sourceRowIndex);
      const targetPos = prev.findIndex((r) => r.rowIndex === targetRowIndex);
      if (sourcePos === -1 || targetPos === -1) return prev;
      const next = [...prev];
      const [moved] = next.splice(sourcePos, 1);
      next.splice(targetPos, 0, moved);
      persistRowOrder(next.map((r) => r.rowIndex));
      return next;
    });
  }

  function handleRowDragEnd() {
    setDragRowIndex(null);
    setDragOverRowIndex(null);
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
    setSelectedDayIndex(currentWeekdayIndex());
    setCellDrafts({});
    setCellLessonIds({});
    setOpenComboKey("");
  }

  function goToPrevDay() {
    if (selectedDayIndex > 0) {
      setSelectedDayIndex((i) => i - 1);
    } else {
      setAnchorDate((d) => addDays(d, -7));
      setSelectedDayIndex(4);
    }
    setCellDrafts({});
    setCellLessonIds({});
    setOpenComboKey("");
  }

  function goToNextDay() {
    if (selectedDayIndex < 4) {
      setSelectedDayIndex((i) => i + 1);
    } else {
      setAnchorDate((d) => addDays(d, 7));
      setSelectedDayIndex(0);
    }
    setCellDrafts({});
    setCellLessonIds({});
    setOpenComboKey("");
  }

  const displayDays = singleDay ? [weekDays[selectedDayIndex]] : weekDays;

  return (
    <div className="rounded-xl border border-gray-200 bg-white">
      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 px-4 py-3">
        <div>
          <div className="text-sm font-extrabold text-gray-900">Lesson Plan</div>
          <div className="mt-0.5 text-xs text-gray-500">{formatWeekRange(weekStart)}</div>
        </div>
        <div className="flex items-center gap-1.5">
          {singleDay ? (
            <>
              <button
                type="button"
                onClick={goToPrevDay}
                aria-label="Previous day"
                className="rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
              >
                ‹
              </button>
              <span className="min-w-[92px] text-center text-xs font-semibold text-gray-700">
                {formatDayHeader(weekDays[selectedDayIndex])}
              </span>
              <button
                type="button"
                onClick={goToNextDay}
                aria-label="Next day"
                className="rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
              >
                ›
              </button>
              <button
                type="button"
                onClick={goToToday}
                className="rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
              >
                Today
              </button>
            </>
          ) : (
            <>
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
            </>
          )}
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
          <table
            className={`w-full border-collapse text-sm ${singleDay ? "" : "min-w-[600px]"}`}
          >
            <thead>
              <tr className="bg-gray-50">
                <th className="border-b border-r border-gray-200 px-3 py-2 text-left text-xs font-semibold text-gray-500 w-36">
                  Categories
                </th>
                {displayDays.map((d) => (
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
              {rows.map(({ rowIndex, label: rowLabel }) => (
                <tr
                  key={rowIndex}
                  onDragOver={(e) => handleRowDragOver(e, rowIndex)}
                  onDrop={(e) => handleRowDrop(e, rowIndex)}
                  className={`group hover:bg-gray-50/60 ${
                    dragRowIndex === rowIndex ? "opacity-40" : ""
                  } ${
                    dragOverRowIndex === rowIndex && dragRowIndex !== rowIndex
                      ? "border-t-2 border-sky-400"
                      : ""
                  }`}
                >
                  {/* Category label cell */}
                  <td className="border-b border-r border-gray-200 px-2 py-1.5 align-middle bg-gray-50/80">
                    {mode === "admin" ? (
                      <div className="flex items-center gap-1">
                        {rows.length > 1 ? (
                          <span
                            draggable
                            onDragStart={(e) => handleRowDragStart(e, rowIndex)}
                            onDragEnd={handleRowDragEnd}
                            title="Drag to reorder"
                            className="shrink-0 cursor-grab select-none rounded p-0.5 text-gray-300 hover:text-gray-500 active:cursor-grabbing"
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              viewBox="0 0 20 20"
                              fill="currentColor"
                              className="h-3.5 w-3.5"
                            >
                              <path d="M7 4a1.5 1.5 0 113 0 1.5 1.5 0 01-3 0zm0 6a1.5 1.5 0 113 0 1.5 1.5 0 01-3 0zm0 6a1.5 1.5 0 113 0 1.5 1.5 0 01-3 0zm4-12a1.5 1.5 0 113 0 1.5 1.5 0 01-3 0zm0 6a1.5 1.5 0 113 0 1.5 1.5 0 01-3 0zm0 6a1.5 1.5 0 113 0 1.5 1.5 0 01-3 0z" />
                            </svg>
                          </span>
                        ) : null}
                        <input
                          type="text"
                          value={labelDrafts[rowIndex] ?? rowLabel ?? ""}
                          onChange={(e) =>
                            setLabelDrafts((prev) => ({ ...prev, [rowIndex]: e.target.value }))
                          }
                          onBlur={(e) => saveLabelValue(rowIndex, e.target.value)}
                          placeholder={DEFAULT_ROW_LABELS[rowIndex] || `Row ${rowIndex + 1}`}
                          className="w-full min-w-0 flex-1 rounded border border-transparent bg-transparent px-1 py-0.5 text-xs font-semibold text-gray-700 placeholder-gray-300 outline-none transition focus:border-sky-300 focus:bg-white focus:ring-1 focus:ring-sky-100"
                        />
                        <button
                          type="button"
                          onClick={() => deleteCategory(rowIndex)}
                          disabled={rows.length <= 1 || deletingRowIndex === rowIndex}
                          title={rows.length <= 1 ? "At least one category is required" : "Remove category"}
                          className="shrink-0 rounded p-0.5 text-gray-300 opacity-0 transition hover:bg-red-50 hover:text-red-600 group-hover:opacity-100 disabled:cursor-not-allowed disabled:opacity-0"
                        >
                          {deletingRowIndex === rowIndex ? (
                            <span className="block px-1 text-[10px]">…</span>
                          ) : (
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              viewBox="0 0 20 20"
                              fill="currentColor"
                              className="h-3.5 w-3.5"
                            >
                              <path
                                fillRule="evenodd"
                                d="M8.75 1A1.75 1.75 0 007 2.75V3H4.25a.75.75 0 000 1.5h.3l.6 10.06A2.25 2.25 0 007.4 16.5h5.2a2.25 2.25 0 002.25-1.94l.6-10.06h.3a.75.75 0 000-1.5H13v-.25A1.75 1.75 0 0011.25 1h-2.5zM8.5 2.75a.25.25 0 01.25-.25h2.5a.25.25 0 01.25.25V3h-3v-.25zM8 7.25a.75.75 0 011.5 0v6a.75.75 0 01-1.5 0v-6zm3.25-.75a.75.75 0 00-.75.75v6a.75.75 0 001.5 0v-6a.75.75 0 00-.75-.75z"
                                clipRule="evenodd"
                              />
                            </svg>
                          )}
                        </button>
                      </div>
                    ) : (
                      <span className="block px-1 text-xs font-semibold text-gray-700">
                        {rowLabel || DEFAULT_ROW_LABELS[rowIndex] || `Row ${rowIndex + 1}`}
                      </span>
                    )}
                  </td>

                  {/* Lesson cells for each day */}
                  {displayDays.map((d) => {
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
                                    {l.category?.ageRange ? (
                                      <div className="text-[10px] text-gray-400">{l.category.ageRange}</div>
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

      {mode === "admin" && !loading && (
        <div className="border-t border-gray-100 px-4 py-2">
          <button
            type="button"
            onClick={addCategory}
            disabled={addingRow}
            className="rounded-lg border border-dashed border-gray-300 px-2.5 py-1 text-xs font-semibold text-gray-600 hover:border-sky-300 hover:text-sky-700 disabled:opacity-60"
          >
            {addingRow ? "Adding…" : "+ Add Category"}
          </button>
        </div>
      )}

      {mode === "admin" && (
        <div className="border-t border-gray-100 px-4 py-2 text-xs text-gray-400">
          Click any category name to rename it, drag the grip to reorder it, or hover a row to
          remove it. Click any cell to type a note, or start typing a lesson title to attach it
          from the curriculum.
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

                <div className="mt-2 flex flex-wrap gap-1.5">
                  {viewLesson.category?.ageRange ? (
                    <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-[11px] font-semibold text-gray-700">
                      {viewLesson.category.ageRange}
                    </span>
                  ) : null}
                  {viewLesson.term ? (
                    <span className="inline-flex items-center rounded-full bg-violet-50 px-2.5 py-0.5 text-[11px] font-semibold text-violet-700">
                      {viewLesson.term}
                    </span>
                  ) : null}
                  {viewLesson.lessonSlot ? (
                    <span className="inline-flex items-center rounded-full bg-indigo-50 px-2.5 py-0.5 text-[11px] font-semibold text-indigo-700">
                      Slot: {viewLesson.lessonSlot}
                    </span>
                  ) : null}
                  {normalizeTermDaySelections(viewLesson.termDays).length > 0 ? (
                    <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold text-amber-700">
                      {formatTermDaysLabel(viewLesson.termDays)}
                    </span>
                  ) : null}
                  {viewLesson.subCategory ? (
                    <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-700">
                      {viewLesson.subCategory}
                    </span>
                  ) : null}
                  {viewLesson.linkedLesson ? (
                    <span className="inline-flex items-center rounded-full bg-violet-50 px-2.5 py-0.5 text-[11px] font-semibold text-violet-700">
                      Linked: {viewLesson.linkedLesson.title}
                    </span>
                  ) : null}
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

                {Array.isArray(viewLesson.supplies) && viewLesson.supplies.length ? (
                  <div className="mt-4">
                    <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Supplies
                    </div>
                    <ul className="mt-2 space-y-1">
                      {viewLesson.supplies.map((s) => (
                        <li key={s.id} className="text-sm text-gray-700">
                          <span className="font-semibold text-gray-900">{s.name}</span>
                          {" — "}
                          {s.quantity || 1}
                          {s.quantityType === "per_student" ? " per student" : ""}
                          {s.unit ? ` ${s.unit}` : ""}
                          {s.notes ? (
                            <span className="text-gray-500"> ({s.notes})</span>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

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
