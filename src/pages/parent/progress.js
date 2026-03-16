import ParentLayout from "@/components/parent/ParentLayout";
import ProgressEntryTimeline from "@/components/progression/ProgressEntryTimeline";
import { apiJson } from "@/lib/api";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";

const STATUS_BADGE = {
  NOT_STARTED: "bg-gray-100 text-gray-700",
  IN_PROGRESS: "bg-amber-100 text-amber-800",
  COMPLETED: "bg-emerald-100 text-emerald-800",
  PASSED: "bg-emerald-100 text-emerald-800",
  FAILED: "bg-red-100 text-red-800",
};

const STATUS_LABEL = {
  NOT_STARTED: "Not Started",
  IN_PROGRESS: "In Progress",
  COMPLETED: "Completed",
  PASSED: "Passed",
  FAILED: "Failed",
};

const STAGE_FILTERS = [
  { value: "active", label: "Active Goals", icon: IconActive },
  { value: "all", label: "All Goals", icon: IconAll },
  { value: "completed", label: "Completed", icon: IconCompleted },
  { value: "failed", label: "Failed", icon: IconFailed },
];

function byString(a, b) {
  return String(a || "").localeCompare(String(b || ""));
}

function formatDate(value) {
  if (!value) return "\u2014";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "\u2014";
  return d.toLocaleDateString();
}

