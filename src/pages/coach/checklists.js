import CoachLayout from "@/components/coach/CoachLayout";
import { SkeletonTable } from "@/components/ui/Skeleton";
import { apiJson } from "@/lib/api";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";

const CATEGORIES = [
  { key: "ALL", label: "All", icon: "M4 6h16M4 12h16M4 18h16" },
  { key: "OPENING", label: "Opening", icon: "M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" },
  { key: "CLOSING", label: "Closing", icon: "M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" },
  { key: "HEALTH_SAFETY", label: "Health & Safety", icon: "M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" },
  { key: "CLEANING", label: "Cleaning", icon: "M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" },
  { key: "MEALS", label: "Meals", icon: "M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z" },
  { key: "CLASSROOM", label: "Classroom", icon: "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" },
];

const FREQ_LABELS = { DAILY: "Daily", WEEKLY: "Weekly", MONTHLY: "Monthly" };
const FREQ_COLORS = {
  DAILY: "bg-blue-50 text-blue-700",
  WEEKLY: "bg-purple-50 text-purple-700",
  MONTHLY: "bg-amber-50 text-amber-700",
};
const CAT_COLORS = {
  OPENING: "border-l-amber-400",
  CLOSING: "border-l-indigo-400",
  HEALTH_SAFETY: "border-l-red-400",
  CLEANING: "border-l-emerald-400",
  MEALS: "border-l-orange-400",
  CLASSROOM: "border-l-sky-400",
  OTHER: "border-l-gray-400",
};

