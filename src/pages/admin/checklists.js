import AdminLayout from "@/components/admin/AdminLayout";
import Skeleton from "@/components/ui/Skeleton";
import WeeklyLessonPlanner from "@/components/planning/WeeklyLessonPlanner";
import { apiJson } from "@/lib/api";
import { useEffect, useMemo, useState } from "react";

export default function AdminChecklists() {
  const [centers, setCenters] = useState([]);
  const [centerId, setCenterId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("planner"); // planner | tasks | daily

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

  return (
    <AdminLayout title="Checklists">
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <h2 className="text-base font-extrabold text-gray-900">Checklists</h2>
        <p className="mt-0.5 text-xs text-gray-600">
          Manage weekly lesson plans and task checklists linked to policies, procedures, and training videos.
        </p>

        {error ? (
          <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {error}
          </div>
        ) : null}

        <div className="mt-3 max-w-xl">
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
          <button
            type="button"
            onClick={() => setTab("daily")}
            className={[
              "rounded-xl px-3 py-2 text-sm font-extrabold",
              tab === "daily"
                ? "bg-sky-100 text-sky-900"
                : "border border-gray-200 bg-white text-gray-800 hover:bg-gray-50",
            ].join(" ")}
          >
            Daily Operations
          </button>
        </div>
      </div>

      <div className="mt-4">
        {!centerId ? (
          <div className="rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-600">
            Select a center to start.
          </div>
        ) : tab === "planner" ? (
          <WeeklyLessonPlanner centerId={centerId} mode="admin" />
        ) : tab === "daily" ? (
          <DailyChecklistManager centerId={centerId} />
        ) : (
          <TaskChecklistManager centerId={centerId} />
        )}
      </div>
    </AdminLayout>
  );
}

/* -- Task Checklist Manager (admin CRUD) -- */

function TaskChecklistManager({ centerId }) {
  const [checklists, setChecklists] = useState([]);
  const [children, setChildren] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Create form
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newTasks, setNewTasks] = useState([{ title: "", policyLink: "", mediaLink: "" }]);
  const [saving, setSaving] = useState(false);

  // Expand to view per-child tracking
  const [expandedId, setExpandedId] = useState("");
  const [trackingChildId, setTrackingChildId] = useState("");
  const [childCompletions, setChildCompletions] = useState([]);
  const [completionLoading, setCompletionLoading] = useState(false);

  async function loadData() {
    setLoading(true);
    setError("");
    try {
      const [lists, kids] = await Promise.all([
        apiJson(`/api/v1/checklists?centerId=${encodeURIComponent(centerId)}`),
        apiJson(`/api/v1/children?centerId=${encodeURIComponent(centerId)}`),
      ]);
      setChecklists(Array.isArray(lists) ? lists : []);
      setChildren(Array.isArray(kids) ? kids : []);
    } catch (e) {
      setError(e.message || "Failed to load checklists");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
    setExpandedId("");
    setTrackingChildId("");
    setChildCompletions([]);
    setShowCreate(false);
    setSuccess("");
  }, [centerId]);

  async function createChecklist(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      await apiJson("/api/v1/checklists", {
        method: "POST",
        body: JSON.stringify({
          title: newTitle,
          description: newDescription || null,
          centerId,
          tasks: newTasks.filter((t) => t.title.trim()),
        }),
      });
      setNewTitle("");
      setNewDescription("");
      setNewTasks([{ title: "", policyLink: "", mediaLink: "" }]);
      setShowCreate(false);
      setSuccess("Checklist created.");
      await loadData();
    } catch (e2) {
      setError(e2.message || "Failed to create checklist");
    } finally {
      setSaving(false);
    }
  }

  async function deleteChecklist(id) {
    if (!confirm("Delete this checklist and all its tasks? This cannot be undone.")) return;
    setError("");
    try {
      await apiJson(`/api/v1/checklists/${encodeURIComponent(id)}`, { method: "DELETE" });
      if (expandedId === id) setExpandedId("");
      await loadData();
    } catch (e) {
      setError(e.message || "Failed to delete checklist");
    }
  }

  async function loadChildCompletions(childId) {
    if (!childId) {
      setChildCompletions([]);
      return;
    }
    setCompletionLoading(true);
    try {
      const completed = await apiJson(`/api/v1/child-tasks?childId=${encodeURIComponent(childId)}`);
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

  function addTaskRow() {
    setNewTasks((prev) => [...prev, { title: "", policyLink: "", mediaLink: "" }]);
  }

  function removeTaskRow(index) {
    setNewTasks((prev) => prev.filter((_, i) => i !== index));
  }

  function updateTaskRow(index, field, value) {
    setNewTasks((prev) => prev.map((t, i) => (i === index ? { ...t, [field]: value } : t)));
  }

  const sortedChildren = useMemo(() => {
    return children.slice().sort((a, b) => (a.firstName || "").localeCompare(b.firstName || ""));
  }, [children]);

  return (
    <div className="space-y-4">
      {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>}
      {success && <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{success}</div>}

      {/* Create button / form */}
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        {!showCreate ? (
          <button
            type="button"
            onClick={() => { setShowCreate(true); setSuccess(""); }}
            className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700"
          >
            Create New Checklist
          </button>
        ) : (
          <form onSubmit={createChecklist} className="space-y-3">
            <h3 className="text-sm font-extrabold text-gray-900">New Task Checklist</h3>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <label className="block">
                <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">Title</div>
                <input
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  required
                  placeholder="e.g. Daily Hygiene Checklist"
                />
              </label>
              <label className="block">
                <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">Description (optional)</div>
                <input
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="Brief description"
                />
              </label>
            </div>

            <div>
              <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">Tasks</div>
              <div className="space-y-2">
                {newTasks.map((t, i) => (
                  <div key={i} className="grid grid-cols-1 gap-2 rounded-lg border border-gray-200 bg-gray-50 p-3 md:grid-cols-4">
                    <input
                      className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
                      value={t.title}
                      onChange={(e) => updateTaskRow(i, "title", e.target.value)}
                      placeholder="Task name (e.g. Washing hands)"
                    />
                    <input
                      className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
                      value={t.policyLink}
                      onChange={(e) => updateTaskRow(i, "policyLink", e.target.value)}
                      placeholder="Policy/procedure URL (optional)"
                    />
                    <input
                      className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
                      value={t.mediaLink}
                      onChange={(e) => updateTaskRow(i, "mediaLink", e.target.value)}
                      placeholder="Training video URL (optional)"
                    />
                    <button
                      type="button"
                      onClick={() => removeTaskRow(i)}
                      disabled={newTasks.length <= 1}
                      className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-40"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={addTaskRow}
                className="mt-2 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
              >
                + Add task
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="submit"
                disabled={saving || !newTitle.trim()}
                className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {saving ? "Saving..." : "Create Checklist"}
              </button>
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Child tracking selector */}
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <div className="flex flex-wrap items-end gap-3">
          <label className="block flex-1">
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">Track Completion for Child</div>
            <select
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              value={trackingChildId}
              onChange={(e) => setTrackingChildId(e.target.value)}
            >
              <option value="">Select a child to track...</option>
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
      </div>

      {/* Checklists list */}
      {loading ? (
        <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800"><Skeleton count={5} /></div>
      ) : checklists.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-6 text-sm text-gray-500">
          No task checklists created yet. Click &quot;Create New Checklist&quot; to get started.
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
                <div className="flex items-center justify-between gap-3 p-4">
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
                            : "bg-amber-100 text-amber-800",
                        ].join(" ")}>
                          {completedCount}/{tasks.length} done
                        </span>
                      )}
                    </div>
                    {cl.description && <div className="mt-0.5 text-xs text-gray-500">{cl.description}</div>}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setExpandedId(isExpanded ? "" : cl.id)}
                      className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                    >
                      {isExpanded ? "Collapse" : "View Tasks"}
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteChecklist(cl.id)}
                      className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50"
                    >
                      Delete
                    </button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-gray-200 p-4">
                    {tasks.length === 0 ? (
                      <div className="text-sm text-gray-500">No tasks in this checklist.</div>
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
                              {trackingChildId && (
                                <input
                                  type="checkbox"
                                  checked={isDone}
                                  onChange={() => toggleTaskCompletion(task.id, isDone)}
                                  className="mt-0.5 h-4 w-4 shrink-0 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                                />
                              )}
                              <div className="min-w-0 flex-1">
                                <div className={["text-sm font-semibold", isDone ? "text-emerald-800 line-through" : "text-gray-900"].join(" ")}>
                                  {task.title}
                                </div>
                                <div className="mt-1 flex flex-wrap gap-2">
                                  {task.policyLink && (
                                    <a
                                      href={task.policyLink}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700 hover:bg-blue-100"
                                    >
                                      Policy / Procedure
                                    </a>
                                  )}
                                  {task.mediaLink && (
                                    <a
                                      href={task.mediaLink}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-1 rounded-md border border-violet-200 bg-violet-50 px-2 py-0.5 text-[11px] font-semibold text-violet-700 hover:bg-violet-100"
                                    >
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

/* -- Daily Operations Checklist Manager (admin CRUD) -- */

const CATEGORY_OPTIONS = [
  { value: "OPENING", label: "Opening" },
  { value: "CLOSING", label: "Closing" },
  { value: "HEALTH_SAFETY", label: "Health & Safety" },
  { value: "CLEANING", label: "Cleaning" },
  { value: "MEALS", label: "Meals" },
  { value: "CLASSROOM", label: "Classroom" },
  { value: "OTHER", label: "Other" },
];

const FREQUENCY_OPTIONS = [
  { value: "DAILY", label: "Daily" },
  { value: "WEEKLY", label: "Weekly" },
  { value: "MONTHLY", label: "Monthly" },
];

const CAT_COLORS = {
  OPENING: "border-l-amber-400",
  CLOSING: "border-l-indigo-400",
  HEALTH_SAFETY: "border-l-red-400",
  CLEANING: "border-l-emerald-400",
  MEALS: "border-l-orange-400",
  CLASSROOM: "border-l-sky-400",
  OTHER: "border-l-gray-400",
};

function DailyChecklistManager({ centerId }) {
  const [checklists, setChecklists] = useState([]);
  const [classrooms, setClassrooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Create form
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newCategory, setNewCategory] = useState("OTHER");
  const [newFrequency, setNewFrequency] = useState("DAILY");
  const [newClassRoomId, setNewClassRoomId] = useState("");
  const [newItems, setNewItems] = useState([{ title: "", description: "", policyLink: "", mediaLink: "" }]);
  const [saving, setSaving] = useState(false);

  // Edit state
  const [editingId, setEditingId] = useState("");
  const [expandedId, setExpandedId] = useState("");

  async function loadData() {
    setLoading(true);
    setError("");
    try {
      const [lists, rooms] = await Promise.all([
        apiJson(`/api/v1/daily-checklists?centerId=${encodeURIComponent(centerId)}`),
        apiJson(`/api/v1/classes?centerId=${encodeURIComponent(centerId)}`),
      ]);
      setChecklists(Array.isArray(lists) ? lists : []);
      setClassrooms(Array.isArray(rooms) ? rooms : []);
    } catch (e) {
      setError(e.message || "Failed to load checklists");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
    setShowCreate(false);
    setEditingId("");
    setExpandedId("");
    setSuccess("");
  }, [centerId]);

  async function createChecklist(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      await apiJson("/api/v1/daily-checklists", {
        method: "POST",
        body: JSON.stringify({
          title: newTitle,
          description: newDescription || null,
          centerId,
          classRoomId: newClassRoomId || null,
          category: newCategory,
          frequency: newFrequency,
          items: newItems.filter((t) => t.title.trim()),
        }),
      });
      setNewTitle("");
      setNewDescription("");
      setNewCategory("OTHER");
      setNewFrequency("DAILY");
      setNewClassRoomId("");
      setNewItems([{ title: "", description: "", policyLink: "", mediaLink: "" }]);
      setShowCreate(false);
      setSuccess("Checklist created.");
      await loadData();
    } catch (e2) {
      setError(e2.message || "Failed to create checklist");
    } finally {
      setSaving(false);
    }
  }

  async function deleteChecklist(id) {
    if (!confirm("Delete this checklist and all its items? This cannot be undone.")) return;
    setError("");
    try {
      await apiJson("/api/v1/daily-checklists", {
        method: "DELETE",
        body: JSON.stringify({ id }),
      });
      await loadData();
    } catch (e) {
      setError(e.message || "Failed to delete checklist");
    }
  }

  async function toggleActive(id, currentActive) {
    try {
      await apiJson("/api/v1/daily-checklists", {
        method: "PUT",
        body: JSON.stringify({ id, active: !currentActive }),
      });
      await loadData();
    } catch (e) {
      setError(e.message || "Failed to update");
    }
  }

  function addItemRow() {
    setNewItems((prev) => [...prev, { title: "", description: "", policyLink: "", mediaLink: "" }]);
  }

  function removeItemRow(index) {
    setNewItems((prev) => prev.filter((_, i) => i !== index));
  }

  function updateItemRow(index, field, value) {
    setNewItems((prev) => prev.map((t, i) => (i === index ? { ...t, [field]: value } : t)));
  }

  // Group checklists by category
  const grouped = useMemo(() => {
    const map = {};
    for (const cl of checklists) {
      if (!map[cl.category]) map[cl.category] = [];
      map[cl.category].push(cl);
    }
    return map;
  }, [checklists]);

  return (
    <div className="space-y-4">
      {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>}
      {success && <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{success}</div>}

      {/* Create button / form */}
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        {!showCreate ? (
          <button
            type="button"
            onClick={() => { setShowCreate(true); setSuccess(""); }}
            className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700"
          >
            Create Daily Checklist
          </button>
        ) : (
          <form onSubmit={createChecklist} className="space-y-3">
            <h3 className="text-sm font-extrabold text-gray-900">New Daily Operations Checklist</h3>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
              <label className="block">
                <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">Title</div>
                <input
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  required
                  placeholder="e.g. Morning Opening Checklist"
                />
              </label>
              <label className="block">
                <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">Category</div>
                <select
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                >
                  {CATEGORY_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </label>
              <label className="block">
                <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">Frequency</div>
                <select
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                  value={newFrequency}
                  onChange={(e) => setNewFrequency(e.target.value)}
                >
                  {FREQUENCY_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </label>
              <label className="block">
                <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">Classroom (optional)</div>
                <select
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                  value={newClassRoomId}
                  onChange={(e) => setNewClassRoomId(e.target.value)}
                >
                  <option value="">All classrooms</option>
                  {classrooms.map((r) => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
              </label>
              <label className="block md:col-span-2">
                <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">Description (optional)</div>
                <input
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="Brief description"
                />
              </label>
            </div>

            <div>
              <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">Tasks</div>
              <div className="space-y-2">
                {newItems.map((t, i) => (
                  <div key={i} className="grid grid-cols-1 gap-2 rounded-lg border border-gray-200 bg-gray-50 p-3 md:grid-cols-5">
                    <input
                      className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
                      value={t.title}
                      onChange={(e) => updateItemRow(i, "title", e.target.value)}
                      placeholder="Task name"
                    />
                    <input
                      className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
                      value={t.description}
                      onChange={(e) => updateItemRow(i, "description", e.target.value)}
                      placeholder="Description (optional)"
                    />
                    <input
                      className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
                      value={t.policyLink}
                      onChange={(e) => updateItemRow(i, "policyLink", e.target.value)}
                      placeholder="Policy URL (optional)"
                    />
                    <input
                      className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
                      value={t.mediaLink}
                      onChange={(e) => updateItemRow(i, "mediaLink", e.target.value)}
                      placeholder="Video URL (optional)"
                    />
                    <button
                      type="button"
                      onClick={() => removeItemRow(i)}
                      disabled={newItems.length <= 1}
                      className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-40"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={addItemRow}
                className="mt-2 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
              >
                + Add task
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="submit"
                disabled={saving || !newTitle.trim()}
                className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {saving ? "Saving..." : "Create Checklist"}
              </button>
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Checklists list */}
      {loading ? (
        <div className="rounded-xl border border-gray-200 bg-white p-6"><Skeleton count={5} /></div>
      ) : checklists.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-6 text-sm text-gray-500">
          No daily checklists created yet. Click &quot;Create Daily Checklist&quot; to get started.
        </div>
      ) : (
        Object.entries(grouped).map(([category, lists]) => (
          <div key={category} className="space-y-2">
            <h3 className="text-xs font-extrabold uppercase tracking-wide text-gray-500">
              {CATEGORY_OPTIONS.find((o) => o.value === category)?.label || category}
              <span className="ml-2 text-gray-400">({lists.length})</span>
            </h3>
            {lists.map((cl) => {
              const isExpanded = expandedId === cl.id;
              const items = cl.items || [];
              return (
                <div key={cl.id} className={`rounded-xl border-l-4 border border-gray-200 bg-white ${CAT_COLORS[cl.category] || "border-l-gray-400"} ${!cl.active ? "opacity-50" : ""}`}>
                  <div className="flex items-center justify-between gap-3 p-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <div className="font-semibold text-gray-900">{cl.title}</div>
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-600">
                          {items.length} tasks
                        </span>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                          cl.frequency === "DAILY" ? "bg-blue-50 text-blue-700" :
                          cl.frequency === "WEEKLY" ? "bg-purple-50 text-purple-700" :
                          "bg-amber-50 text-amber-700"
                        }`}>
                          {cl.frequency}
                        </span>
                        {cl.classRoom && (
                          <span className="rounded-full bg-sky-50 px-2 py-0.5 text-xs font-semibold text-sky-700">
                            {cl.classRoom.name}
                          </span>
                        )}
                        {!cl.active && (
                          <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700">
                            Inactive
                          </span>
                        )}
                      </div>
                      {cl.description && <div className="mt-0.5 text-xs text-gray-500">{cl.description}</div>}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setExpandedId(isExpanded ? "" : cl.id)}
                        className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                      >
                        {isExpanded ? "Collapse" : "View Tasks"}
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleActive(cl.id, cl.active)}
                        className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                      >
                        {cl.active ? "Deactivate" : "Activate"}
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteChecklist(cl.id)}
                        className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50"
                      >
                        Delete
                      </button>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="border-t border-gray-200 p-4">
                      {items.length === 0 ? (
                        <div className="text-sm text-gray-500">No tasks in this checklist.</div>
                      ) : (
                        <div className="space-y-2">
                          {items.map((item, idx) => (
                            <div key={item.id} className="flex items-start gap-3 rounded-lg border border-gray-200 p-3">
                              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-semibold text-gray-600">
                                {idx + 1}
                              </span>
                              <div className="min-w-0 flex-1">
                                <div className="text-sm font-semibold text-gray-900">{item.title}</div>
                                {item.description && <div className="mt-0.5 text-xs text-gray-500">{item.description}</div>}
                                <div className="mt-1 flex flex-wrap gap-1.5">
                                  {item.policyLink && (
                                    <a href={item.policyLink} target="_blank" rel="noopener noreferrer" className="rounded-md bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700 hover:bg-blue-100">
                                      Policy
                                    </a>
                                  )}
                                  {item.mediaLink && (
                                    <a href={item.mediaLink} target="_blank" rel="noopener noreferrer" className="rounded-md bg-violet-50 px-2 py-0.5 text-[10px] font-semibold text-violet-700 hover:bg-violet-100">
                                      Video
                                    </a>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))
      )}
    </div>
  );
}