export default function ParentProgress() {
  const router = useRouter();
  const childIdFromQuery = typeof router.query.childId === "string" ? router.query.childId : "";

  const [children, setChildren] = useState([]);
  const [selectedChildId, setSelectedChildId] = useState(childIdFromQuery);
  const [progress, setProgress] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState({});
  const [categoryFilter, setCategoryFilter] = useState("");
  const [stage, setStage] = useState("all");
  const [query, setQuery] = useState("");
  const [noteForm, setNoteForm] = useState({});
  const [savingNote, setSavingNote] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError("");
      try {
        const kids = await apiJson("/api/v1/children");
        const kidsArr = Array.isArray(kids) ? kids : [];
        setChildren(kidsArr);
        setSelectedChildId((prev) => prev || childIdFromQuery || kidsArr[0]?.id || "");
      } catch (e) {
        setError(e.message || "Failed to load children");
      } finally {
        setLoading(false);
      }
    })();
  }, [childIdFromQuery]);

  useEffect(() => {
    if (!selectedChildId) {
      setProgress([]);
      return;
    }

    (async () => {
      setLoading(true);
      setError("");
      try {
        const rows = await apiJson(`/api/v1/progress?childId=${encodeURIComponent(selectedChildId)}`);
        setProgress(Array.isArray(rows) ? rows : []);
      } catch (e) {
        setError(e.message || "Failed to load progress");
      } finally {
        setLoading(false);
      }
    })();
  }, [selectedChildId]);

  const selectedChild = useMemo(
    () => children.find((child) => child.id === selectedChildId) || null,
    [children, selectedChildId],
  );

  const categories = useMemo(() => {
    const set = new Set();
    for (const row of progress) {
      const name = row.lesson?.category?.name;
      if (name) set.add(name);
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [progress]);

  const filteredProgress = useMemo(() => {
    const q = String(query || "").trim().toLowerCase();
    let rows = progress.slice().sort((a, b) => {
      const newer = new Date(b.updatedAt || b.createdAt || 0).getTime();
      const older = new Date(a.updatedAt || a.createdAt || 0).getTime();
      return newer - older;
    });

    if (stage === "completed") {
      rows = rows.filter((row) => row.status === "COMPLETED" || row.status === "PASSED");
    } else if (stage === "failed") {
      rows = rows.filter((row) => row.status === "FAILED");
    } else if (stage === "active") {
      rows = rows.filter((row) => row.status !== "COMPLETED" && row.status !== "PASSED");
    }

    if (categoryFilter) {
      rows = rows.filter((row) => (row.lesson?.category?.name || "") === categoryFilter);
    }

    if (!q) return rows;

    return rows.filter((row) => {
      const haystack = [
        row.lesson?.title,
        row.lesson?.description,
        row.lesson?.category?.name,
        row.status,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [progress, stage, categoryFilter, query]);

  const stats = useMemo(() => {
    const total = progress.length;
    const completed = progress.filter((row) => row.status === "PASSED" || row.status === "COMPLETED").length;
    const failed = progress.filter((row) => row.status === "FAILED").length;
    const inProgress = progress.filter((row) => row.status === "IN_PROGRESS").length;
    const notStarted = progress.filter((row) => row.status === "NOT_STARTED").length;
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { total, completed, failed, inProgress, notStarted, completionRate };
  }, [progress]);

  async function submitNote(progressId) {
    const notes = noteForm[progressId];
    if (!notes?.trim()) return;

    setSavingNote(progressId);
    setError("");

    try {
      await apiJson(`/api/v1/progress/${encodeURIComponent(progressId)}/entries`, {
        method: "POST",
        body: JSON.stringify({ status: "IN_PROGRESS", notes }),
      });
      const refreshed = await apiJson(`/api/v1/progress?childId=${encodeURIComponent(selectedChildId)}`);
      setProgress(Array.isArray(refreshed) ? refreshed : []);
      setNoteForm((prev) => ({ ...prev, [progressId]: "" }));
      setExpanded((prev) => ({ ...prev, [progressId]: Date.now() }));
    } catch (e) {
      setError(e.message || "Failed to add note");
    } finally {
      setSavingNote("");
    }
  }

  return (
    <ParentLayout title="Progress & Goals">
      <div className="space-y-5">
        <div className="relative overflow-hidden rounded-2xl border border-gray-200 bg-gradient-to-br from-violet-50 via-white to-indigo-50 p-6">
          <div className="absolute -right-8 -top-8 h-36 w-36 rounded-full bg-violet-100/40 blur-2xl" />
          <div className="absolute -bottom-10 -left-10 h-28 w-28 rounded-full bg-indigo-100/40 blur-2xl" />
          <div className="relative">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-600 shadow-lg shadow-violet-200">
                <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <div>
                <h1 className="text-xl font-extrabold text-gray-900">Progression Tracking</h1>
                <p className="text-sm text-gray-500">Review goals, monitor status changes, and add notes for teacher coordination.</p>
              </div>
            </div>

            {error && (
              <div className="mt-4 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                <svg className="h-4 w-4 shrink-0 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                {error}
              </div>
            )}

            <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
              <FilterSelect
                label="Child"
                value={selectedChildId}
                onChange={setSelectedChildId}
                disabled={loading}
                placeholder="Select a child..."
                icon={<svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>}
              >
                {children.slice().sort((a, b) => byString(a.firstName, b.firstName)).map((child) => (
                  <option key={child.id} value={child.id}>
                    {child.firstName} {child.lastName || ""}
                  </option>
                ))}
              </FilterSelect>

              <FilterSelect
                label="Category"
                value={categoryFilter}
                onChange={setCategoryFilter}
                disabled={!selectedChildId || loading}
                placeholder="All categories"
                icon={<svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg>}
              >
                {categories.map((category) => <option key={category} value={category}>{category}</option>)}
              </FilterSelect>

              <div className="md:col-span-2">
                <div className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-400">Search</div>
                <div className="relative">
                  <svg className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-10 pr-4 text-sm font-medium text-gray-800 shadow-sm transition hover:border-violet-300 focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100"
                    placeholder="Search lesson title, category, status..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    disabled={!selectedChildId || loading}
                  />
                </div>
              </div>
            </div>

            <div className="mt-3">
              <div className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-400">Stage</div>
              <div className="flex flex-wrap gap-1 rounded-xl border border-gray-200 bg-gray-100/80 p-1">
                {STAGE_FILTERS.map((item) => {
                  const Icon = item.icon;
                  const active = stage === item.value;
                  return (
                    <button
                      key={item.value}
                      type="button"
                      className={`flex items-center justify-center gap-1 rounded-lg px-3 py-1.5 text-[11px] font-bold transition-all ${active ? "bg-white text-violet-700 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
                      onClick={() => setStage(item.value)}
                    >
                      <Icon />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {selectedChild && (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
            <OverviewCard label="Total Goals" count={stats.total} color="violet" icon={<svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>} sub={`${selectedChild.firstName} ${selectedChild.lastName || ""}`.trim()} />
            <OverviewCard label="In Progress" count={stats.inProgress} color="amber" icon={<svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>} />
            <OverviewCard label="Completed" count={stats.completed} color="emerald" icon={<svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>} />
            <OverviewCard label="Failed" count={stats.failed} color="red" icon={<svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>} />
            <OverviewCard label="Not Started" count={stats.notStarted} color="gray" icon={<svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>} />
            <OverviewCard label="Completion" count={`${stats.completionRate}%`} color="sky" icon={<svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>} />
          </div>
        )}

        {selectedChild && stats.total > 0 && (
          <div className="rounded-2xl border border-gray-200 bg-white p-5">
            <div className="mb-3 flex items-center justify-between text-xs font-bold uppercase tracking-wider text-gray-400">
              <span>Overall Progress</span>
              <span>{stats.completed} / {stats.total} goals</span>
            </div>
            <div className="flex h-4 overflow-hidden rounded-full bg-gray-100">
              {stats.completed > 0 && <div className="bg-emerald-400 transition-all" style={{ width: `${(stats.completed / stats.total) * 100}%` }} />}
              {stats.inProgress > 0 && <div className="bg-amber-400 transition-all" style={{ width: `${(stats.inProgress / stats.total) * 100}%` }} />}
              {stats.failed > 0 && <div className="bg-red-400 transition-all" style={{ width: `${(stats.failed / stats.total) * 100}%` }} />}
            </div>
            <div className="mt-2 flex flex-wrap gap-4 text-xs">
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-emerald-400" /> Completed ({stats.completed})</span>
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-amber-400" /> In Progress ({stats.inProgress})</span>
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-red-400" /> Failed ({stats.failed})</span>
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-gray-200" /> Not Started ({stats.notStarted})</span>
            </div>
          </div>
        )}

        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
            <h2 className="flex items-center gap-2 text-sm font-extrabold text-gray-900">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-violet-100 text-violet-600">
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                </svg>
              </span>
              {selectedChild ? `${selectedChild.firstName}'s Progress` : "Progress List"}
              {!loading && selectedChild && <span className="ml-1 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-500">{filteredProgress.length}</span>}
            </h2>
            {loading && (
              <span className="flex items-center gap-1.5 text-xs text-gray-500">
                <svg className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                Loading...
              </span>
            )}
          </div>

          <div className="p-5">
            {!selectedChild && !loading ? (
              <EmptyState
                icon={<svg className="h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>}
                title="Select a child to view progress"
                description="Choose a child from the filter above to review lessons, statuses, and notes."
              />
            ) : !loading && filteredProgress.length === 0 ? (
              <EmptyState
                icon={<svg className="h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>}
                title="No goals match this view"
                description="Try changing the child, stage, category, or search filters."
              />
            ) : (
              <div className="space-y-3">
                {filteredProgress.map((row) => {
                  const isExpanded = expanded[row.id];
                  const isFailed = row.status === "FAILED";
                  const goals = Array.isArray(row.lesson?.goals) ? row.lesson.goals : [];
                  const totalGoals = goals.length;
                  const currentGoal = goals.find((goal) => Number(goal.goalIndex || 0) === Number(row.goalIndex || 0));
                  const lastUpdate = row.updatedAt || row.createdAt;

                  return (
                    <div key={row.id} className={`rounded-2xl border p-4 transition hover:shadow-sm ${isFailed ? "border-red-200 bg-red-50/30" : "border-gray-200 bg-white hover:border-gray-300"}`}>
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2.5">
                            <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xs font-bold text-white ${isFailed ? "bg-red-500" : row.status === "COMPLETED" || row.status === "PASSED" ? "bg-emerald-500" : "bg-violet-500"}`}>
                              {row.goalIndex || "--"}
                            </div>
                            <div className="min-w-0">
                              <div className="font-semibold text-gray-900">{row.lesson?.title || "Unknown Lesson"}</div>
                              <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                                {row.lesson?.category?.name && (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-semibold text-sky-700">
                                    <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg>
                                    {row.lesson.category.name}
                                  </span>
                                )}
                                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_BADGE[row.status] || STATUS_BADGE.NOT_STARTED}`}>
                                  {STATUS_LABEL[row.status] || row.status}
                                </span>
                                <span className="text-[10px] text-gray-400">{formatDate(lastUpdate)}</span>
                              </div>
                            </div>
                          </div>

                          {totalGoals > 0 && (
                            <div className="mt-3 flex items-center gap-2">
                              <div className="flex flex-1 gap-0.5">
                                {Array.from({ length: totalGoals }, (_, index) => {
                                  const stepIndex = index + 1;
                                  const isComplete = stepIndex < Number(row.goalIndex || 0);
                                  const isCurrent = stepIndex === Number(row.goalIndex || 0);
                                  return (
                                    <div
                                      key={stepIndex}
                                      className={`h-1.5 flex-1 rounded-full ${isComplete ? "bg-emerald-400" : isCurrent ? isFailed ? "bg-red-400" : "bg-amber-400" : "bg-gray-200"}`}
                                      title={`Step ${stepIndex}`}
                                    />
                                  );
                                })}
                              </div>
                              <span className="shrink-0 text-[10px] font-bold text-gray-500">{row.goalIndex || 0}/{totalGoals}</span>
                            </div>
                          )}

                          {currentGoal?.title && (
                            <div className="mt-2 rounded-xl bg-gray-50 px-3 py-2 text-xs text-gray-600">
                              <span className="font-semibold text-gray-700">Current:</span> {currentGoal.title}
                            </div>
                          )}
                        </div>

                        <div className="flex shrink-0 flex-col items-start gap-2 lg:w-40 lg:items-end">
                          <button
                            type="button"
                            className="inline-flex items-center gap-1 rounded-xl bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-violet-700 active:scale-[0.98]"
                            onClick={() => setExpanded((prev) => ({ ...prev, [row.id]: prev[row.id] ? null : Date.now() }))}
                          >
                            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                            {isExpanded ? "Hide Details" : "View Details"}
                          </button>
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="mt-4 space-y-3 border-t border-gray-100 pt-4">
                          <ProgressEntryTimeline key={isExpanded} progressId={row.id} />

                          <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                            <div className="mb-1 text-xs font-semibold text-gray-500">Add a Note</div>
                            <div className="flex flex-col gap-2 sm:flex-row">
                              <input
                                type="text"
                                className="flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm transition focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100"
                                placeholder="Share a note with the teacher..."
                                value={noteForm[row.id] || ""}
                                onChange={(e) => setNoteForm((prev) => ({ ...prev, [row.id]: e.target.value }))}
                                disabled={savingNote === row.id}
                              />
                              <button
                                type="button"
                                className="shrink-0 rounded-lg bg-violet-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-violet-700 disabled:opacity-60"
                                onClick={() => submitNote(row.id)}
                                disabled={savingNote === row.id || !(noteForm[row.id] || "").trim()}
                              >
                                {savingNote === row.id ? "Sending..." : "Send"}
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </ParentLayout>
  );
}

function FilterSelect({ label, value, onChange, disabled, placeholder, icon, children }) {
  return (
    <div>
      <div className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-400">{label}</div>
      <div className="relative">
        <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">{icon}</div>
        <select
          className="w-full appearance-none rounded-xl border border-gray-200 bg-white py-2.5 pl-9 pr-10 text-sm font-medium text-gray-800 shadow-sm transition hover:border-violet-300 focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100 disabled:opacity-50"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
        >
          <option value="">{placeholder}</option>
          {children}
        </select>
        <svg className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </div>
    </div>
  );
}

function EmptyState({ icon, title, description }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50/50 py-16">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100">{icon}</div>
      <p className="mt-4 text-sm font-semibold text-gray-600">{title}</p>
      <p className="mt-1 max-w-sm text-center text-xs text-gray-400">{description}</p>
    </div>
  );
}

function OverviewCard({ label, count, color, icon, sub }) {
  const colors = {
    violet: "from-violet-50 to-violet-100/50 text-violet-600 border-violet-200/60",
    sky: "from-sky-50 to-sky-100/50 text-sky-600 border-sky-200/60",
    amber: "from-amber-50 to-amber-100/50 text-amber-600 border-amber-200/60",
    emerald: "from-emerald-50 to-emerald-100/50 text-emerald-600 border-emerald-200/60",
    red: "from-red-50 to-red-100/50 text-red-600 border-red-200/60",
    gray: "from-gray-50 to-gray-100/50 text-gray-600 border-gray-200/60",
  };
  const palette = colors[color] || colors.gray;

  return (
    <div className={`rounded-2xl border bg-gradient-to-br p-4 ${palette}`}>
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-widest opacity-60">{label}</div>
          <div className="mt-1 text-2xl font-extrabold">{count}</div>
          {sub && <div className="mt-0.5 text-[10px] opacity-50">{sub}</div>}
        </div>
        <div className="opacity-30">{icon}</div>
      </div>
    </div>
  );
}

function IconActive() {
  return <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>;
}

function IconAll() {
  return <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>;
}

function IconCompleted() {
  return <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>;
}

function IconFailed() {
  return <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>;
}
