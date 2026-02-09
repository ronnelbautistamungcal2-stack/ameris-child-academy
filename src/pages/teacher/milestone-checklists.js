import TeacherLayout from "@/components/teacher/TeacherLayout";
import { apiJson } from "@/lib/api";
import { useEffect, useMemo, useState } from "react";

const PERIODS = ["DAY", "WEEK", "MONTH"];

function byString(a, b) {
  return String(a || "").localeCompare(String(b || ""));
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

function startOfPeriod(date, period) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);

  if (period === "DAY") return d;

  if (period === "WEEK") {
    // Monday-start week
    const day = d.getDay(); // 0=Sun
    const diff = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + diff);
    return d;
  }

  // MONTH
  d.setDate(1);
  return d;
}

function toIsoDate(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function toDateKey(date) {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "";
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function startOfWeekMonday(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
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

function formatRange(start, end) {
  const a = new Date(start);
  const b = new Date(end);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return "";
  return `${a.toLocaleDateString()} \u2013 ${b.toLocaleDateString()}`;
}

export default function TeacherMilestoneChecklists() {
  const [centers, setCenters] = useState([]);
  const [centerId, setCenterId] = useState("");

  const [children, setChildren] = useState([]);
  const [childId, setChildId] = useState("");

  const [period, setPeriod] = useState("DAY");
  const [anchorDateValue, setAnchorDateValue] = useState(
    toDateInputValue(new Date()),
  );

  const [plans, setPlans] = useState([]);
  const [completionByItemId, setCompletionByItemId] = useState(new Map());
  const [progressRows, setProgressRows] = useState([]);

  const [calendarMonthValue, setCalendarMonthValue] = useState(
    toMonthInputValue(new Date()),
  );
  const [monthPlans, setMonthPlans] = useState([]);
  const [selectedDayKey, setSelectedDayKey] = useState(toDateKey(new Date()));
  const [doneItemIds, setDoneItemIds] = useState(new Set());
  const [doneCountByPlanId, setDoneCountByPlanId] = useState(new Map());

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const isMonthView = period === "MONTH";

  const periodStart = useMemo(() => {
    const parsed = anchorDateValue ? new Date(anchorDateValue) : new Date();
    return startOfPeriod(parsed, period);
  }, [anchorDateValue, period]);

  const calendarMonthStart = useMemo(() => {
    const parsed = parseMonthInputValue(calendarMonthValue) || new Date();
    parsed.setHours(0, 0, 0, 0);
    parsed.setDate(1);
    return parsed;
  }, [calendarMonthValue]);

  const calendarMonthEnd = useMemo(() => {
    const d = new Date(calendarMonthStart);
    d.setMonth(d.getMonth() + 1);
    return d;
  }, [calendarMonthStart]);

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
        setChildId("");
        return;
      }
      setLoading(true);
      setError("");
      try {
        const kids = await apiJson(
          `/api/v1/children?centerId=${encodeURIComponent(centerId)}`,
        );
        setChildren(Array.isArray(kids) ? kids : []);
      } catch (e) {
        setError(e.message || "Failed to load children");
      } finally {
        setLoading(false);
      }
    })();
  }, [centerId]);

  useEffect(() => {
    // Keep selectedDay within the current calendar month.
    const d = calendarMonthStart;
    const key = toDateKey(d);
    if (!selectedDayKey || !selectedDayKey.startsWith(key.slice(0, 7))) {
      setSelectedDayKey(key);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calendarMonthStart.toISOString()]);

  async function loadPlans() {
    if (!centerId) {
      setPlans([]);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const qs = new URLSearchParams({
        centerId,
        period,
        start: toIsoDate(periodStart),
      });
      const data = await apiJson(
        `/api/v1/milestone-checklists?${qs.toString()}`,
      );
      setPlans(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e.message || "Failed to load milestone plans");
      setPlans([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPlans();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [centerId, period, periodStart.toISOString()]);

  async function loadMonthPlans() {
    if (!centerId) {
      setMonthPlans([]);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const qs = new URLSearchParams({
        centerId,
        period: "DAY",
        from: toIsoDate(calendarMonthStart),
        to: toIsoDate(calendarMonthEnd),
      });
      const data = await apiJson(
        `/api/v1/milestone-checklists?${qs.toString()}`,
      );
      setMonthPlans(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e.message || "Failed to load calendar plans");
      setMonthPlans([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!isMonthView) return;
    loadMonthPlans();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMonthView, centerId, calendarMonthStart.toISOString()]);

  async function loadCompletions() {
    if (!childId || !plans.length) {
      setCompletionByItemId(new Map());
      return;
    }
    try {
      const results = await Promise.all(
        plans.map((p) =>
          apiJson(
            `/api/v1/milestone-checklists/completions?childId=${encodeURIComponent(
              childId,
            )}&planId=${encodeURIComponent(p.id)}`,
          ).catch(() => []),
        ),
      );
      const map = new Map();
      for (const arr of results) {
        for (const c of Array.isArray(arr) ? arr : []) {
          if (c?.itemId) map.set(c.itemId, c.completedAt || null);
        }
      }
      setCompletionByItemId(map);
    } catch {
      setCompletionByItemId(new Map());
    }
  }

  useEffect(() => {
    loadCompletions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [childId, plans.map((p) => p.id).join(",")]);

  async function loadMonthCompletions() {
    if (!isMonthView) return;
    if (!childId || !centerId) {
      setDoneItemIds(new Set());
      setDoneCountByPlanId(new Map());
      return;
    }
    try {
      const qs = new URLSearchParams({
        childId,
        period: "DAY",
        from: toIsoDate(calendarMonthStart),
        to: toIsoDate(calendarMonthEnd),
      });
      const data = await apiJson(
        `/api/v1/milestone-checklists/completions?${qs.toString()}`,
      );
      const ids = new Set();
      const planCounts = new Map();
      for (const row of Array.isArray(data) ? data : []) {
        if (!row?.itemId) continue;
        if (!row.completedAt) continue;
        ids.add(row.itemId);
        const planId = row?.item?.planId;
        if (planId) planCounts.set(planId, (planCounts.get(planId) || 0) + 1);
      }
      setDoneItemIds(ids);
      setDoneCountByPlanId(planCounts);
    } catch {
      setDoneItemIds(new Set());
      setDoneCountByPlanId(new Map());
    }
  }

  useEffect(() => {
    loadMonthCompletions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMonthView, childId, centerId, calendarMonthStart.toISOString()]);

  useEffect(() => {
    (async () => {
      if (!childId) {
        setProgressRows([]);
        return;
      }
      try {
        const p = await apiJson(
          `/api/v1/progress?childId=${encodeURIComponent(childId)}`,
        );
        setProgressRows(Array.isArray(p) ? p : []);
      } catch {
        setProgressRows([]);
      }
    })();
  }, [childId]);

  const childOptions = useMemo(() => {
    return [...children].sort((a, b) => byString(a.firstName, b.firstName));
  }, [children]);

  const progressByLessonGoal = useMemo(() => {
    const map = new Map();
    for (const pr of progressRows) {
      const key = `${pr.lessonId}::${pr.goalIndex}`;
      const existing = map.get(key);
      if (!existing) {
        map.set(key, pr);
        continue;
      }
      if (
        new Date(pr.createdAt).getTime() >
        new Date(existing.createdAt).getTime()
      ) {
        map.set(key, pr);
      }
    }
    return map;
  }, [progressRows]);

  async function toggleCompletion(itemId, next) {
    if (!childId) return;
    setError("");
    try {
      await apiJson("/api/v1/milestone-checklists/completions", {
        method: "POST",
        body: JSON.stringify({ childId, itemId, completed: next }),
      });
      await loadCompletions();
    } catch (e) {
      setError(e.message || "Failed to update completion");
    }
  }

  function headerTitle() {
    if (period === "MONTH") {
      return calendarMonthStart.toLocaleString(undefined, {
        month: "long",
        year: "numeric",
      });
    }
    if (period === "WEEK") {
      const start = startOfWeekMonday(periodStart);
      const end = addDays(start, 6);
      return `Week of ${formatRange(start, end)}`;
    }
    return new Date(periodStart).toLocaleDateString(undefined, {
      weekday: "short",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  }

  function goPrev() {
    if (period === "MONTH") {
      const next = addMonths(calendarMonthStart, -1);
      setCalendarMonthValue(toMonthInputValue(next));
      return;
    }
    if (period === "WEEK") {
      const next = addDays(periodStart, -7);
      setAnchorDateValue(toDateInputValue(next));
      return;
    }
    const next = addDays(periodStart, -1);
    setAnchorDateValue(toDateInputValue(next));
  }

  function goNext() {
    if (period === "MONTH") {
      const next = addMonths(calendarMonthStart, 1);
      setCalendarMonthValue(toMonthInputValue(next));
      return;
    }
    if (period === "WEEK") {
      const next = addDays(periodStart, 7);
      setAnchorDateValue(toDateInputValue(next));
      return;
    }
    const next = addDays(periodStart, 1);
    setAnchorDateValue(toDateInputValue(next));
  }

  return (
    <TeacherLayout title="Milestone Checklist">
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-2xl font-extrabold text-gray-900">
              {headerTitle()}
            </h2>
            <p className="mt-1 text-sm text-gray-600">
              Checklist items can link to policies, procedures, videos, and
              lessons.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="rounded-full border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50 disabled:opacity-60"
              onClick={goPrev}
              disabled={!centerId || loading}
              aria-label="Previous"
              title="Previous"
            >
              Previous
            </button>
            <button
              type="button"
              className="rounded-full border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50 disabled:opacity-60"
              onClick={goNext}
              disabled={!centerId || loading}
              aria-label="Next"
              title="Next"
            >
              Next
            </button>

            <select
              className="rounded-full border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-800"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              disabled={!centerId || loading}
              aria-label="View"
              title="View"
            >
              {PERIODS.map((p) => (
                <option key={p} value={p}>
                  {p === "DAY" ? "Day" : p === "WEEK" ? "Week" : "Month"}
                </option>
              ))}
            </select>
          </div>
        </div>

        {error ? (
          <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {error}
          </div>
        ) : null}

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-4">
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
              <option value="">Select a center</option>
              {centers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
              {period === "MONTH"
                ? "Month"
                : period === "WEEK"
                  ? "Week of"
                  : "Day"}
            </div>
            {period === "MONTH" ? (
              <input
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                type="month"
                value={calendarMonthValue}
                onChange={(e) => setCalendarMonthValue(e.target.value)}
                disabled={!centerId || loading}
              />
            ) : (
              <input
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                type="date"
                value={anchorDateValue}
                onChange={(e) => setAnchorDateValue(e.target.value)}
                disabled={!centerId || loading}
              />
            )}
          </label>

          <div className="hidden md:block" />

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
              <option value="">(view only)</option>
              {childOptions.map((ch) => (
                <option key={ch.id} value={ch.id}>
                  {ch.firstName} {ch.lastName || ""}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-4">
          {loading ? (
            <div className="text-sm text-gray-600">Loadingâ€¦</div>
          ) : !centerId ? (
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
              Select a center to view milestone plans.
            </div>
          ) : period === "MONTH" ? (
            <CalendarMonth
              monthStart={calendarMonthStart}
              monthEnd={calendarMonthEnd}
              monthPlans={monthPlans}
              selectedDayKey={selectedDayKey}
              onSelectDay={setSelectedDayKey}
              childId={childId}
              doneItemIds={doneItemIds}
              doneCountByPlanId={doneCountByPlanId}
              onToggleCompletion={toggleCompletion}
              progressByLessonGoal={progressByLessonGoal}
            />
          ) : plans.length === 0 ? (
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
              No milestone plans found for this {period.toLowerCase()}.
            </div>
          ) : (
            <PlanList
              plans={plans}
              childId={childId}
              completionByItemId={completionByItemId}
              progressByLessonGoal={progressByLessonGoal}
              onToggleCompletion={toggleCompletion}
            />
          )}
        </div>
      </div>
    </TeacherLayout>
  );
}

function PlanList({
  plans,
  childId,
  completionByItemId,
  progressByLessonGoal,
  onToggleCompletion,
}) {
  return (
    <div className="space-y-3">
      {plans.map((p) => (
        <div key={p.id} className="rounded-xl border border-gray-200 p-4">
          <div className="flex flex-col gap-1">
            <div className="text-base font-extrabold text-gray-900">
              {p.title}
            </div>
            <div className="text-sm text-gray-600">
              {p.description || "â€”"}
            </div>
            <div className="text-xs text-gray-500">
              {p.period} â€¢ {new Date(p.periodStart).toLocaleDateString()}
            </div>
          </div>

          <div className="mt-3">
            {Array.isArray(p.items) && p.items.length ? (
              <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200">
                {p.items.map((it) => (
                  <MilestoneItemRow
                    key={it.id}
                    item={it}
                    childId={childId}
                    done={!!completionByItemId.get(it.id)}
                    progressByLessonGoal={progressByLessonGoal}
                    onToggle={(next) => onToggleCompletion(it.id, next)}
                  />
                ))}
              </ul>
            ) : (
              <div className="text-sm text-gray-600">No items.</div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function CalendarMonth({
  monthStart,
  monthEnd,
  monthPlans,
  selectedDayKey,
  onSelectDay,
  childId,
  doneItemIds,
  doneCountByPlanId,
  onToggleCompletion,
  progressByLessonGoal,
}) {
  const plansByDay = useMemo(() => {
    const map = new Map();
    for (const p of Array.isArray(monthPlans) ? monthPlans : []) {
      const key = toDateKey(p.periodStart);
      if (!key) continue;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(p);
    }
    for (const [k, arr] of map.entries()) {
      map.set(
        k,
        arr
          .slice()
          .sort((a, b) =>
            String(a.title || "").localeCompare(String(b.title || "")),
          ),
      );
    }
    return map;
  }, [monthPlans]);

  const selectedPlans = plansByDay.get(selectedDayKey) || [];

  const gridStart = useMemo(() => startOfWeekMonday(monthStart), [monthStart]);
  const cells = useMemo(
    () => Array.from({ length: 42 }, (_, i) => addDays(gridStart, i)),
    [gridStart],
  );

  const todayKey = toDateKey(new Date());

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      <div className="md:col-span-2">
        <div className="rounded-xl border border-gray-200">
          <div className="grid grid-cols-5 border-b border-gray-200 bg-gray-50 text-xs font-semibold text-gray-600">
            {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"].map(
              (d) => (
                <div key={d} className="px-3 py-2">
                  {d}
                </div>
              ),
            )}
          </div>

          <div className="grid grid-cols-5">
            {cells
              .filter((d) => {
                const dow = d.getDay();
                return dow >= 1 && dow <= 5; // Mon..Fri only
              })
              .map((d) => {
                const key = toDateKey(d);
                const inMonth = d >= monthStart && d < monthEnd;
                const isSelected = key === selectedDayKey;
                const isToday = key === todayKey;
                const dayPlans = plansByDay.get(key) || [];
                const itemCount = dayPlans.reduce(
                  (m, p) => m + (p.items?.length || 0),
                  0,
                );
                const doneCount = dayPlans.reduce(
                  (m, p) => m + (doneCountByPlanId.get(p.id) || 0),
                  0,
                );

                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => onSelectDay(key)}
                    className={
                      "h-24 w-full border-t border-gray-100 px-2 py-2 text-left hover:bg-gray-50 " +
                      (!inMonth ? "bg-gray-50/40 text-gray-400 " : "") +
                      (isSelected ? "bg-blue-50 " : "") +
                      (isToday ? "ring-1 ring-inset ring-blue-300 " : "")
                    }
                  >
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-semibold">{d.getDate()}</div>
                      {itemCount ? (
                        <div className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-700">
                          {itemCount} item{itemCount === 1 ? "" : "s"}
                        </div>
                      ) : null}
                    </div>

                    {childId && itemCount ? (
                      <div className="mt-2 text-xs text-gray-600">
                        {doneCount}/{itemCount} done
                      </div>
                    ) : null}

                    {dayPlans.length ? (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {dayPlans.slice(0, 3).map((p) => (
                          <span
                            key={p.id}
                            className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-800"
                            title={p.title}
                          >
                            {String(p.title || "").slice(0, 14)}
                          </span>
                        ))}
                        {dayPlans.length > 3 ? (
                          <span className="text-[11px] font-semibold text-gray-500">
                            +{dayPlans.length - 3}
                          </span>
                        ) : null}
                      </div>
                    ) : null}
                  </button>
                );
              })}
          </div>
        </div>
      </div>

      <div className="md:col-span-1">
        <div className="rounded-xl border border-gray-200 p-4">
          <div className="text-sm font-extrabold text-gray-900">
            {selectedDayKey
              ? new Date(selectedDayKey).toLocaleDateString()
              : "Selected day"}
          </div>
          <div className="mt-1 text-xs text-gray-500">
            Click a day to see what to teach.
          </div>

          <div className="mt-3 space-y-3">
            {selectedPlans.length === 0 ? (
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-600">
                No plans for this day.
              </div>
            ) : (
              selectedPlans.map((p) => (
                <div
                  key={p.id}
                  className="rounded-lg border border-gray-200 p-3"
                >
                  <div className="font-semibold text-gray-900">{p.title}</div>
                  <div className="mt-1 text-xs text-gray-600">
                    {p.description || "â€”"}
                  </div>
                  <div className="mt-3">
                    {Array.isArray(p.items) && p.items.length ? (
                      <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200">
                        {p.items.map((it) => (
                          <MilestoneItemRow
                            key={it.id}
                            item={it}
                            childId={childId}
                            done={doneItemIds.has(it.id)}
                            progressByLessonGoal={progressByLessonGoal}
                            onToggle={(next) => onToggleCompletion(it.id, next)}
                            compact
                          />
                        ))}
                      </ul>
                    ) : (
                      <div className="text-sm text-gray-600">No items.</div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function MilestoneItemRow({
  item,
  childId,
  done,
  progressByLessonGoal,
  onToggle,
  compact = false,
}) {
  const lessonId =
    item.lessonGoal?.lessonId || item.lessonId || item.lesson?.id || "";
  const goalIndex = item.lessonGoal?.goalIndex || null;
  const prKey = lessonId && goalIndex ? `${lessonId}::${goalIndex}` : "";
  const pr = prKey ? progressByLessonGoal.get(prKey) : null;

  const recommended =
    pr?.status === "FAILED" && item.lesson?.remediationsFrom?.length
      ? item.lesson.remediationsFrom.map((r) => r?.toLesson).filter(Boolean)
      : [];

  return (
    <li className={compact ? "px-3 py-2" : "px-3 py-3"}>
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="font-semibold text-gray-900">{item.title}</div>
          <div className="mt-1 flex flex-wrap gap-2 text-xs">
            {item.policyDocument?.url ? (
              <a
                href={item.policyDocument.url}
                target="_blank"
                rel="noreferrer"
                className="rounded-full bg-gray-100 px-2 py-1 text-gray-700 hover:bg-gray-200"
              >
                Policy
              </a>
            ) : null}
            {item.url ? (
              <a
                href={item.url}
                target="_blank"
                rel="noreferrer"
                className="rounded-full bg-gray-100 px-2 py-1 text-gray-700 hover:bg-gray-200"
              >
                {item.kind || "Link"}
              </a>
            ) : null}
            {item.lesson ? (
              <span className="rounded-full bg-blue-50 px-2 py-1 text-blue-800">
                Lesson{goalIndex ? ` Step ${goalIndex}` : ""}
              </span>
            ) : null}
          </div>

          {goalIndex ? (
            <div className="mt-2 text-xs text-gray-600">
              Progress:{" "}
              <span className="font-semibold text-gray-900">
                {pr?.status || "NOT_STARTED"}
              </span>
            </div>
          ) : null}

          {!compact && recommended.length ? (
            <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">
              <div className="font-semibold">Suggested catch-up lessons</div>
              <ul className="mt-1 list-disc pl-5">
                {recommended.slice(0, 5).map((r) => (
                  <li key={r.id}>{r.title}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        <div className="flex items-center gap-3">
          {childId ? (
            <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
              <input
                type="checkbox"
                checked={done}
                onChange={(e) => onToggle(e.target.checked)}
              />
              {done ? "Completed" : "Mark"}
            </label>
          ) : (
            <span className="text-xs text-gray-500">
              Select a child to track
            </span>
          )}
        </div>
      </div>
    </li>
  );
}
