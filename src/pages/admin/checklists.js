import AdminLayout from "@/components/admin/AdminLayout";
import AdminTaskChecklistManager from "@/components/checklists/AdminTaskChecklistManager";
import Skeleton from "@/components/ui/Skeleton";
import WeeklyLessonPlanner from "@/components/planning/WeeklyLessonPlanner";
import { apiJson } from "@/lib/api";
import { useEffect, useMemo, useState, useCallback } from "react";

/* ── Icons (inline SVG) ── */
const IconCalendar = () => (
  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
  </svg>
);
const IconClipboard = () => (
  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15a2.25 2.25 0 012.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
  </svg>
);
const IconCog = () => (
  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17l-5.1 3.04a.75.75 0 01-1.1-.67V4.66a.75.75 0 011.1-.67l5.1 3.04m0 8.14l5.1 3.04a.75.75 0 001.1-.67V4.66a.75.75 0 00-1.1-.67l-5.1 3.04m0 8.14V7.03" />
  </svg>
);
const IconPlus = () => (
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
  </svg>
);
const IconSearch = () => (
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
  </svg>
);
const IconChevronDown = ({ open }) => (
  <svg className={`h-4 w-4 transition-transform duration-200 ${open ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
  </svg>
);
const IconTrash = () => (
  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
  </svg>
);
const IconLink = () => (
  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m9.86-2.54a4.5 4.5 0 00-1.242-7.244l-4.5-4.5a4.5 4.5 0 00-6.364 6.364L4.34 8.627" />
  </svg>
);
const IconPlay = () => (
  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
  </svg>
);
const IconBuilding = () => (
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z" />
  </svg>
);
const IconUser = () => (
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
  </svg>
);

const TAB_CONFIG = [
  { key: "planner", label: "Weekly Planner", icon: IconCalendar, desc: "Plan weekly lessons" },
  { key: "tasks", label: "Task Checklists", icon: IconClipboard, desc: "Per-child task tracking" },
  { key: "daily", label: "Daily Operations", icon: IconCog, desc: "Opening, closing & routines" },
];

function blankTaskRow() {
  return { title: "", policyLink: "", mediaLink: "", taskTime: "" };
}

function blankDailyItemRow() {
  return { title: "", description: "", policyLink: "", mediaLink: "", taskTime: "" };
}

function formatTaskTime(value) {
  if (!value) return "";
  const [hour, minute] = String(value).split(":");
  const date = new Date();
  date.setHours(Number(hour), Number(minute || 0), 0, 0);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function sortByTaskTime(items) {
  return (Array.isArray(items) ? items : []).slice().sort((a, b) => {
    const at = a.taskTime || "99:99";
    const bt = b.taskTime || "99:99";
    if (at !== bt) return at.localeCompare(bt);
    return Number(a.sortOrder || 0) - Number(b.sortOrder || 0);
  });
}

export default function AdminChecklists() {
  const [centers, setCenters] = useState([]);
  const [centerId, setCenterId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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
      {/* ── Page Header ── */}
      <div className="rounded-2xl border border-gray-200 bg-gradient-to-br from-white via-white to-sky-50/40 p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-lg font-extrabold tracking-tight text-gray-900">
              Checklists
            </h1>
            <p className="mt-1 max-w-lg text-sm text-gray-500">
              Build recurring checklists, assign them to classrooms or staff, and link each item to lessons, policies, or direct actions.
            </p>
          </div>

          {/* Center Selector */}
          <div className="flex-shrink-0 sm:min-w-[260px]">
            <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 shadow-sm">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-50 text-sky-600">
                <IconBuilding />
              </div>
              <select
                className="flex-1 border-0 bg-transparent text-sm font-semibold text-gray-900 outline-none focus:ring-0"
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
            </div>
          </div>
        </div>

        {error && (
          <div className="mt-3 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
            <svg className="h-4 w-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
            </svg>
            {error}
          </div>
        )}
      </div>

      {/* ── Content ── */}
      <div className="mt-4">
        {!centerId ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-300 bg-white py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-50 text-sky-400">
              <IconBuilding />
            </div>
            <h3 className="mt-4 text-sm font-bold text-gray-900">No center selected</h3>
            <p className="mt-1 max-w-xs text-xs text-gray-500">
              Choose a center from the dropdown above to view and manage checklists.
            </p>
          </div>
        ) : (
          <AdminTaskChecklistManager centerId={centerId} />
        )}
      </div>
    </AdminLayout>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   Task Checklist Manager (admin CRUD)
   ═══════════════════════════════════════════════════════════════════ */

function TaskChecklistManager({ centerId }) {
  const [checklists, setChecklists] = useState([]);
  const [children, setChildren] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [search, setSearch] = useState("");

  // Create form
  const [showCreate, setShowCreate] = useState(false);
  const [editingChecklistId, setEditingChecklistId] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newTasks, setNewTasks] = useState([blankTaskRow()]);
  const [saving, setSaving] = useState(false);

  // Expand to view per-child tracking
  const [expandedId, setExpandedId] = useState("");
  const [trackingChildId, setTrackingChildId] = useState("");
  const [childCompletions, setChildCompletions] = useState([]);
  const [completionLoading, setCompletionLoading] = useState(false);

  const loadData = useCallback(async () => {
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
  }, [centerId]);

  useEffect(() => {
    loadData();
    setExpandedId("");
    setTrackingChildId("");
    setChildCompletions([]);
    setShowCreate(false);
    setEditingChecklistId("");
    setSuccess("");
    setSearch("");
  }, [centerId, loadData]);

  function resetTaskChecklistForm() {
    setEditingChecklistId("");
    setNewTitle("");
    setNewDescription("");
    setNewTasks([blankTaskRow()]);
  }

  function cancelTaskChecklistForm() {
    resetTaskChecklistForm();
    setShowCreate(false);
  }

  function startEditChecklist(checklist) {
    setSuccess("");
    setError("");
    setEditingChecklistId(checklist.id);
    setNewTitle(checklist.title || "");
    setNewDescription(checklist.description || "");
    const rows = sortByTaskTime(checklist.tasks).map((task) => ({
      id: task.id,
      title: task.title || "",
      policyLink: task.policyLink || "",
      mediaLink: task.mediaLink || "",
      taskTime: task.taskTime || "",
    }));
    setNewTasks(rows.length ? rows : [blankTaskRow()]);
    setShowCreate(true);
  }

  async function saveChecklist(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const payload = {
        title: newTitle,
        description: newDescription || null,
        centerId,
        tasks: newTasks.filter((t) => t.title.trim()),
      };
      await apiJson(
        editingChecklistId
          ? `/api/v1/checklists/${encodeURIComponent(editingChecklistId)}`
          : "/api/v1/checklists",
        {
          method: editingChecklistId ? "PUT" : "POST",
          body: JSON.stringify(payload),
        },
      );
      cancelTaskChecklistForm();
      setSuccess(editingChecklistId ? "Checklist updated successfully." : "Checklist created successfully.");
      await loadData();
    } catch (e2) {
      setError(e2.message || "Failed to save checklist");
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
        body: JSON.stringify({ childId: trackingChildId, taskId, completed: !isCompleted }),
      });
      await loadChildCompletions(trackingChildId);
    } catch (e) {
      setError(e.message || "Failed to update task");
    }
  }

  function addTaskRow() {
    setNewTasks((prev) => [...prev, blankTaskRow()]);
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

  const filteredChecklists = useMemo(() => {
    if (!search.trim()) return checklists;
    const q = search.toLowerCase();
    return checklists.filter(
      (cl) =>
        cl.title?.toLowerCase().includes(q) ||
        cl.description?.toLowerCase().includes(q) ||
        cl.tasks?.some((t) => t.title?.toLowerCase().includes(q)),
    );
  }, [checklists, search]);

  // Global stats
  const totalTasks = checklists.reduce((sum, cl) => sum + (cl.tasks?.length || 0), 0);
  const totalCompleted = trackingChildId
    ? childCompletions.filter((c) => c.completedAt).length
    : 0;

  return (
    <div className="space-y-4">
      {/* Alerts */}
      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <svg className="h-4 w-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
          </svg>
          {error}
          <button onClick={() => setError("")} className="ml-auto text-red-400 hover:text-red-600">&times;</button>
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          <svg className="h-4 w-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.06l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
          </svg>
          {success}
          <button onClick={() => setSuccess("")} className="ml-auto text-emerald-400 hover:text-emerald-600">&times;</button>
        </div>
      )}

      {/* Toolbar: Create + Search + Child Tracking */}
      <div className="rounded-2xl border border-gray-200 bg-white p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex flex-wrap items-end gap-3">
            {/* Create button */}
            <button
              type="button"
              onClick={() => {
                if (showCreate) {
                  cancelTaskChecklistForm();
                } else {
                  resetTaskChecklistForm();
                  setShowCreate(true);
                }
                setSuccess("");
              }}
              className={[
                "inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all",
                showCreate
                  ? "bg-gray-100 text-gray-700 ring-1 ring-gray-200"
                  : "bg-sky-600 text-white shadow-sm hover:bg-sky-700",
              ].join(" ")}
            >
              <IconPlus />
              {showCreate ? "Cancel" : "New Checklist"}
            </button>

            {/* Search */}
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                <IconSearch />
              </span>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search checklists..."
                className="w-56 rounded-xl border border-gray-200 bg-gray-50 py-2.5 pl-9 pr-3 text-sm placeholder:text-gray-400 focus:border-sky-300 focus:bg-white focus:ring-1 focus:ring-sky-200 focus:outline-none"
              />
            </div>
          </div>

          {/* Child tracking */}
          <div className="flex items-end gap-3">
            <label className="block min-w-[200px]">
              <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
                <IconUser />
                Track by child
              </div>
              <select
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm focus:border-sky-300 focus:bg-white focus:ring-1 focus:ring-sky-200 focus:outline-none"
                value={trackingChildId}
                onChange={(e) => setTrackingChildId(e.target.value)}
              >
                <option value="">All children</option>
                {sortedChildren.map((ch) => (
                  <option key={ch.id} value={ch.id}>
                    {ch.firstName} {ch.lastName || ""}
                  </option>
                ))}
              </select>
            </label>
            {trackingChildId && !completionLoading && (
              <div className="pb-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-gray-500">
                  <span className="text-emerald-600">{totalCompleted}</span>
                  <span>/</span>
                  <span>{totalTasks} tasks</span>
                </div>
                {totalTasks > 0 && (
                  <div className="mt-1 h-1.5 w-24 overflow-hidden rounded-full bg-gray-200">
                    <div
                      className="h-full rounded-full bg-emerald-500 transition-all duration-300"
                      style={{ width: `${Math.round((totalCompleted / totalTasks) * 100)}%` }}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Inline create form */}
        {showCreate && (
          <form onSubmit={saveChecklist} className="mt-4 space-y-4 border-t border-gray-100 pt-4">
            <h3 className="flex items-center gap-2 text-sm font-bold text-gray-900">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-sky-100 text-sky-600">
                <IconPlus />
              </span>
              {editingChecklistId ? "Edit Task Checklist" : "New Task Checklist"}
            </h3>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <label className="block">
                <div className="mb-1 text-xs font-semibold text-gray-500">Title *</div>
                <input
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm focus:border-sky-300 focus:bg-white focus:ring-1 focus:ring-sky-200 focus:outline-none"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  required
                  placeholder="e.g. Daily Hygiene Checklist"
                />
              </label>
              <label className="block">
                <div className="mb-1 text-xs font-semibold text-gray-500">Description</div>
                <input
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm focus:border-sky-300 focus:bg-white focus:ring-1 focus:ring-sky-200 focus:outline-none"
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="Brief description (optional)"
                />
              </label>
            </div>

            <div>
              <div className="mb-2 text-xs font-semibold text-gray-500">Tasks</div>
              <div className="space-y-2">
                {newTasks.map((t, i) => (
                  <div key={i} className="group flex items-start gap-2 rounded-xl border border-gray-200 bg-gray-50/50 p-3 transition-colors hover:border-gray-300">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gray-200 text-xs font-bold text-gray-600">
                      {i + 1}
                    </span>
                    <div className="flex-1 grid grid-cols-1 gap-2 md:grid-cols-4">
                      <input
                        type="time"
                        className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-sky-300 focus:ring-1 focus:ring-sky-200 focus:outline-none"
                        value={t.taskTime || ""}
                        onChange={(e) => updateTaskRow(i, "taskTime", e.target.value)}
                        aria-label="Task time"
                      />
                      <input
                        className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-sky-300 focus:ring-1 focus:ring-sky-200 focus:outline-none"
                        value={t.title}
                        onChange={(e) => updateTaskRow(i, "title", e.target.value)}
                        placeholder="Task name *"
                      />
                      <input
                        className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-sky-300 focus:ring-1 focus:ring-sky-200 focus:outline-none"
                        value={t.policyLink}
                        onChange={(e) => updateTaskRow(i, "policyLink", e.target.value)}
                        placeholder="Policy URL (optional)"
                      />
                      <input
                        className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-sky-300 focus:ring-1 focus:ring-sky-200 focus:outline-none"
                        value={t.mediaLink}
                        onChange={(e) => updateTaskRow(i, "mediaLink", e.target.value)}
                        placeholder="Training video URL (optional)"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removeTaskRow(i)}
                      disabled={newTasks.length <= 1}
                      className="mt-1 rounded-lg p-1.5 text-gray-400 opacity-0 transition-all hover:bg-red-50 hover:text-red-500 group-hover:opacity-100 disabled:hidden"
                    >
                      <IconTrash />
                    </button>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={addTaskRow}
                className="mt-2 inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-sky-600 hover:bg-sky-50"
              >
                <IconPlus /> Add another task
              </button>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="submit"
                disabled={saving || !newTitle.trim()}
                className="rounded-xl bg-sky-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-sky-700 disabled:opacity-50"
              >
                {saving ? "Saving..." : editingChecklistId ? "Save Checklist" : "Create Checklist"}
              </button>
              <button
                type="button"
                onClick={cancelTaskChecklistForm}
                className="rounded-xl px-4 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-100"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Checklist Cards */}
      {loading ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-6">
          <Skeleton count={5} />
        </div>
      ) : filteredChecklists.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-300 bg-white py-14 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-100 text-gray-400">
            <IconClipboard />
          </div>
          <h3 className="mt-3 text-sm font-bold text-gray-900">
            {search ? "No matching checklists" : "No checklists yet"}
          </h3>
          <p className="mt-1 max-w-xs text-xs text-gray-500">
            {search
              ? `No results for "${search}". Try a different search term.`
              : "Create your first task checklist to start tracking per-child progress."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredChecklists.map((cl) => {
            const isExpanded = expandedId === cl.id;
            const tasks = sortByTaskTime(cl.tasks);
            const completedCount = trackingChildId
              ? tasks.filter((t) => completionByTaskId.get(t.id)?.completedAt).length
              : 0;
            const pct = tasks.length > 0 ? Math.round((completedCount / tasks.length) * 100) : 0;

            return (
              <div
                key={cl.id}
                className={[
                  "overflow-hidden rounded-2xl border bg-white transition-shadow",
                  isExpanded ? "border-sky-200 shadow-md shadow-sky-100/50" : "border-gray-200 hover:shadow-sm",
                ].join(" ")}
              >
                {/* Card header */}
                <button
                  type="button"
                  className="flex w-full items-center gap-3 p-4 text-left"
                  onClick={() => setExpandedId(isExpanded ? "" : cl.id)}
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-600">
                    <IconClipboard />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-bold text-gray-900">{cl.title}</span>
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-600">
                        {tasks.length} {tasks.length === 1 ? "task" : "tasks"}
                      </span>
                      {trackingChildId && tasks.length > 0 && (
                        <span
                          className={[
                            "rounded-full px-2 py-0.5 text-[11px] font-bold",
                            completedCount === tasks.length
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-amber-100 text-amber-700",
                          ].join(" ")}
                        >
                          {completedCount}/{tasks.length} done
                        </span>
                      )}
                    </div>
                    {cl.description && (
                      <p className="mt-0.5 text-xs text-gray-500 line-clamp-1">{cl.description}</p>
                    )}
                    {/* Mini progress bar */}
                    {trackingChildId && tasks.length > 0 && (
                      <div className="mt-2 h-1 w-32 overflow-hidden rounded-full bg-gray-200">
                        <div
                          className={[
                            "h-full rounded-full transition-all duration-300",
                            pct === 100 ? "bg-emerald-500" : "bg-sky-500",
                          ].join(" ")}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      onClick={(e) => { e.stopPropagation(); startEditChecklist(cl); }}
                      className="rounded-lg px-2 py-1 text-xs font-semibold text-gray-500 transition-colors hover:bg-sky-50 hover:text-sky-700"
                      role="button"
                      tabIndex={0}
                    >
                      Edit
                    </span>
                    <span
                      onClick={(e) => { e.stopPropagation(); deleteChecklist(cl.id); }}
                      className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500"
                      role="button"
                      tabIndex={0}
                    >
                      <IconTrash />
                    </span>
                    <IconChevronDown open={isExpanded} />
                  </div>
                </button>

                {/* Expanded tasks */}
                {isExpanded && (
                  <div className="border-t border-gray-100 bg-gray-50/30 p-4">
                    {tasks.length === 0 ? (
                      <p className="text-sm text-gray-500">No tasks in this checklist.</p>
                    ) : (
                      <div className="space-y-2">
                        {tasks.map((task, idx) => {
                          const completion = completionByTaskId.get(task.id);
                          const isDone = !!completion?.completedAt;
                          return (
                            <div
                              key={task.id}
                              className={[
                                "flex items-start gap-3 rounded-xl border p-3 transition-colors",
                                isDone
                                  ? "border-emerald-200 bg-emerald-50/50"
                                  : "border-gray-200 bg-white hover:border-gray-300",
                              ].join(" ")}
                            >
                              {trackingChildId ? (
                                <button
                                  type="button"
                                  onClick={() => toggleTaskCompletion(task.id, isDone)}
                                  className={[
                                    "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-all",
                                    isDone
                                      ? "border-emerald-500 bg-emerald-500 text-white"
                                      : "border-gray-300 hover:border-sky-400",
                                  ].join(" ")}
                                >
                                  {isDone && (
                                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                                    </svg>
                                  )}
                                </button>
                              ) : (
                                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-gray-100 text-[10px] font-bold text-gray-500">
                                  {idx + 1}
                                </span>
                              )}
                              <div className="min-w-0 flex-1">
                                {task.taskTime ? (
                                  <div className="mb-1 text-[10px] font-bold uppercase tracking-wide text-sky-600">
                                    {formatTaskTime(task.taskTime)}
                                  </div>
                                ) : null}
                                <div
                                  className={[
                                    "text-sm font-semibold",
                                    isDone ? "text-emerald-700 line-through decoration-emerald-300" : "text-gray-900",
                                  ].join(" ")}
                                >
                                  {task.title}
                                </div>
                                <div className="mt-1 flex flex-wrap gap-1.5">
                                  {task.policyLink && (
                                    <a
                                      href={task.policyLink}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-600 hover:bg-blue-100"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <IconLink /> Policy
                                    </a>
                                  )}
                                  {task.mediaLink && (
                                    <a
                                      href={task.mediaLink}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-1 rounded-md bg-purple-50 px-2 py-0.5 text-[10px] font-semibold text-purple-600 hover:bg-purple-100"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <IconPlay /> Video
                                    </a>
                                  )}
                                </div>
                                {isDone && completion?.completedAt && (
                                  <div className="mt-1 text-[10px] text-emerald-500">
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

/* ═══════════════════════════════════════════════════════════════════
   Daily Operations Checklist Manager (admin CRUD)
   ═══════════════════════════════════════════════════════════════════ */

const CATEGORY_OPTIONS = [
  { value: "OPENING", label: "Opening", color: "amber" },
  { value: "CLOSING", label: "Closing", color: "indigo" },
  { value: "HEALTH_SAFETY", label: "Health & Safety", color: "red" },
  { value: "CLEANING", label: "Cleaning", color: "emerald" },
  { value: "MEALS", label: "Meals", color: "orange" },
  { value: "CLASSROOM", label: "Classroom", color: "sky" },
  { value: "OTHER", label: "Other", color: "gray" },
];

const FREQUENCY_OPTIONS = [
  { value: "DAILY", label: "Daily" },
  { value: "WEEKLY", label: "Weekly" },
  { value: "MONTHLY", label: "Monthly" },
];

const CAT_STYLES = {
  OPENING:        { border: "border-l-amber-400",   bg: "bg-amber-50",   text: "text-amber-700",   icon: "text-amber-500" },
  CLOSING:        { border: "border-l-indigo-400",  bg: "bg-indigo-50",  text: "text-indigo-700",  icon: "text-indigo-500" },
  HEALTH_SAFETY:  { border: "border-l-red-400",     bg: "bg-red-50",     text: "text-red-700",     icon: "text-red-500" },
  CLEANING:       { border: "border-l-emerald-400", bg: "bg-emerald-50", text: "text-emerald-700", icon: "text-emerald-500" },
  MEALS:          { border: "border-l-orange-400",  bg: "bg-orange-50",  text: "text-orange-700",  icon: "text-orange-500" },
  CLASSROOM:      { border: "border-l-sky-400",     bg: "bg-sky-50",     text: "text-sky-700",     icon: "text-sky-500" },
  OTHER:          { border: "border-l-gray-400",    bg: "bg-gray-50",    text: "text-gray-700",    icon: "text-gray-500" },
};

const FREQ_STYLES = {
  DAILY:   "bg-blue-50 text-blue-700",
  WEEKLY:  "bg-purple-50 text-purple-700",
  MONTHLY: "bg-amber-50 text-amber-700",
};

function DailyChecklistManager({ centerId }) {
  const [checklists, setChecklists] = useState([]);
  const [classrooms, setClassrooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("");

  // Create form
  const [showCreate, setShowCreate] = useState(false);
  const [editingDailyId, setEditingDailyId] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newCategory, setNewCategory] = useState("OTHER");
  const [newFrequency, setNewFrequency] = useState("DAILY");
  const [newClassRoomId, setNewClassRoomId] = useState("");
  const [newItems, setNewItems] = useState([blankDailyItemRow()]);
  const [saving, setSaving] = useState(false);

  const [expandedId, setExpandedId] = useState("");

  const loadData = useCallback(async () => {
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
  }, [centerId]);

  useEffect(() => {
    loadData();
    setShowCreate(false);
    setEditingDailyId("");
    setExpandedId("");
    setSuccess("");
    setSearch("");
    setFilterCategory("");
  }, [centerId, loadData]);

  function resetDailyChecklistForm() {
    setEditingDailyId("");
    setNewTitle("");
    setNewDescription("");
    setNewCategory("OTHER");
    setNewFrequency("DAILY");
    setNewClassRoomId("");
    setNewItems([blankDailyItemRow()]);
  }

  function cancelDailyChecklistForm() {
    resetDailyChecklistForm();
    setShowCreate(false);
  }

  function startEditDailyChecklist(checklist) {
    setSuccess("");
    setError("");
    setEditingDailyId(checklist.id);
    setNewTitle(checklist.title || "");
    setNewDescription(checklist.description || "");
    setNewCategory(checklist.category || "OTHER");
    setNewFrequency(checklist.frequency || "DAILY");
    setNewClassRoomId(checklist.classRoomId || "");
    const rows = sortByTaskTime(checklist.items).map((item) => ({
      id: item.id,
      title: item.title || "",
      description: item.description || "",
      policyLink: item.policyLink || "",
      mediaLink: item.mediaLink || "",
      taskTime: item.taskTime || "",
    }));
    setNewItems(rows.length ? rows : [blankDailyItemRow()]);
    setShowCreate(true);
  }

  async function saveChecklist(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      await apiJson("/api/v1/daily-checklists", {
        method: editingDailyId ? "PUT" : "POST",
        body: JSON.stringify({
          id: editingDailyId || undefined,
          title: newTitle,
          description: newDescription || null,
          centerId,
          classRoomId: newClassRoomId || null,
          category: newCategory,
          frequency: newFrequency,
          items: newItems.filter((t) => t.title.trim()),
        }),
      });
      cancelDailyChecklistForm();
      setSuccess(editingDailyId ? "Daily checklist updated successfully." : "Daily checklist created successfully.");
      await loadData();
    } catch (e2) {
      setError(e2.message || "Failed to save checklist");
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
    setNewItems((prev) => [...prev, blankDailyItemRow()]);
  }
  function removeItemRow(index) {
    setNewItems((prev) => prev.filter((_, i) => i !== index));
  }
  function updateItemRow(index, field, value) {
    setNewItems((prev) => prev.map((t, i) => (i === index ? { ...t, [field]: value } : t)));
  }

  // Filter + group
  const filtered = useMemo(() => {
    let result = checklists;
    if (filterCategory) result = result.filter((cl) => cl.category === filterCategory);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (cl) =>
          cl.title?.toLowerCase().includes(q) ||
          cl.description?.toLowerCase().includes(q) ||
          cl.items?.some((it) => it.title?.toLowerCase().includes(q)),
      );
    }
    return result;
  }, [checklists, filterCategory, search]);

  const grouped = useMemo(() => {
    const map = {};
    for (const cl of filtered) {
      if (!map[cl.category]) map[cl.category] = [];
      map[cl.category].push(cl);
    }
    return map;
  }, [filtered]);

  // Category summary counts
  const categoryCounts = useMemo(() => {
    const counts = {};
    for (const cl of checklists) {
      counts[cl.category] = (counts[cl.category] || 0) + 1;
    }
    return counts;
  }, [checklists]);

  return (
    <div className="space-y-4">
      {/* Alerts */}
      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <svg className="h-4 w-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
          </svg>
          {error}
          <button onClick={() => setError("")} className="ml-auto text-red-400 hover:text-red-600">&times;</button>
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          <svg className="h-4 w-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.06l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
          </svg>
          {success}
          <button onClick={() => setSuccess("")} className="ml-auto text-emerald-400 hover:text-emerald-600">&times;</button>
        </div>
      )}

      {/* Toolbar */}
      <div className="rounded-2xl border border-gray-200 bg-white p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex flex-wrap items-end gap-3">
            <button
              type="button"
              onClick={() => {
                if (showCreate) {
                  cancelDailyChecklistForm();
                } else {
                  resetDailyChecklistForm();
                  setShowCreate(true);
                }
                setSuccess("");
              }}
              className={[
                "inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all",
                showCreate
                  ? "bg-gray-100 text-gray-700 ring-1 ring-gray-200"
                  : "bg-sky-600 text-white shadow-sm hover:bg-sky-700",
              ].join(" ")}
            >
              <IconPlus />
              {showCreate ? "Cancel" : "New Daily Checklist"}
            </button>

            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                <IconSearch />
              </span>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search..."
                className="w-48 rounded-xl border border-gray-200 bg-gray-50 py-2.5 pl-9 pr-3 text-sm placeholder:text-gray-400 focus:border-sky-300 focus:bg-white focus:ring-1 focus:ring-sky-200 focus:outline-none"
              />
            </div>
          </div>

          {/* Category filter chips */}
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setFilterCategory("")}
              className={[
                "rounded-lg px-2.5 py-1 text-xs font-semibold transition-all",
                !filterCategory
                  ? "bg-gray-900 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200",
              ].join(" ")}
            >
              All ({checklists.length})
            </button>
            {CATEGORY_OPTIONS.map((cat) => {
              const count = categoryCounts[cat.value] || 0;
              if (count === 0) return null;
              const style = CAT_STYLES[cat.value] || CAT_STYLES.OTHER;
              const active = filterCategory === cat.value;
              return (
                <button
                  key={cat.value}
                  type="button"
                  onClick={() => setFilterCategory(active ? "" : cat.value)}
                  className={[
                    "rounded-lg px-2.5 py-1 text-xs font-semibold transition-all",
                    active
                      ? `${style.bg} ${style.text} ring-1 ring-current/20`
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200",
                  ].join(" ")}
                >
                  {cat.label} ({count})
                </button>
              );
            })}
          </div>
        </div>

        {/* Create form */}
        {showCreate && (
          <form onSubmit={saveChecklist} className="mt-4 space-y-4 border-t border-gray-100 pt-4">
            <h3 className="flex items-center gap-2 text-sm font-bold text-gray-900">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-sky-100 text-sky-600">
                <IconPlus />
              </span>
              {editingDailyId ? "Edit Daily Operations Checklist" : "New Daily Operations Checklist"}
            </h3>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
              <label className="block">
                <div className="mb-1 text-xs font-semibold text-gray-500">Title *</div>
                <input
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm focus:border-sky-300 focus:bg-white focus:ring-1 focus:ring-sky-200 focus:outline-none"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  required
                  placeholder="e.g. Morning Opening Checklist"
                />
              </label>
              <label className="block">
                <div className="mb-1 text-xs font-semibold text-gray-500">Category</div>
                <select
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm focus:border-sky-300 focus:bg-white focus:ring-1 focus:ring-sky-200 focus:outline-none"
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                >
                  {CATEGORY_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </label>
              <label className="block">
                <div className="mb-1 text-xs font-semibold text-gray-500">Frequency</div>
                <select
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm focus:border-sky-300 focus:bg-white focus:ring-1 focus:ring-sky-200 focus:outline-none"
                  value={newFrequency}
                  onChange={(e) => setNewFrequency(e.target.value)}
                >
                  {FREQUENCY_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </label>
              <label className="block">
                <div className="mb-1 text-xs font-semibold text-gray-500">Classroom</div>
                <select
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm focus:border-sky-300 focus:bg-white focus:ring-1 focus:ring-sky-200 focus:outline-none"
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
                <div className="mb-1 text-xs font-semibold text-gray-500">Description</div>
                <input
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm focus:border-sky-300 focus:bg-white focus:ring-1 focus:ring-sky-200 focus:outline-none"
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="Brief description (optional)"
                />
              </label>
            </div>

            <div>
              <div className="mb-2 text-xs font-semibold text-gray-500">Tasks</div>
              <div className="space-y-2">
                {newItems.map((t, i) => (
                  <div key={i} className="group flex items-start gap-2 rounded-xl border border-gray-200 bg-gray-50/50 p-3 transition-colors hover:border-gray-300">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gray-200 text-xs font-bold text-gray-600">
                      {i + 1}
                    </span>
                    <div className="flex-1 grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-5">
                      <input
                        type="time"
                        className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-sky-300 focus:ring-1 focus:ring-sky-200 focus:outline-none"
                        value={t.taskTime || ""}
                        onChange={(e) => updateItemRow(i, "taskTime", e.target.value)}
                        aria-label="Task time"
                      />
                      <input
                        className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-sky-300 focus:ring-1 focus:ring-sky-200 focus:outline-none"
                        value={t.title}
                        onChange={(e) => updateItemRow(i, "title", e.target.value)}
                        placeholder="Task name *"
                      />
                      <input
                        className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-sky-300 focus:ring-1 focus:ring-sky-200 focus:outline-none"
                        value={t.description}
                        onChange={(e) => updateItemRow(i, "description", e.target.value)}
                        placeholder="Description (optional)"
                      />
                      <input
                        className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-sky-300 focus:ring-1 focus:ring-sky-200 focus:outline-none"
                        value={t.policyLink}
                        onChange={(e) => updateItemRow(i, "policyLink", e.target.value)}
                        placeholder="Policy URL (optional)"
                      />
                      <input
                        className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-sky-300 focus:ring-1 focus:ring-sky-200 focus:outline-none"
                        value={t.mediaLink}
                        onChange={(e) => updateItemRow(i, "mediaLink", e.target.value)}
                        placeholder="Video URL (optional)"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removeItemRow(i)}
                      disabled={newItems.length <= 1}
                      className="mt-1 rounded-lg p-1.5 text-gray-400 opacity-0 transition-all hover:bg-red-50 hover:text-red-500 group-hover:opacity-100 disabled:hidden"
                    >
                      <IconTrash />
                    </button>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={addItemRow}
                className="mt-2 inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-sky-600 hover:bg-sky-50"
              >
                <IconPlus /> Add another task
              </button>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="submit"
                disabled={saving || !newTitle.trim()}
                className="rounded-xl bg-sky-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-sky-700 disabled:opacity-50"
              >
                {saving ? "Saving..." : editingDailyId ? "Save Checklist" : "Create Checklist"}
              </button>
              <button
                type="button"
                onClick={cancelDailyChecklistForm}
                className="rounded-xl px-4 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-100"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Checklist cards grouped by category */}
      {loading ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-6">
          <Skeleton count={5} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-300 bg-white py-14 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-100 text-gray-400">
            <IconCog />
          </div>
          <h3 className="mt-3 text-sm font-bold text-gray-900">
            {search || filterCategory ? "No matching checklists" : "No daily checklists yet"}
          </h3>
          <p className="mt-1 max-w-xs text-xs text-gray-500">
            {search || filterCategory
              ? "Try adjusting your search or filter."
              : "Create your first daily operations checklist to streamline routines."}
          </p>
        </div>
      ) : (
        Object.entries(grouped).map(([category, lists]) => {
          const catStyle = CAT_STYLES[category] || CAT_STYLES.OTHER;
          const catLabel = CATEGORY_OPTIONS.find((o) => o.value === category)?.label || category;
          return (
            <div key={category} className="space-y-2">
              <div className="flex items-center gap-2">
                <div className={`h-3 w-3 rounded-sm ${catStyle.bg} ${catStyle.border} border-l-4`} />
                <h3 className="text-xs font-extrabold uppercase tracking-wide text-gray-500">
                  {catLabel}
                  <span className="ml-1.5 font-semibold text-gray-400">({lists.length})</span>
                </h3>
              </div>
              {lists.map((cl) => {
                const isExpanded = expandedId === cl.id;
                const items = sortByTaskTime(cl.items);
                return (
                  <div
                    key={cl.id}
                    className={[
                      "overflow-hidden rounded-2xl border-l-4 border bg-white transition-shadow",
                      catStyle.border,
                      !cl.active ? "opacity-50" : "",
                      isExpanded ? "border-gray-300 shadow-md" : "border-gray-200 hover:shadow-sm",
                    ].join(" ")}
                  >
                    {/* Card header */}
                    <div className="flex items-center gap-3 p-4">
                      <button
                        type="button"
                        className="flex min-w-0 flex-1 items-center gap-3 text-left"
                        onClick={() => setExpandedId(isExpanded ? "" : cl.id)}
                      >
                        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${catStyle.bg} ${catStyle.icon}`}>
                          <IconCog />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-bold text-gray-900">{cl.title}</span>
                            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-600">
                              {items.length} {items.length === 1 ? "task" : "tasks"}
                            </span>
                            <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${FREQ_STYLES[cl.frequency] || FREQ_STYLES.DAILY}`}>
                              {cl.frequency}
                            </span>
                            {cl.classRoom && (
                              <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-semibold text-sky-700">
                                {cl.classRoom.name}
                              </span>
                            )}
                            {!cl.active && (
                              <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-bold text-red-600">
                                Inactive
                              </span>
                            )}
                          </div>
                          {cl.description && (
                            <p className="mt-0.5 text-xs text-gray-500 line-clamp-1">{cl.description}</p>
                          )}
                        </div>
                        <IconChevronDown open={isExpanded} />
                      </button>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => startEditDailyChecklist(cl)}
                          className="rounded-lg px-3 py-1.5 text-xs font-semibold text-gray-600 transition-colors hover:bg-sky-50 hover:text-sky-700"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleActive(cl.id, cl.active)}
                          className={[
                            "rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
                            cl.active
                              ? "text-gray-600 hover:bg-gray-100"
                              : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100",
                          ].join(" ")}
                        >
                          {cl.active ? "Deactivate" : "Activate"}
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteChecklist(cl.id)}
                          className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500"
                        >
                          <IconTrash />
                        </button>
                      </div>
                    </div>

                    {/* Expanded items */}
                    {isExpanded && (
                      <div className="border-t border-gray-100 bg-gray-50/30 p-4">
                        {items.length === 0 ? (
                          <p className="text-sm text-gray-500">No tasks in this checklist.</p>
                        ) : (
                          <div className="space-y-2">
                            {items.map((item, idx) => (
                              <div key={item.id} className="flex items-start gap-3 rounded-xl border border-gray-200 bg-white p-3 hover:border-gray-300 transition-colors">
                                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-[11px] font-bold text-gray-600">
                                  {idx + 1}
                                </span>
                                <div className="min-w-0 flex-1">
                                  {item.taskTime ? (
                                    <div className="mb-1 text-[10px] font-bold uppercase tracking-wide text-sky-600">
                                      {formatTaskTime(item.taskTime)}
                                    </div>
                                  ) : null}
                                  <div className="text-sm font-semibold text-gray-900">{item.title}</div>
                                  {item.description && (
                                    <p className="mt-0.5 text-xs text-gray-500">{item.description}</p>
                                  )}
                                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                                    {item.policyLink && (
                                      <a
                                        href={item.policyLink}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-600 hover:bg-blue-100"
                                      >
                                        <IconLink /> Policy
                                      </a>
                                    )}
                                    {item.mediaLink && (
                                      <a
                                        href={item.mediaLink}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1 rounded-md bg-purple-50 px-2 py-0.5 text-[10px] font-semibold text-purple-600 hover:bg-purple-100"
                                      >
                                        <IconPlay /> Video
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
          );
        })
      )}
    </div>
  );
}
