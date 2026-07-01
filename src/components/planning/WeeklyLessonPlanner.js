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

  async function saveCellValue(dayKey, rowIndex, text) {
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
        })),
      ];
      if (text.trim()) {
        nextItems.push({ title: text.trim(), sortOrder: rowIndex });
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
  }

  function goToNextWeek() {
    setAnchorDate((d) => addDays(d, 7));
    setCellDrafts({});
  }

  function goToToday() {
    setAnchorDate(startOfWeekMonday(new Date()));
    setCellDrafts({});
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

                    return (
                      <td key={dayKey} className="border-b border-r border-gray-200 px-1.5 py-1 align-middle">
                        {mode === "admin" ? (
                          <input
                            type="text"
                            value={cellDrafts[cellKey] !== undefined ? cellDrafts[cellKey] : cellText}
                            onChange={(e) =>
                              setCellDrafts((prev) => ({
                                ...prev,
                                [cellKey]: e.target.value,
                              }))
                            }
                            onBlur={(e) => {
                              const val = e.target.value;
                              // Only save if changed from what's stored
                              const storedText = (() => {
                                const plan = planByDayKey[dayKey];
                                const item = (plan?.items || []).find((it) => it.sortOrder === rowIndex);
                                return item?.title || "";
                              })();
                              if (val !== storedText) saveCellValue(dayKey, rowIndex, val);
                            }}
                            placeholder="—"
                            className="w-full rounded border border-transparent bg-transparent px-1.5 py-0.5 text-xs text-gray-800 placeholder-gray-300 outline-none transition focus:border-sky-300 focus:bg-white focus:ring-1 focus:ring-sky-100"
                          />
                        ) : (
                          <span className="block px-1.5 text-xs text-gray-800">
                            {cellText || <span className="text-gray-300">—</span>}
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
          Click any category name to rename it. Click any cell to enter the lesson for that day.
        </div>
      )}
    </div>
  );
}
