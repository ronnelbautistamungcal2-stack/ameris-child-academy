import TeacherLayout from "@/components/teacher/TeacherLayout";
import WeeklyLessonPlanner from "@/components/planning/WeeklyLessonPlanner";
import { apiJson } from "@/lib/api";
import { useEffect, useMemo, useState } from "react";

export default function TeacherChecklists() {
  const [centers, setCenters] = useState([]);
  const [centerId, setCenterId] = useState("");
  const [children, setChildren] = useState([]);
  const [childId, setChildId] = useState("");
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkChildIds, setBulkChildIds] = useState([]);
  const [childSearch, setChildSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("planner"); // planner | tasks

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
        setBulkMode(false);
        setBulkChildIds([]);
        setChildSearch("");
        return;
      }
      setLoading(true);
      setError("");
      try {
        const kids = await apiJson(`/api/v1/children?centerId=${encodeURIComponent(centerId)}`);
        const arr = Array.isArray(kids) ? kids : [];
        setChildren(arr);
        setChildId("");
        setBulkMode(false);
        setBulkChildIds([]);
        setChildSearch("");
      } catch (e) {
        setError(e.message || "Failed to load children");
        setChildren([]);
        setChildId("");
        setBulkMode(false);
        setBulkChildIds([]);
        setChildSearch("");
      } finally {
        setLoading(false);
      }
    })();
  }, [centerId]);

  const filteredChildren = children
    .slice()
    .sort((a, b) =>
      String(a.firstName || "").localeCompare(String(b.firstName || "")),
    )
    .filter((ch) => {
      const q = String(childSearch || "").trim().toLowerCase();
      if (!q) return true;
      const name = `${ch.firstName || ""} ${ch.lastName || ""}`.trim().toLowerCase();
      return name.includes(q);
    });

  function toggleBulkChild(id, next) {
    setBulkChildIds((cur) => {
      const set = new Set(cur);
      if (next) set.add(id);
      else set.delete(id);
      return [...set];
    });
  }

  function setAllBulk(next) {
    if (!next) {
      setBulkChildIds([]);
      return;
    }
    setBulkChildIds(filteredChildren.map((c) => c.id));
  }

  return (
    <TeacherLayout title="Checklists">
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <h2 className="text-base font-extrabold text-gray-900">Checklists</h2>
        <p className="mt-0.5 text-xs text-gray-600">
          View the weekly lesson plan and track task checklists for children.
        </p>

        {error ? (
          <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {error}
          </div>
        ) : null}

        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
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
              <option value="">Select a center...</option>
              {centers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>

          {tab === "planner" && (
            <label className="block">
              <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
                Child (optional)
              </div>
              <select
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                value={childId}
                onChange={(e) => setChildId(e.target.value)}
                disabled={!centerId || loading}
              >
                <option value="">(view only)</option>
                {children
                  .slice()
                  .sort((a, b) =>
                    String(a.firstName || "").localeCompare(String(b.firstName || "")),
                  )
                  .map((ch) => (
                    <option key={ch.id} value={ch.id}>
                      {ch.firstName} {ch.lastName || ""}
                    </option>
                  ))}
              </select>
            </label>
          )}
        </div>

        <div className="mt-4 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setTab("planner")}
            className={[
              "rounded-xl px-3 py-2 text-sm font-extrabold",
              tab === "planner"
                ? "bg-sky-100 text-sky-900"
                : "border border-gray-200 bg-white text-gray-800 hover:bg-gray-50",
            ].join(" ")}
          >
            Weekly Planner
          </button>
          <button
            type="button"
            onClick={() => setTab("tasks")}
            className={[
              "rounded-xl px-3 py-2 text-sm font-extrabold",
              tab === "tasks"
                ? "bg-sky-100 text-sky-900"
                : "border border-gray-200 bg-white text-gray-800 hover:bg-gray-50",
            ].join(" ")}
          >
            Task Checklists
          </button>
        </div>

        {tab === "planner" && (
          <div className="mt-3 rounded-xl border border-gray-200 bg-gray-50 p-3">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Bulk Update
                </div>
                <div className="mt-0.5 text-xs text-gray-600">
                  Select multiple children, then click a lesson and use &quot;Bulk mark&quot; in the lesson guidance panel.
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                <input
                  type="checkbox"
                  checked={bulkMode}
                  onChange={(e) => {
                    const next = e.target.checked;
                    setBulkMode(next);
                    if (!next) setBulkChildIds([]);
                  }}
                  disabled={!centerId || loading}
                />
                Enable
              </label>
            </div>

            {bulkMode ? (
              <div className="mt-3">
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <input
                    value={childSearch}
                    onChange={(e) => setChildSearch(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm md:max-w-sm"
                    placeholder="Search children..."
                  />
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-100"
                      onClick={() => setAllBulk(true)}
                      disabled={!filteredChildren.length}
                    >
                      Select all
                    </button>
                    <button
                      type="button"
                      className="rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-100"
                      onClick={() => setAllBulk(false)}
                      disabled={!bulkChildIds.length}
                    >
                      Clear
                    </button>
                    <div className="text-xs font-semibold text-gray-600">
                      {bulkChildIds.length} selected
                    </div>
                  </div>
                </div>

                <div className="mt-3 max-h-56 overflow-y-auto rounded-xl border border-gray-200 bg-white">
                  {filteredChildren.length ? (
                    <ul className="divide-y divide-gray-100">
                      {filteredChildren.map((ch) => {
                        const checked = bulkChildIds.includes(ch.id);
                        const name = `${ch.firstName || ""} ${ch.lastName || ""}`.trim();
                        return (
                          <li key={ch.id} className="flex items-center justify-between gap-3 px-3 py-2">
                            <div className="min-w-0">
                              <div className="truncate text-sm font-semibold text-gray-900">
                                {name || "Child"}
                              </div>
                            </div>
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) => toggleBulkChild(ch.id, e.target.checked)}
                            />
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <div className="p-3 text-sm text-gray-600">
                      No children match the search.
                    </div>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        )}
      </div>

      <div className="mt-4">
        {!centerId ? (
          <div className="rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-600">
            Select a center to view checklists.
          </div>
        ) : tab === "planner" ? (
          <WeeklyLessonPlanner
            centerId={centerId}
            mode="teacher"
            childId={childId}
            bulkChildIds={bulkMode ? bulkChildIds : []}
          />
        ) : (
          <TaskChecklistTracker centerId={centerId} children={children} />
        )}
      </div>
    </TeacherLayout>
  );
}

/* -- Task Checklist Tracker (teacher view) -- */

function TaskChecklistTracker({ centerId, children }) {
  const [checklists, setChecklists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [trackingChildId, setTrackingChildId] = useState("");
  const [childCompletions, setChildCompletions] = useState([]);
  const [completionLoading, setCompletionLoading] = useState(false);

  const [expandedId, setExpandedId] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError("");
      try {
        const lists = await apiJson(`/api/v1/checklists?centerId=${encodeURIComponent(centerId)}`);
        setChecklists(Array.isArray(lists) ? lists : []);
      } catch (e) {
        setError(e.message || "Failed to load checklists");
      } finally {
        setLoading(false);
      }
    })();
    setExpandedId("");
    setTrackingChildId("");
    setChildCompletions([]);
  }, [centerId]);

  async function loadChildCompletions(cId) {
    if (!cId) {
      setChildCompletions([]);
      return;
    }
    setCompletionLoading(true);
    try {
      const completed = await apiJson(`/api/v1/child-tasks?childId=${encodeURIComponent(cId)}`);
      setChildCompletions(Array.isArray(completed) ? completed : []);
    } catch {
      setChildCompletions([]);
    } finally {
      setCompletionLoading(false);
    }
  }

  useEffect(() => {
    loadChildCompletions(trackingChildId);
  }, [trackingChildId]);

  const completionByTaskId = useMemo(() => {
    const map = new Map();
    for (const c of childCompletions) {
      map.set(c.taskId, c);
    }
    return map;
  }, [childCompletions]);

  async function toggleTaskCompletion(taskId, isCompleted) {
    if (!trackingChildId) return;
    try {
      await apiJson("/api/v1/child-tasks", {
        method: "POST",
        body: JSON.stringify({
          childId: trackingChildId,
          taskId,
          completed: !isCompleted,
        }),
      });
      await loadChildCompletions(trackingChildId);
    } catch (e) {
      setError(e.message || "Failed to update task");
    }
  }

  const sortedChildren = useMemo(() => {
    return (children || []).slice().sort((a, b) => (a.firstName || "").localeCompare(b.firstName || ""));
  }, [children]);

  return (
    <div className="space-y-4">
      {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>}

      {/* Child selector */}
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <div className="flex flex-wrap items-end gap-3">
          <label className="block flex-1">
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">Select Child to Track</div>
            <select
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              value={trackingChildId}
              onChange={(e) => setTrackingChildId(e.target.value)}
            >
              <option value="">Select a child...</option>
              {sortedChildren.map((ch) => (
                <option key={ch.id} value={ch.id}>
                  {ch.firstName} {ch.lastName || ""}
                </option>
              ))}
            </select>
          </label>
          {trackingChildId && (
            <div className="text-xs text-gray-500">
              {completionLoading ? "Loading..." : `${childCompletions.filter((c) => c.completedAt).length} tasks completed`}
            </div>
          )}
        </div>
        {!trackingChildId && (
          <p className="mt-2 text-xs text-gray-500">
            Select a child to check off tasks they have completed (e.g. &quot;washing hands&quot;).
          </p>
        )}
      </div>

      {/* Checklists */}
      {loading ? (
        <div className="rounded-xl border border-gray-200 bg-white p-6 text-sm text-gray-500">Loading...</div>
      ) : checklists.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-6 text-sm text-gray-500">
          No task checklists available. Ask an admin to create checklists for this center.
        </div>
      ) : (
        <div className="space-y-3">
          {checklists.map((cl) => {
            const isExpanded = expandedId === cl.id;
            const tasks = cl.tasks || [];
            const completedCount = trackingChildId
              ? tasks.filter((t) => completionByTaskId.get(t.id)?.completedAt).length
              : 0;

            return (
              <div key={cl.id} className="rounded-xl border border-gray-200 bg-white">
                <button
                  type="button"
                  onClick={() => setExpandedId(isExpanded ? "" : cl.id)}
                  className="flex w-full items-center justify-between gap-3 p-4 text-left hover:bg-gray-50"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <div className="font-semibold text-gray-900">{cl.title}</div>
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-600">
                        {tasks.length} tasks
                      </span>
                      {trackingChildId && tasks.length > 0 && (
                        <span className={[
                          "rounded-full px-2 py-0.5 text-xs font-semibold",
                          completedCount === tasks.length
                            ? "bg-emerald-100 text-emerald-800"
                            : completedCount > 0
                              ? "bg-amber-100 text-amber-800"
                              : "bg-gray-100 text-gray-600",
                        ].join(" ")}>
                          {completedCount}/{tasks.length} done
                        </span>
                      )}
                    </div>
                    {cl.description && <div className="mt-0.5 text-xs text-gray-500">{cl.description}</div>}
                  </div>
                  <svg
                    viewBox="0 0 24 24"
                    className={`h-5 w-5 shrink-0 text-gray-400 transition ${isExpanded ? "rotate-180" : ""}`}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {isExpanded && (
                  <div className="border-t border-gray-200 p-4">
                    {tasks.length === 0 ? (
                      <div className="text-sm text-gray-500">No tasks in this checklist.</div>
                    ) : !trackingChildId ? (
                      <div className="space-y-2">
                        {tasks.map((task) => (
                          <div key={task.id} className="flex items-start gap-3 rounded-lg border border-gray-200 p-3">
                            <div className="min-w-0 flex-1">
                              <div className="text-sm font-semibold text-gray-900">{task.title}</div>
                              <div className="mt-1 flex flex-wrap gap-2">
                                {task.policyLink && (
                                  <a href={task.policyLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700 hover:bg-blue-100">
                                    Policy / Procedure
                                  </a>
                                )}
                                {task.mediaLink && (
                                  <a href={task.mediaLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-md border border-violet-200 bg-violet-50 px-2 py-0.5 text-[11px] font-semibold text-violet-700 hover:bg-violet-100">
                                    Training Video
                                  </a>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                        <div className="mt-1 text-xs text-gray-500">Select a child above to track task completion.</div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {tasks.map((task) => {
                          const completion = completionByTaskId.get(task.id);
                          const isDone = !!completion?.completedAt;
                          return (
                            <div
                              key={task.id}
                              className={[
                                "flex items-start gap-3 rounded-lg border p-3",
                                isDone ? "border-emerald-200 bg-emerald-50/30" : "border-gray-200",
                              ].join(" ")}
                            >
                              <input
                                type="checkbox"
                                checked={isDone}
                                onChange={() => toggleTaskCompletion(task.id, isDone)}
                                className="mt-0.5 h-4 w-4 shrink-0 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                              />
                              <div className="min-w-0 flex-1">
                                <div className={["text-sm font-semibold", isDone ? "text-emerald-800 line-through" : "text-gray-900"].join(" ")}>
                                  {task.title}
                                </div>
                                <div className="mt-1 flex flex-wrap gap-2">
                                  {task.policyLink && (
                                    <a href={task.policyLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700 hover:bg-blue-100">
                                      Policy / Procedure
                                    </a>
                                  )}
                                  {task.mediaLink && (
                                    <a href={task.mediaLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-md border border-violet-200 bg-violet-50 px-2 py-0.5 text-[11px] font-semibold text-violet-700 hover:bg-violet-100">
                                      Training Video
                                    </a>
                                  )}
                                </div>
                                {isDone && completion?.completedAt && (
                                  <div className="mt-1 text-[11px] text-emerald-600">
                                    Completed {new Date(completion.completedAt).toLocaleDateString()}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
