import { apiJson } from "@/lib/api";
import { useEffect, useMemo, useRef, useState } from "react";

const DEFAULT_PLAN_TITLE = "Lesson Planner";
const DISPLAY_WEEK_DAYS = 5; // Mon–Fri
const FETCH_WEEK_DAYS = 7; // fetch full week range
const VIEWS = ["DAY", "WEEK", "MONTH"];
const MONTH_VISIBLE_ITEMS = 4;

function normalizeSpaces(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ");
}

function toDateInputValue(date) {
  const d = date instanceof Date ? date : new Date();
  if (Number.isNaN(d.getTime())) return "";
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function toMonthInputValue(date) {
  const d = date instanceof Date ? date : new Date();
  if (Number.isNaN(d.getTime())) return "";
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${yyyy}-${mm}`;
}

function parseMonthInputValue(value) {
  const s = String(value || "").trim();
  if (!/^\d{4}-\d{2}$/.test(s)) return null;
  const [y, m] = s.split("-").map((x) => Number(x));
  const d = new Date(y, m - 1, 1);
  d.setHours(0, 0, 0, 0);
  return Number.isNaN(d.getTime()) ? null : d;
}

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfWeekMonday(date) {
  const d = startOfDay(date);
  const day = d.getDay(); // 0=Sun
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function addMonths(date, months) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

function isWeekday(date) {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun
  return day >= 1 && day <= 5;
}

function addWeekdays(date, deltaDays) {
  let remaining = Math.abs(deltaDays);
  const step = deltaDays >= 0 ? 1 : -1;
  let d = startOfDay(date);
  while (remaining > 0) {
    d = addDays(d, step);
    if (isWeekday(d)) remaining -= 1;
  }
  return d;
}

function toIsoDate(date) {
  return startOfDay(date).toISOString();
}

function toDateKey(date) {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "";
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function formatRange(start, endExclusive) {
  const a = new Date(start);
  const b = addDays(new Date(endExclusive), -1);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return "";
  return `${a.toLocaleDateString()} \u2013 ${b.toLocaleDateString()}`;
}

function monthLabel(date) {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

function passingCriteriaObject(value) {
  if (!value) return {};
  if (typeof value === "object" && !Array.isArray(value)) return value;
  return {};
}

function isHttpUrl(value) {
  const s = String(value || "").trim();
  return s.startsWith("http://") || s.startsWith("https://");
}

function splitResources(value) {
  return [
    ...new Set(
      String(value || "")
        .split(/[\n,;]+/g)
        .map((x) => normalizeSpaces(x))
        .filter(Boolean),
    ),
  ];
}

function uniqSorted(values) {
  return [...new Set(values.filter(Boolean))].sort((a, b) =>
    String(a).localeCompare(String(b)),
  );
}

function flattenCurriculumRecords(lessons) {
  const rows = [];
  (lessons || []).forEach((lesson) => {
    (lesson?.goals || []).forEach((goal) => {
      const pc = passingCriteriaObject(goal?.passingCriteria);
      const age =
        normalizeSpaces(pc.age) || normalizeSpaces(lesson?.category?.ageRange);
      const category =
        normalizeSpaces(pc.category) || normalizeSpaces(lesson?.category?.name);
      const subject = normalizeSpaces(pc.subject);
      rows.push({
        id: goal.id,
        lessonId: lesson.id,
        lessonTitle: lesson.title || "Lesson",
        progressionStep: goal.title || "",
        age,
        category,
        subject,
      });
    });
  });
  return rows;
}

function GuidanceRow({ label, value, multiline = false }) {
  const text = String(value || "").trim();
  if (!text) return null;

  if (!multiline && isHttpUrl(text)) {
    return (
      <div>
        <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
          {label}
        </div>
        <div className="mt-1">
          <a
            href={text}
            target="_blank"
            rel="noreferrer"
            className="truncate text-xs font-semibold text-sky-700 hover:text-sky-800"
          >
            {text}
          </a>
        </div>
      </div>
    );
  }

  const lines = multiline
    ? text
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean)
    : [];

  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
        {label}
      </div>
      {multiline ? (
        <ul className="mt-1 list-disc space-y-1 pl-5 text-xs text-gray-800">
          {lines.map((l) => (
            <li key={l}>
              {isHttpUrl(l) ? (
                <a
                  href={l}
                  target="_blank"
                  rel="noreferrer"
                  className="font-semibold text-sky-700 hover:text-sky-800"
                >
                  {l}
                </a>
              ) : (
                l
              )}
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-1 text-xs text-gray-800">{text}</div>
      )}
    </div>
  );
}

function WeekDayCard({
  day,
  selectedDayKey,
  plan,
  mode,
  childId,
  doneItemIds,
  onOpenDay,
  onToggleCompletion,
}) {
  const dayKey = toDateKey(day);
  const label = day.toLocaleDateString(undefined, { weekday: "short" });
  const num = day.getDate();
  const items = Array.isArray(plan?.items) ? plan.items : [];

  return (
    <button
      type="button"
      onClick={() => onOpenDay(dayKey)}
      className={[
        "group flex h-full min-h-[130px] flex-col rounded-xl border p-2.5 text-left transition",
        dayKey === selectedDayKey
          ? "border-sky-300 bg-sky-50"
          : "border-gray-200 bg-white hover:bg-gray-50",
      ].join(" ")}
    >
      <div className="flex items-baseline justify-between gap-2">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
          {label}
        </div>
        <div className="text-xs font-extrabold text-gray-900">{num}</div>
      </div>

      <div className="mt-2 flex-1 space-y-2">
        {items.length ? (
          items.slice(0, 3).map((it) => (
            <div
              key={it.id}
              className="rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-[11px] text-gray-800"
            >
              <div className="truncate font-semibold">{it.title || "Lesson"}</div>
              {mode === "teacher" && childId ? (
                <div className="mt-1.5 flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={doneItemIds.has(it.id)}
                    onChange={(e) => {
                      e.stopPropagation();
                      onToggleCompletion(it.id, e.target.checked);
                    }}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <span className="text-[11px] text-gray-600">
                    {doneItemIds.has(it.id) ? "Completed" : "Mark"}
                  </span>
                </div>
              ) : null}
            </div>
          ))
        ) : (
          <div className="rounded-lg border border-dashed border-gray-200 bg-white/50 p-3 text-xs text-gray-500">
            {mode === "admin" ? "Click to add lessons" : "No planned lessons"}
          </div>
        )}
        {items.length > 3 ? (
          <div className="text-[11px] font-semibold text-gray-500">
            +{items.length - 3} more
          </div>
        ) : null}
      </div>

      <div className="mt-2 flex items-center justify-between">
        <div className="text-[11px] text-gray-500">
          {plan ? plan.title || DEFAULT_PLAN_TITLE : DEFAULT_PLAN_TITLE}
        </div>
        <div className="text-[11px] font-semibold text-sky-700 opacity-0 transition group-hover:opacity-100">
          Open
        </div>
      </div>
    </button>
  );
}

function DayCard({
  day,
  plan,
  mode,
  childId,
  doneItemIds,
  onOpenDay,
  onToggleCompletion,
}) {
  const label = day.toLocaleDateString(undefined, { weekday: "long" });
  const items = Array.isArray(plan?.items) ? plan.items : [];

  return (
    <div className="mt-3 rounded-xl border border-gray-200 bg-white p-3">
      <div className="flex items-baseline justify-between gap-2">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
          {label}
        </div>
        <div className="text-xs font-extrabold text-gray-900">{day.getDate()}</div>
      </div>

      <div className="mt-3 space-y-2">
        {items.length ? (
          items.map((it) => (
            <div
              key={it.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white px-3 py-2"
            >
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-gray-900">
                  {it.title || "Lesson"}
                </div>
              </div>
              {mode === "teacher" && childId ? (
                <label className="flex items-center gap-2 text-xs font-semibold text-gray-700">
                  <input
                    type="checkbox"
                    checked={doneItemIds.has(it.id)}
                    onChange={(e) => onToggleCompletion(it.id, e.target.checked)}
                  />
                  {doneItemIds.has(it.id) ? "Completed" : "Mark"}
                </label>
              ) : (
                <button
                  type="button"
                  className="rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                  onClick={onOpenDay}
                >
                  Open
                </button>
              )}
            </div>
          ))
        ) : (
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-600">
            {mode === "admin"
              ? "No lessons yet. Click Open to add lessons."
              : "No planned lessons."}
          </div>
        )}
      </div>
    </div>
  );
}

function MonthGrid({
  weeks,
  monthStart,
  monthEndExclusive,
  selectedDayKey,
  selectedPlanByDayKey,
  onOpenDay,
}) {
  const headers = ["Mon", "Tue", "Wed", "Thu", "Fri"];
  return (
    <div className="mt-3 rounded-xl border border-gray-200 bg-white p-3">
      <div className="grid grid-cols-5 gap-2">
        {headers.map((h) => (
          <div
            key={h}
            className="text-[11px] font-semibold uppercase tracking-wide text-gray-500"
          >
            {h}
          </div>
        ))}
      </div>
      <div className="mt-2 grid grid-cols-1 gap-2">
        {weeks.map((days) => (
          <div key={toDateKey(days[0])} className="grid grid-cols-5 gap-2">
            {days.map((d) => {
              const key = toDateKey(d);
              const inMonth = d >= monthStart && d < monthEndExclusive;
              const plan = selectedPlanByDayKey[key] || null;
              const items = Array.isArray(plan?.items) ? plan.items : [];
              const count = items.length;
              return (
                <button
                  key={key}
                  type="button"
                  disabled={!inMonth}
                  onClick={() => onOpenDay(key)}
                  className={[
                    "flex min-h-[112px] flex-col rounded-xl border p-2 text-left transition",
                    !inMonth
                      ? "border-gray-100 bg-gray-50 text-gray-400"
                      : key === selectedDayKey
                        ? "border-sky-300 bg-sky-50"
                        : "border-gray-200 bg-white hover:bg-gray-50",
                  ].join(" ")}
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <div className="text-xs font-extrabold">{d.getDate()}</div>
                    {count ? (
                      <div className="rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-semibold text-sky-800">
                        {count}
                      </div>
                    ) : null}
                  </div>

                  <div className="mt-2 flex-1 space-y-1 overflow-hidden">
                    {count ? (
                      <>
                        {items.slice(0, MONTH_VISIBLE_ITEMS).map((it) => (
                          <div
                            key={it.id}
                            className="truncate rounded-md border border-gray-200 bg-white px-1.5 py-1 text-[11px] font-semibold text-gray-800"
                            title={it.title || "Lesson"}
                          >
                            {it.title || "Lesson"}
                          </div>
                        ))}
                        {count > MONTH_VISIBLE_ITEMS ? (
                          <div className="text-[11px] font-semibold text-gray-500">
                            +{count - MONTH_VISIBLE_ITEMS} more
                          </div>
                        ) : null}
                      </>
                    ) : (
                      <div className="rounded-md border border-dashed border-gray-200 bg-white/50 px-1.5 py-2 text-[11px] text-gray-500">
                        No planned lessons
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function WeeklyLessonPlanner({
  centerId,
  mode = "teacher",
  childId = "",
  bulkChildIds = [],
}) {
  const [view, setView] = useState("WEEK");
  const [anchorDateValue, setAnchorDateValue] = useState(toDateInputValue(new Date()));
  const [monthValue, setMonthValue] = useState(toMonthInputValue(new Date()));

  const [plans, setPlans] = useState([]);
  const [lessons, setLessons] = useState([]);
  const [records, setRecords] = useState([]);

  const [selectedDayKey, setSelectedDayKey] = useState(toDateKey(new Date()));
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedPlanIdByDayKey, setSelectedPlanIdByDayKey] = useState({});
  const [selectedItemId, setSelectedItemId] = useState("");

  const [age, setAge] = useState("");
  const [category, setCategory] = useState("");
  const [subject, setSubject] = useState("");
  const [search, setSearch] = useState("");

  const [doneItemIds, setDoneItemIds] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState("");

  const anchorDate = useMemo(() => {
    const d = anchorDateValue ? new Date(anchorDateValue) : new Date();
    return Number.isNaN(d.getTime()) ? new Date() : d;
  }, [anchorDateValue]);

  const selectedDayDate = useMemo(() => {
    const d = new Date(selectedDayKey);
    return startOfDay(Number.isNaN(d.getTime()) ? new Date() : d);
  }, [selectedDayKey]);

  const weekStart = useMemo(() => startOfWeekMonday(anchorDate), [anchorDate]);
  const weekFetchEndExclusive = useMemo(() => addDays(weekStart, FETCH_WEEK_DAYS), [weekStart]);
  const weekDisplayEndExclusive = useMemo(() => addDays(weekStart, DISPLAY_WEEK_DAYS), [weekStart]);

  const monthStart = useMemo(() => {
    const parsed = parseMonthInputValue(monthValue) || new Date(anchorDate);
    parsed.setHours(0, 0, 0, 0);
    parsed.setDate(1);
    return parsed;
  }, [monthValue, anchorDate]);

  const monthEndExclusive = useMemo(() => addMonths(monthStart, 1), [monthStart]);

  const calendarWeeks = useMemo(() => {
    const start = startOfWeekMonday(monthStart);
    const weeks = [];
    for (let wk = 0; wk < 6; wk += 1) {
      const week = addDays(start, wk * 7);
      const days = Array.from({ length: 5 }).map((_, i) => addDays(week, i));
      weeks.push(days);
      if (days[4] >= monthEndExclusive) break;
    }
    return weeks;
  }, [monthStart, monthEndExclusive]);

  const weekDays = useMemo(() => {
    return Array.from({ length: DISPLAY_WEEK_DAYS }).map((_, i) => addDays(weekStart, i));
  }, [weekStart]);

  const visibleDays = useMemo(() => {
    if (view === "DAY") return [selectedDayDate];
    if (view === "MONTH") return calendarWeeks.flat();
    return weekDays;
  }, [view, selectedDayDate, calendarWeeks, weekDays]);

  const range = useMemo(() => {
    if (view === "DAY") {
      const start = selectedDayDate;
      return { start, endExclusive: addDays(start, 1) };
    }
    if (view === "MONTH") {
      return { start: monthStart, endExclusive: monthEndExclusive };
    }
    return { start: weekStart, endExclusive: weekFetchEndExclusive };
  }, [view, selectedDayDate, monthStart, monthEndExclusive, weekStart, weekFetchEndExclusive]);

  const dayPlansByKey = useMemo(() => {
    const map = new Map();
    (plans || []).forEach((p) => {
      const key = toDateKey(p.periodStart);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(p);
    });
    return map;
  }, [plans]);

  const selectedPlanByDayKey = useMemo(() => {
    const out = {};
    visibleDays.forEach((d) => {
      const key = toDateKey(d);
      const list = dayPlansByKey.get(key) || [];
      const preferredId = selectedPlanIdByDayKey[key] || "";
      const preferred =
        (preferredId && list.find((p) => p.id === preferredId)) ||
        list.find((p) => p.title === DEFAULT_PLAN_TITLE) ||
        list[0] ||
        null;
      if (preferred) out[key] = preferred;
    });
    return out;
  }, [visibleDays, dayPlansByKey, selectedPlanIdByDayKey]);

  const activePlan = useMemo(() => {
    return selectedPlanByDayKey[selectedDayKey] || null;
  }, [selectedPlanByDayKey, selectedDayKey]);

  const options = useMemo(() => {
    return {
      ages: uniqSorted(records.map((r) => r.age)),
      categories: uniqSorted(records.map((r) => r.category)),
      subjects: uniqSorted(records.map((r) => r.subject)),
    };
  }, [records]);

  const filteredRecords = useMemo(() => {
    const q = normalizeSpaces(search).toLowerCase();
    const ageKey = normalizeSpaces(age);
    const catKey = normalizeSpaces(category);
    const subKey = normalizeSpaces(subject);

    return (records || [])
      .filter((r) => {
        if (ageKey && normalizeSpaces(r.age) !== ageKey) return false;
        if (catKey && normalizeSpaces(r.category) !== catKey) return false;
        if (subKey && normalizeSpaces(r.subject) !== subKey) return false;
        if (!q) return true;
        return (
          String(r.lessonTitle || "").toLowerCase().includes(q) ||
          String(r.progressionStep || "").toLowerCase().includes(q)
        );
      })
      .slice(0, 200);
  }, [records, age, category, subject, search]);

  const abortRef = useRef({ aborted: false });
  useEffect(() => {
    abortRef.current.aborted = false;
    return () => {
      abortRef.current.aborted = true;
    };
  }, []);

  useEffect(() => {
    (async () => {
      if (!centerId) {
        setLessons([]);
        setRecords([]);
        return;
      }
      try {
        const data = await apiJson(
          `/api/v1/lessons?centerId=${encodeURIComponent(centerId)}`,
        );
        const arr = Array.isArray(data) ? data : [];
        if (abortRef.current.aborted) return;
        setLessons(arr);
        setRecords(flattenCurriculumRecords(arr));
      } catch {
        if (abortRef.current.aborted) return;
        setLessons([]);
        setRecords([]);
      }
    })();
  }, [centerId]);

  useEffect(() => {
    (async () => {
      if (!centerId) {
        setPlans([]);
        return;
      }
      setLoading(true);
      setError("");
      try {
        const qs = new URLSearchParams({
          centerId,
          period: "DAY",
          from: toIsoDate(range.start),
          to: toIsoDate(range.endExclusive),
        });
        const data = await apiJson(`/api/v1/milestone-checklists?${qs.toString()}`);
        if (abortRef.current.aborted) return;
        setPlans(Array.isArray(data) ? data : []);
      } catch (e) {
        if (abortRef.current.aborted) return;
        setError(e.message || "Failed to load plans");
        setPlans([]);
      } finally {
        if (!abortRef.current.aborted) setLoading(false);
      }
    })();
  }, [centerId, range.start.toISOString(), range.endExclusive.toISOString()]);

  useEffect(() => {
    (async () => {
      if (mode !== "teacher") return;
      if (!childId) {
        setDoneItemIds(new Set());
        return;
      }
      try {
        const qs = new URLSearchParams({
          childId,
          period: "DAY",
          from: toIsoDate(range.start),
          to: toIsoDate(range.endExclusive),
        });
        const data = await apiJson(
          `/api/v1/milestone-checklists/completions?${qs.toString()}`,
        );
        const set = new Set(
          (Array.isArray(data) ? data : [])
            .filter((c) => c?.completedAt)
            .map((c) => c.itemId),
        );
        if (abortRef.current.aborted) return;
        setDoneItemIds(set);
      } catch {
        if (abortRef.current.aborted) return;
        setDoneItemIds(new Set());
      }
    })();
  }, [
    mode,
    childId,
    centerId,
    range.start.toISOString(),
    range.endExclusive.toISOString(),
  ]);

  useEffect(() => {
    if (view === "WEEK") {
      setSelectedDayKey(toDateKey(weekStart));
      return;
    }
    if (view === "MONTH") {
      const first = new Date(monthStart);
      while (first < monthEndExclusive && !isWeekday(first)) {
        first.setDate(first.getDate() + 1);
      }
      setSelectedDayKey(toDateKey(first));
      return;
    }

    const d = new Date(selectedDayKey);
    const base = Number.isNaN(d.getTime()) ? new Date() : d;
    const next = isWeekday(base) ? base : addWeekdays(base, 1);
    setSelectedDayKey(toDateKey(next));
    setAnchorDateValue(toDateInputValue(next));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, weekStart.toISOString(), monthStart.toISOString()]);

  function openDay(dayKey) {
    setSelectedDayKey(dayKey);
    setAnchorDateValue(dayKey);
    setDrawerOpen(true);
  }

  function serializeItem(it) {
    return {
      title: it?.title || "",
      kind: it?.kind || "",
      url: it?.url || "",
      notes: it?.notes || "",
      policyDocumentId: it?.policyDocumentId || "",
      lessonId: it?.lessonId || "",
      lessonGoalId: it?.lessonGoalId || "",
      sortOrder: Number.isFinite(Number(it?.sortOrder)) ? Number(it.sortOrder) : undefined,
    };
  }

  async function ensurePlanForDay(dayKey) {
    const existing = selectedPlanByDayKey[dayKey] || null;
    if (existing) return existing;
    if (!centerId) return null;
    if (mode !== "admin") return null;

    const day = new Date(dayKey);
    if (Number.isNaN(day.getTime())) return null;

    setSaving(true);
    setError("");
    try {
      const created = await apiJson("/api/v1/milestone-checklists", {
        method: "POST",
        body: JSON.stringify({
          centerId,
          title: DEFAULT_PLAN_TITLE,
          description: null,
          period: "DAY",
          periodStart: toIsoDate(day),
          active: true,
          items: [],
        }),
      });
      setPlans((cur) => [...(cur || []), created]);
      setSelectedPlanIdByDayKey((cur) => ({ ...cur, [dayKey]: created.id }));
      return created;
    } catch (e) {
      setError(e.message || "Failed to create plan");
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function savePlanItems(planId, nextItems) {
    setSaving(true);
    setError("");
    try {
      const updated = await apiJson(
        `/api/v1/milestone-checklists/${encodeURIComponent(planId)}`,
        {
          method: "PUT",
          body: JSON.stringify({ items: nextItems }),
        },
      );
      setPlans((cur) =>
        (cur || []).map((p) => (p.id === updated.id ? updated : p)),
      );
      return updated;
    } catch (e) {
      setError(e.message || "Failed to update plan");
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function addRecordToActiveDay(record) {
    if (mode !== "admin") return;
    const dayKey = selectedDayKey;
    const plan = (await ensurePlanForDay(dayKey)) || null;
    if (!plan) return;

    const existingItems = Array.isArray(plan.items) ? plan.items : [];
    const exists =
      existingItems.some((it) => it.lessonGoalId && it.lessonGoalId === record.id) ||
      existingItems.some((it) => it.lessonGoal?.id && it.lessonGoal.id === record.id);
    if (exists) return;

    const next = [...existingItems.map(serializeItem), { lessonGoalId: record.id }];
    await savePlanItems(plan.id, next);
  }

  async function removeItemFromActiveDay(itemId) {
    if (mode !== "admin") return;
    const plan = activePlan;
    if (!plan) return;
    const existingItems = Array.isArray(plan.items) ? plan.items : [];
    const nextItems = existingItems.filter((it) => it.id !== itemId).map(serializeItem);
    await savePlanItems(plan.id, nextItems);
  }

  async function saveActivePlanTitle(nextTitle) {
    if (mode !== "admin") return;
    const plan = activePlan;
    if (!plan) return;
    const title = normalizeSpaces(nextTitle);
    if (!title) return;
    setSaving(true);
    setError("");
    try {
      const updated = await apiJson(
        `/api/v1/milestone-checklists/${encodeURIComponent(plan.id)}`,
        { method: "PUT", body: JSON.stringify({ title }) },
      );
      setPlans((cur) =>
        (cur || []).map((p) => (p.id === updated.id ? updated : p)),
      );
    } catch (e) {
      setError(e.message || "Failed to update title");
    } finally {
      setSaving(false);
    }
  }

  async function toggleCompletion(itemId, next) {
    if (mode !== "teacher") return;
    if (!childId) return;
    setError("");
    try {
      await apiJson("/api/v1/milestone-checklists/completions", {
        method: "POST",
        body: JSON.stringify({ childId, itemId, completed: next }),
      });
      setDoneItemIds((cur) => {
        const copy = new Set(cur);
        if (next) copy.add(itemId);
        else copy.delete(itemId);
        return copy;
      });
    } catch (e) {
      setError(e.message || "Failed to update completion");
    }
  }

  async function bulkToggleCompletion(itemId, next) {
    if (mode !== "teacher") return;
    const ids = Array.isArray(bulkChildIds) ? bulkChildIds.filter(Boolean) : [];
    if (!ids.length) return;
    setUpdating(true);
    setError("");
    try {
      await apiJson("/api/v1/milestone-checklists/bulk-completions", {
        method: "POST",
        body: JSON.stringify({ childIds: ids, itemId, completed: next }),
      });
      if (childId && ids.includes(childId)) {
        setDoneItemIds((cur) => {
          const copy = new Set(cur);
          if (next) copy.add(itemId);
          else copy.delete(itemId);
          return copy;
        });
      }
    } catch (e) {
      setError(e.message || "Failed to bulk update completion");
    } finally {
      setUpdating(false);
    }
  }

  const activePlanTitle = activePlan?.title || DEFAULT_PLAN_TITLE;
  const activeItems = Array.isArray(activePlan?.items) ? activePlan.items : [];
  const activeItemIds = new Set(activeItems.map((it) => it.id));
  const activeLessonGoalIds = new Set(
    activeItems.map((it) => it.lessonGoalId || it.lessonGoal?.id).filter(Boolean),
  );
  const activeItemById = useMemo(() => {
    return Object.fromEntries(activeItems.map((it) => [it.id, it]));
  }, [activeItems]);
  const selectedItem = selectedItemId ? activeItemById[selectedItemId] : null;
  const selectedLessonGoal = selectedItem?.lessonGoal || null;
  const selectedLesson = selectedItem?.lesson || null;
  const selectedPassingCriteria = passingCriteriaObject(selectedLessonGoal?.passingCriteria);
  const bulkCount = Array.isArray(bulkChildIds) ? bulkChildIds.filter(Boolean).length : 0;

  useEffect(() => {
    if (!drawerOpen) return;
    if (!activeItems.length) {
      setSelectedItemId("");
      return;
    }
    if (selectedItemId && activeItemIds.has(selectedItemId)) return;
    setSelectedItemId(activeItems[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawerOpen, activePlan?.id]);

  const headerSub =
    view === "MONTH"
      ? monthLabel(monthStart)
      : view === "DAY"
        ? selectedDayDate.toLocaleDateString(undefined, {
            weekday: "long",
            year: "numeric",
            month: "short",
            day: "numeric",
          })
        : `${formatRange(weekStart, weekDisplayEndExclusive)} (Mon–Fri)`;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <div className="text-base font-extrabold text-gray-900">Checklists</div>
          <div className="mt-0.5 text-xs text-gray-600">{headerSub}</div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <div className="inline-flex rounded-lg border border-gray-200 bg-white p-0.5">
            {VIEWS.map((v) => {
              const active = v === view;
              return (
                <button
                  key={v}
                  type="button"
                  className={[
                    "rounded-md px-2.5 py-1.5 text-xs font-semibold transition",
                    active
                      ? "bg-sky-600 text-white"
                      : "text-gray-700 hover:bg-gray-50",
                  ].join(" ")}
                  onClick={() => setView(v)}
                >
                  {v === "DAY" ? "Day" : v === "WEEK" ? "Week" : "Month"}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            className="rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
            onClick={() => {
              if (view === "MONTH") {
                setMonthValue(toMonthInputValue(addMonths(monthStart, -1)));
                return;
              }
              if (view === "DAY") {
                const prev = addWeekdays(selectedDayDate, -1);
                setSelectedDayKey(toDateKey(prev));
                setAnchorDateValue(toDateInputValue(prev));
                return;
              }
              setAnchorDateValue(toDateInputValue(addDays(weekStart, -7)));
            }}
          >
            Prev
          </button>
          <button
            type="button"
            className="rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
            onClick={() => {
              const today = new Date();
              setAnchorDateValue(toDateInputValue(today));
              setMonthValue(toMonthInputValue(today));
              setSelectedDayKey(
                toDateKey(isWeekday(today) ? today : addWeekdays(today, 1)),
              );
            }}
          >
            Today
          </button>
          <button
            type="button"
            className="rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
            onClick={() => {
              if (view === "MONTH") {
                setMonthValue(toMonthInputValue(addMonths(monthStart, 1)));
                return;
              }
              if (view === "DAY") {
                const next = addWeekdays(selectedDayDate, 1);
                setSelectedDayKey(toDateKey(next));
                setAnchorDateValue(toDateInputValue(next));
                return;
              }
              setAnchorDateValue(toDateInputValue(addDays(weekStart, 7)));
            }}
          >
            Next
          </button>

          {view === "MONTH" ? (
            <input
              type="month"
              value={monthValue}
              onChange={(e) => setMonthValue(e.target.value)}
              className="rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs"
              aria-label="Month"
            />
          ) : (
            <input
              type="date"
              value={anchorDateValue}
              onChange={(e) => {
                setAnchorDateValue(e.target.value);
                if (view === "DAY") setSelectedDayKey(e.target.value);
              }}
              className="rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs"
              aria-label="Date"
            />
          )}
        </div>
      </div>

      {error ? (
        <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      {view === "DAY" ? (
        <DayCard
          day={selectedDayDate}
          plan={selectedPlanByDayKey[toDateKey(selectedDayDate)] || null}
          mode={mode}
          childId={childId}
          doneItemIds={doneItemIds}
          onOpenDay={() => openDay(toDateKey(selectedDayDate))}
          onToggleCompletion={toggleCompletion}
        />
      ) : view === "MONTH" ? (
        <MonthGrid
          weeks={calendarWeeks}
          monthStart={monthStart}
          monthEndExclusive={monthEndExclusive}
          selectedDayKey={selectedDayKey}
          selectedPlanByDayKey={selectedPlanByDayKey}
          onOpenDay={openDay}
        />
      ) : (
        <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-5">
          {weekDays.map((d) => (
            <WeekDayCard
              key={toDateKey(d)}
              day={d}
              selectedDayKey={selectedDayKey}
              plan={selectedPlanByDayKey[toDateKey(d)] || null}
              mode={mode}
              childId={childId}
              doneItemIds={doneItemIds}
              onOpenDay={openDay}
              onToggleCompletion={toggleCompletion}
            />
          ))}
        </div>
      )}

      {drawerOpen ? (
        <div className="fixed inset-0 z-[80]" role="dialog" aria-modal="true">
          <div
            className="absolute inset-0 bg-black/30"
            onClick={() => setDrawerOpen(false)}
          />
          <div className="absolute inset-y-0 right-0 w-full max-w-[480px] overflow-y-auto border-l border-gray-200 bg-white shadow-xl">
            <div className="sticky top-0 border-b border-gray-200 bg-white/90 p-3 backdrop-blur">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-extrabold text-gray-900">
                    {mode === "admin" ? "Task Settings" : "Planned Lessons"}
                  </div>
                  <div className="mt-1 text-xs text-gray-600">
                    {selectedDayDate.toLocaleDateString(undefined, {
                      weekday: "long",
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </div>
                </div>

                <button
                  type="button"
                  className="rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                  onClick={() => setDrawerOpen(false)}
                >
                  Close
                </button>
              </div>
            </div>

            <div className="p-3">
              {mode === "admin" ? (
                <div className="space-y-3">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Checklist Title
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      <input
                        defaultValue={activePlanTitle}
                        key={`title:${activePlan?.id || "none"}`}
                        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                        placeholder={DEFAULT_PLAN_TITLE}
                      />
                      <button
                        type="button"
                        className="rounded-lg bg-sky-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-sky-700 disabled:opacity-50"
                        disabled={saving}
                        onClick={(e) => {
                          const container = e.currentTarget.parentElement;
                          const input = container?.querySelector("input");
                          saveActivePlanTitle(input?.value);
                        }}
                      >
                        Save
                      </button>
                    </div>
                    <div className="mt-1 text-[11px] text-gray-500">
                      Saved per day. Teachers see this in their checklist.
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="mt-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Scheduled
                </div>
                <div className="mt-2 space-y-2">
                  {activeItems.length ? (
                    activeItems.map((it) => (
                      <div
                        key={it.id}
                        className={[
                          "flex items-start justify-between gap-3 rounded-xl border p-2.5",
                          it.id === selectedItemId
                            ? "border-sky-300 bg-sky-50"
                            : "border-gray-200 bg-white",
                        ].join(" ")}
                      >
                        <button
                          type="button"
                          className="min-w-0 flex-1 text-left"
                          onClick={() => setSelectedItemId(it.id)}
                        >
                          <div className="font-semibold text-gray-900">
                            {it.title || "Lesson"}
                          </div>
                          <div className="mt-1 flex flex-wrap gap-2 text-xs">
                            {it.lessonGoal ? (
                              <span className="rounded-full bg-blue-50 px-2 py-1 text-blue-800">
                                Step {it.lessonGoal.goalIndex}
                              </span>
                            ) : null}
                            {it.lesson?.category?.ageRange ? (
                              <span className="rounded-full bg-gray-100 px-2 py-1 text-gray-700">
                                {it.lesson.category.ageRange}
                              </span>
                            ) : null}
                            {it.lesson?.category?.name ? (
                              <span className="rounded-full bg-gray-100 px-2 py-1 text-gray-700">
                                {it.lesson.category.name}
                              </span>
                            ) : null}
                          </div>
                        </button>

                        {mode === "admin" ? (
                          <button
                            type="button"
                            className="rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50"
                            disabled={saving || !activeItemIds.has(it.id)}
                            onClick={() => removeItemFromActiveDay(it.id)}
                          >
                            Remove
                          </button>
                        ) : mode === "teacher" && childId ? (
                          <label className="flex items-center gap-2 text-xs font-semibold text-gray-700">
                            <input
                              type="checkbox"
                              checked={doneItemIds.has(it.id)}
                              onChange={(e) => toggleCompletion(it.id, e.target.checked)}
                            />
                            {doneItemIds.has(it.id) ? "Completed" : "Mark"}
                          </label>
                        ) : null}
                      </div>
                    ))
                  ) : (
                    <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-600">
                      No lessons scheduled for this day.
                    </div>
                  )}
                </div>
              </div>

              {mode === "teacher" ? (
                <div className="mt-6">
                  <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Lesson Guidance
                  </div>
                  <div className="mt-2 rounded-xl border border-gray-200 bg-white p-3">
                    {selectedItem && (selectedLessonGoal || selectedLesson) ? (
                      <div className="space-y-3">
                        <div>
                          <div className="text-sm font-extrabold text-gray-900">
                            {selectedLesson?.title || selectedItem.title || "Lesson"}
                          </div>
                          {selectedLesson?.description ? (
                            <div className="mt-1 text-xs text-gray-600">
                              {selectedLesson.description}
                            </div>
                          ) : null}
                          <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
                            {selectedLessonGoal?.goalIndex ? (
                              <span className="rounded-full bg-blue-50 px-2 py-1 text-blue-800">
                                Step {selectedLessonGoal.goalIndex}
                              </span>
                            ) : null}
                            {selectedPassingCriteria.age ? (
                              <span className="rounded-full bg-gray-100 px-2 py-1 text-gray-700">
                                {normalizeSpaces(selectedPassingCriteria.age)}
                              </span>
                            ) : null}
                            {selectedPassingCriteria.category ? (
                              <span className="rounded-full bg-gray-100 px-2 py-1 text-gray-700">
                                {normalizeSpaces(selectedPassingCriteria.category)}
                              </span>
                            ) : null}
                            {selectedPassingCriteria.subject ? (
                              <span className="rounded-full bg-gray-100 px-2 py-1 text-gray-700">
                                {normalizeSpaces(selectedPassingCriteria.subject)}
                              </span>
                            ) : null}
                          </div>
                        </div>

                        <GuidanceRow
                          label="Testing Question"
                          value={
                            normalizeSpaces(
                              selectedPassingCriteria.testingQuestion ||
                                selectedLessonGoal?.description ||
                                "",
                            ) || ""
                          }
                        />
                        <GuidanceRow
                          label="Resource"
                          value={normalizeSpaces(selectedPassingCriteria.resource || "")}
                        />
                        <GuidanceRow
                          label="Additional Resources"
                          value={splitResources(selectedPassingCriteria.additionalResources).join("\n")}
                          multiline
                        />
                        <GuidanceRow
                          label="Notes"
                          value={normalizeSpaces(selectedPassingCriteria.notes || "")}
                          multiline
                        />

                        {(selectedLesson?.media || []).length ? (
                          <div>
                            <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                              Lesson Media
                            </div>
                            <div className="mt-2 flex flex-col gap-1.5">
                              {selectedLesson.media.slice(0, 8).map((m) => (
                                <a
                                  key={m}
                                  href={m}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="truncate text-xs font-semibold text-sky-700 hover:text-sky-800"
                                >
                                  {m}
                                </a>
                              ))}
                            </div>
                          </div>
                        ) : null}

                        {bulkCount ? (
                          <div className="flex flex-wrap items-center gap-2 pt-1">
                            <button
                              type="button"
                              className="rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                              disabled={updating || !selectedItem?.id}
                              onClick={() => bulkToggleCompletion(selectedItem.id, true)}
                            >
                              Bulk mark ({bulkCount})
                            </button>
                            <button
                              type="button"
                              className="rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                              disabled={updating || !selectedItem?.id}
                              onClick={() => bulkToggleCompletion(selectedItem.id, false)}
                            >
                              Bulk clear
                            </button>
                            <div className="text-[11px] text-gray-500">
                              Applies to selected children
                            </div>
                          </div>
                        ) : null}
                      </div>
                    ) : activeItems.length ? (
                      <div className="text-sm text-gray-600">
                        Click a scheduled lesson above to see the testing question and resources.
                      </div>
                    ) : (
                      <div className="text-sm text-gray-600">
                        No scheduled lessons for this day.
                      </div>
                    )}
                  </div>
                </div>
              ) : null}

              {mode === "admin" ? (
                <div className="mt-6">
                  <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Add From Curriculum List
                  </div>
                  <div className="mt-1 text-xs text-gray-600">
                    Filter by age, category, and subject.
                  </div>

                  <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                    <label className="block">
                      <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
                        Age
                      </div>
                      <select
                        value={age}
                        onChange={(e) => setAge(e.target.value)}
                        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                      >
                        <option value="">All</option>
                        {options.ages.map((a) => (
                          <option key={a} value={a}>
                            {a}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="block">
                      <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
                        Subject
                      </div>
                      <select
                        value={subject}
                        onChange={(e) => setSubject(e.target.value)}
                        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                      >
                        <option value="">All</option>
                        {options.subjects.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="block md:col-span-2">
                      <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
                        Category
                      </div>
                      <select
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                      >
                        <option value="">All</option>
                        {options.categories.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="block md:col-span-2">
                      <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
                        Search
                      </div>
                      <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                        placeholder="Search lesson or progression step..."
                      />
                    </label>
                  </div>

                  <div className="mt-3 rounded-xl border border-gray-200">
                    <div className="max-h-[420px] overflow-y-auto divide-y divide-gray-100">
                      {filteredRecords.length ? (
                        filteredRecords.map((r) => {
                          const already = activeLessonGoalIds.has(r.id);
                          return (
                            <div
                              key={r.id}
                              className="flex items-start justify-between gap-3 p-3"
                            >
                              <div className="min-w-0">
                                <div className="text-sm font-semibold text-gray-900">
                                  {r.lessonTitle}
                                </div>
                                <div className="mt-1 text-xs text-gray-600">
                                  {r.progressionStep}
                                </div>
                                <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
                                  {r.age ? (
                                    <span className="rounded-full bg-gray-100 px-2 py-1 text-gray-700">
                                      {r.age}
                                    </span>
                                  ) : null}
                                  {r.category ? (
                                    <span className="rounded-full bg-gray-100 px-2 py-1 text-gray-700">
                                      {r.category}
                                    </span>
                                  ) : null}
                                  {r.subject ? (
                                    <span className="rounded-full bg-gray-100 px-2 py-1 text-gray-700">
                                      {r.subject}
                                    </span>
                                  ) : null}
                                </div>
                              </div>

                              <button
                                type="button"
                                className="rounded-lg bg-sky-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-sky-700 disabled:opacity-50"
                                disabled={saving || already}
                                onClick={() => addRecordToActiveDay(r)}
                              >
                                {already ? "Added" : "Add"}
                              </button>
                            </div>
                          );
                        })
                      ) : (
                        <div className="p-4 text-sm text-gray-600">
                          {loading
                            ? "Loading..."
                            : lessons.length
                              ? "No curriculum records match the filters."
                              : "No lessons found for this center."}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mt-3 text-xs text-gray-500">
                    Showing {filteredRecords.length} of {records.length} records.
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