export default function CoachChecklists() {
  const router = useRouter();
  const { centerId: qCenterId } = router.query;

  const [centers, setCenters] = useState([]);
  const [centerId, setCenterId] = useState("");
  const [checklists, setChecklists] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [activeCategory, setActiveCategory] = useState("ALL");
  const [selectedDate, setSelectedDate] = useState(todayStr());
  const [completing, setCompleting] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const c = await apiJson("/api/v1/centers");
        const arr = Array.isArray(c) ? c : [];
        setCenters(arr);
        setCenterId(qCenterId || (arr.length === 1 ? arr[0].id : ""));
      } catch {}
    })();
  }, [qCenterId]);

  async function loadChecklists() {
    if (!centerId) return;
    setLoading(true);
    setError("");
    try {
      const data = await apiJson(
        `/api/v1/daily-checklists?centerId=${encodeURIComponent(centerId)}&date=${encodeURIComponent(selectedDate)}`
      );
      setChecklists(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e.message || "Failed to load checklists");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadChecklists();
  }, [centerId, selectedDate]);

  async function toggleItem(itemId, isCompleted) {
    setCompleting(itemId);
    try {
      await apiJson("/api/v1/daily-checklists/complete", {
        method: "POST",
        body: JSON.stringify({
          itemId,
          date: selectedDate,
          undo: isCompleted,
        }),
      });
      await loadChecklists();
    } catch (e) {
      setError(e.message || "Failed to update");
    } finally {
      setCompleting("");
    }
  }

  const filtered = useMemo(() => {
    if (activeCategory === "ALL") return checklists;
    return checklists.filter((cl) => cl.category === activeCategory);
  }, [checklists, activeCategory]);

  // Group by category
  const grouped = useMemo(() => {
    const groups = {};
    for (const cl of filtered) {
      if (!groups[cl.category]) groups[cl.category] = [];
      groups[cl.category].push(cl);
    }
    return groups;
  }, [filtered]);

  // Overall stats
  const stats = useMemo(() => {
    let total = 0;
    let completed = 0;
    for (const cl of checklists) {
      for (const item of cl.items || []) {
        total++;
        if ((item.completions || []).length > 0) completed++;
      }
    }
    return { total, completed, pct: total > 0 ? Math.round((completed / total) * 100) : 0 };
  }, [checklists]);

  // Category stats
  const categoryStats = useMemo(() => {
    const map = {};
    for (const cl of checklists) {
      if (!map[cl.category]) map[cl.category] = { total: 0, completed: 0 };
      for (const item of cl.items || []) {
        map[cl.category].total++;
        if ((item.completions || []).length > 0) map[cl.category].completed++;
      }
    }
    return map;
  }, [checklists]);

  return (
    <CoachLayout title="Daily Checklists">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex flex-col gap-4 rounded-2xl border border-gray-200 bg-white p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-extrabold text-gray-900">Daily Operations Checklists</h2>
            <p className="mt-1 text-sm text-gray-600">
              Track daily opening, closing, health & safety, cleaning, and classroom tasks.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {centers.length > 1 && (
              <select
                value={centerId}
                onChange={(e) => setCenterId(e.target.value)}
                className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
              >
                <option value="">Select center...</option>
                {centers.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            )}
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={() => setSelectedDate(todayStr())}
              className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
            >
              Today
            </button>
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>
        )}

        {!centerId && (
          <div className="rounded-2xl border border-gray-200 bg-gray-50 p-6 text-center text-sm text-gray-600">
            Select a center to view checklists.
          </div>
        )}

        {centerId && (
          <>
            {/* Overall progress bar */}
            <div className="rounded-2xl border border-gray-200 bg-white p-5">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-gray-700">
                  Today&apos;s Progress
                </div>
                <div className="text-sm font-extrabold text-gray-900">
                  {stats.completed}/{stats.total} tasks ({stats.pct}%)
                </div>
              </div>
              <div className="mt-2 h-3 w-full overflow-hidden rounded-full bg-gray-100">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    stats.pct === 100
                      ? "bg-emerald-500"
                      : stats.pct >= 50
                        ? "bg-sky-500"
                        : stats.pct > 0
                          ? "bg-amber-500"
                          : "bg-gray-200"
                  }`}
                  style={{ width: `${stats.pct}%` }}
                />
              </div>
              {/* Category mini-stats */}
              <div className="mt-3 flex flex-wrap gap-2">
                {Object.entries(categoryStats).map(([cat, s]) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setActiveCategory(activeCategory === cat ? "ALL" : cat)}
                    className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                      activeCategory === cat
                        ? "bg-gray-900 text-white"
                        : s.completed === s.total
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    {catLabel(cat)} {s.completed}/{s.total}
                    {s.completed === s.total && s.total > 0 && " \u2713"}
                  </button>
                ))}
              </div>
            </div>

            {/* Category filter tabs */}
            <div className="flex flex-wrap gap-1.5">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.key}
                  type="button"
                  onClick={() => setActiveCategory(cat.key)}
                  className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition ${
                    activeCategory === cat.key
                      ? "bg-gray-900 text-white"
                      : "border border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d={cat.icon} />
                  </svg>
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Checklists */}
            {loading ? (
              <div className="rounded-2xl border border-gray-200 bg-white p-5">
                <SkeletonTable rows={5} cols={3} />
              </div>
            ) : filtered.length === 0 ? (
              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-6 text-center text-sm text-gray-600">
                {checklists.length === 0
                  ? "No daily checklists created yet. Ask an admin to create checklists."
                  : "No checklists in this category."}
              </div>
            ) : (
              Object.entries(grouped).map(([category, lists]) => (
                <div key={category} className="space-y-3">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-extrabold uppercase tracking-wide text-gray-500">
                      {catLabel(category)}
                    </h3>
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-600">
                      {lists.reduce((a, cl) => a + (cl.items?.length || 0), 0)} tasks
                    </span>
                  </div>

                  {lists.map((cl) => (
                    <ChecklistCard
                      key={cl.id}
                      checklist={cl}
                      onToggle={toggleItem}
                      completing={completing}
                    />
                  ))}
                </div>
              ))
            )}
          </>
        )}
      </div>
    </CoachLayout>
  );
}

function ChecklistCard({ checklist, onToggle, completing }) {
  const [expanded, setExpanded] = useState(true);
  const items = checklist.items || [];
  const completedCount = items.filter((it) => (it.completions || []).length > 0).length;
  const allDone = completedCount === items.length && items.length > 0;
  const pct = items.length > 0 ? Math.round((completedCount / items.length) * 100) : 0;

  return (
    <div className={`rounded-2xl border-l-4 border border-gray-200 bg-white ${CAT_COLORS[checklist.category] || "border-l-gray-400"} ${allDone ? "opacity-75" : ""}`}>
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between gap-4 p-4 text-left"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className={`text-sm font-extrabold ${allDone ? "text-gray-500" : "text-gray-900"}`}>
              {checklist.title}
            </span>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${FREQ_COLORS[checklist.frequency] || "bg-gray-100 text-gray-600"}`}>
              {FREQ_LABELS[checklist.frequency] || checklist.frequency}
            </span>
            {checklist.classRoom && (
              <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-semibold text-sky-700">
                {checklist.classRoom.name}
              </span>
            )}
            {allDone && (
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                Complete
              </span>
            )}
          </div>
          {checklist.description && (
            <p className="mt-0.5 text-xs text-gray-500">{checklist.description}</p>
          )}
          <div className="mt-1.5 flex items-center gap-2">
            <div className="h-1.5 w-24 overflow-hidden rounded-full bg-gray-100">
              <div
                className={`h-full rounded-full transition-all ${allDone ? "bg-emerald-500" : "bg-sky-500"}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="text-[10px] font-semibold text-gray-500">
              {completedCount}/{items.length}
            </span>
          </div>
        </div>
        <svg
          className={`h-5 w-5 shrink-0 text-gray-400 transition ${expanded ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && items.length > 0 && (
        <div className="border-t border-gray-100 px-4 pb-4">
          <div className="divide-y divide-gray-50">
            {items.map((item) => {
              const done = (item.completions || []).length > 0;
              const completion = (item.completions || [])[0];
              const isCompleting = completing === item.id;

              return (
                <div
                  key={item.id}
                  className={`flex items-start gap-3 py-3 ${done ? "opacity-60" : ""}`}
                >
                  <button
                    type="button"
                    onClick={() => onToggle(item.id, done)}
                    disabled={isCompleting}
                    className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition ${
                      done
                        ? "border-emerald-500 bg-emerald-500 text-white"
                        : "border-gray-300 bg-white hover:border-sky-400"
                    } ${isCompleting ? "animate-pulse" : ""}`}
                  >
                    {done && (
                      <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    )}
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className={`text-sm font-medium ${done ? "text-gray-400 line-through" : "text-gray-900"}`}>
                      {item.title}
                    </div>
                    {item.description && (
                      <p className="mt-0.5 text-xs text-gray-500">{item.description}</p>
                    )}
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {item.policyLink && (
                        <a
                          href={item.policyLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700 hover:bg-blue-100"
                        >
                          Policy
                        </a>
                      )}
                      {item.mediaLink && (
                        <a
                          href={item.mediaLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700 hover:bg-blue-100"
                        >
                          Video
                        </a>
                      )}
                    </div>
                    {done && completion && (
                      <div className="mt-1 text-[10px] text-emerald-600">
                        Completed by {completion.completedBy?.name || completion.completedBy?.email || "Staff"}{" "}
                        at {new Date(completion.completedAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function todayStr() {
  const d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

function catLabel(cat) {
  const map = {
    OPENING: "Opening",
    CLOSING: "Closing",
    HEALTH_SAFETY: "Health & Safety",
    CLEANING: "Cleaning",
    MEALS: "Meals",
    CLASSROOM: "Classroom",
    OTHER: "Other",
  };
  return map[cat] || cat;
}
