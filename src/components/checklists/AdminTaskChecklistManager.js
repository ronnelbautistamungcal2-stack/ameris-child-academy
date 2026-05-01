import Skeleton from "@/components/ui/Skeleton";
import { apiJson } from "@/lib/api";
import {
  WEEKDAY_OPTIONS,
  describeChecklistSchedule,
  normalizeMonthlyDay,
  normalizeRepeatDays,
} from "@/lib/checklistSchedule";
import { useCallback, useEffect, useMemo, useState } from "react";

const CATEGORY_OPTIONS = [
  { value: "OPENING", label: "Opening" },
  { value: "CLOSING", label: "Closing" },
  { value: "HEALTH_SAFETY", label: "Health & Safety" },
  { value: "CLEANING", label: "Cleaning" },
  { value: "MEALS", label: "Meals" },
  { value: "CLASSROOM", label: "Classroom" },
  { value: "OTHER", label: "Other" },
];

const CATEGORY_STYLES = {
  OPENING: { border: "border-l-amber-400", bg: "bg-amber-50", text: "text-amber-700" },
  CLOSING: { border: "border-l-indigo-400", bg: "bg-indigo-50", text: "text-indigo-700" },
  HEALTH_SAFETY: { border: "border-l-rose-400", bg: "bg-rose-50", text: "text-rose-700" },
  CLEANING: { border: "border-l-emerald-400", bg: "bg-emerald-50", text: "text-emerald-700" },
  MEALS: { border: "border-l-orange-400", bg: "bg-orange-50", text: "text-orange-700" },
  CLASSROOM: { border: "border-l-sky-400", bg: "bg-sky-50", text: "text-sky-700" },
  OTHER: { border: "border-l-gray-400", bg: "bg-gray-50", text: "text-gray-700" },
};

const FREQUENCY_OPTIONS = [
  { value: "DAILY", label: "Daily" },
  { value: "WEEKLY", label: "Weekly" },
  { value: "MONTHLY", label: "Monthly" },
];

const FREQUENCY_STYLES = {
  DAILY: "bg-sky-50 text-sky-700",
  WEEKLY: "bg-violet-50 text-violet-700",
  MONTHLY: "bg-amber-50 text-amber-700",
};

function blankItemRow() {
  return {
    title: "",
    description: "",
    lessonId: "",
    policyDocumentId: "",
    directLinkLabel: "",
    directLink: "",
    policyLink: "",
    mediaLink: "",
    taskTime: "",
  };
}

function sortByTaskTime(items) {
  return (Array.isArray(items) ? items : []).slice().sort((a, b) => {
    const left = a.taskTime || "99:99";
    const right = b.taskTime || "99:99";
    if (left !== right) return left.localeCompare(right);
    return Number(a.sortOrder || 0) - Number(b.sortOrder || 0);
  });
}

function formatTaskTime(value) {
  if (!value) return "";
  const [hour, minute] = String(value).split(":");
  const date = new Date();
  date.setHours(Number(hour), Number(minute || 0), 0, 0);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function roleLabel(role) {
  return String(role || "")
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function summaryForItem(item) {
  const labels = [];
  if (item.lesson?.title) labels.push(`Lesson: ${item.lesson.title}`);
  if (item.policyDocument?.title) labels.push(`Policy: ${item.policyDocument.title}`);
  if (item.directLink) labels.push(item.directLinkLabel || "Direct link");
  if (item.mediaLink) labels.push("Training video");
  if (item.policyLink) labels.push("Reference link");
  return labels;
}

function toggleRepeatDay(days, dayValue) {
  const set = new Set(normalizeRepeatDays(days));
  if (set.has(dayValue)) set.delete(dayValue);
  else set.add(dayValue);
  return [...set].sort((a, b) => a - b);
}

export default function AdminTaskChecklistManager({ centerId }) {
  const [checklists, setChecklists] = useState([]);
  const [classrooms, setClassrooms] = useState([]);
  const [lessons, setLessons] = useState([]);
  const [policies, setPolicies] = useState([]);
  const [staffMembers, setStaffMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterFrequency, setFilterFrequency] = useState("");
  const [expandedId, setExpandedId] = useState("");

  const [showCreate, setShowCreate] = useState(false);
  const [editingChecklistId, setEditingChecklistId] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newCategory, setNewCategory] = useState("OTHER");
  const [newFrequency, setNewFrequency] = useState("DAILY");
  const [newRepeatDays, setNewRepeatDays] = useState([]);
  const [newMonthlyDay, setNewMonthlyDay] = useState("");
  const [newClassRoomId, setNewClassRoomId] = useState("");
  const [newAssignedUserId, setNewAssignedUserId] = useState("");
  const [newItems, setNewItems] = useState([blankItemRow()]);
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [lists, rooms, lessonRows, policyRows, userRows] = await Promise.all([
        apiJson(`/api/v1/daily-checklists?centerId=${encodeURIComponent(centerId)}`),
        apiJson(`/api/v1/classes?centerId=${encodeURIComponent(centerId)}`),
        apiJson(`/api/v1/lessons?centerId=${encodeURIComponent(centerId)}`),
        apiJson(`/api/v1/policies?centerId=${encodeURIComponent(centerId)}`).catch(() => []),
        apiJson(`/api/v1/users?centerId=${encodeURIComponent(centerId)}&roles=TEACHER,OTHER_STAFF,COACH`),
      ]);
      setChecklists(Array.isArray(lists) ? lists : []);
      setClassrooms(Array.isArray(rooms) ? rooms : []);
      setLessons(Array.isArray(lessonRows) ? lessonRows : []);
      setPolicies(Array.isArray(policyRows) ? policyRows : []);
      setStaffMembers(Array.isArray(userRows) ? userRows : []);
    } catch (nextError) {
      setError(nextError.message || "Failed to load checklist data");
    } finally {
      setLoading(false);
    }
  }, [centerId]);

  useEffect(() => {
    loadData();
    setShowCreate(false);
    setEditingChecklistId("");
    setExpandedId("");
    setSuccess("");
    setSearch("");
    setFilterCategory("");
    setFilterFrequency("");
  }, [centerId, loadData]);

  function resetForm() {
    setEditingChecklistId("");
    setNewTitle("");
    setNewDescription("");
    setNewCategory("OTHER");
    setNewFrequency("DAILY");
    setNewRepeatDays([]);
    setNewMonthlyDay("");
    setNewClassRoomId("");
    setNewAssignedUserId("");
    setNewItems([blankItemRow()]);
  }

  function closeForm() {
    resetForm();
    setShowCreate(false);
  }

  function openCreate() {
    setError("");
    setSuccess("");
    resetForm();
    setShowCreate(true);
  }

  function openEdit(checklist) {
    setError("");
    setSuccess("");
    setEditingChecklistId(checklist.id);
    setNewTitle(checklist.title || "");
    setNewDescription(checklist.description || "");
    setNewCategory(checklist.category || "OTHER");
    setNewFrequency(checklist.frequency || "DAILY");
    setNewRepeatDays(normalizeRepeatDays(checklist.repeatDays));
    setNewMonthlyDay(checklist.monthlyDay ? String(checklist.monthlyDay) : "");
    setNewClassRoomId(checklist.classRoomId || "");
    setNewAssignedUserId(checklist.assignedUserId || "");
    const rows = sortByTaskTime(checklist.items).map((item) => ({
      id: item.id,
      title: item.title || "",
      description: item.description || "",
      lessonId: item.lessonId || "",
      policyDocumentId: item.policyDocumentId || "",
      directLinkLabel: item.directLinkLabel || "",
      directLink: item.directLink || "",
      policyLink: item.policyLink || "",
      mediaLink: item.mediaLink || "",
      taskTime: item.taskTime || "",
    }));
    setNewItems(rows.length ? rows : [blankItemRow()]);
    setShowCreate(true);
  }

  function validateForm() {
    if (!newTitle.trim()) return "Checklist title is required.";
    if (newFrequency === "WEEKLY" && normalizeRepeatDays(newRepeatDays).length === 0) {
      return "Pick at least one weekday for a weekly checklist.";
    }
    if (newFrequency === "MONTHLY" && !normalizeMonthlyDay(newMonthlyDay)) {
      return "Enter a valid monthly day between 1 and 31.";
    }
    if (!newItems.some((item) => item.title.trim())) {
      return "Add at least one task item.";
    }
    return "";
  }

  async function saveChecklist(event) {
    event.preventDefault();
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");
    try {
      await apiJson("/api/v1/daily-checklists", {
        method: editingChecklistId ? "PUT" : "POST",
        body: JSON.stringify({
          id: editingChecklistId || undefined,
          centerId,
          title: newTitle.trim(),
          description: newDescription.trim() || null,
          category: newCategory,
          frequency: newFrequency,
          repeatDays: newFrequency === "WEEKLY" ? normalizeRepeatDays(newRepeatDays) : [],
          monthlyDay: newFrequency === "MONTHLY" ? normalizeMonthlyDay(newMonthlyDay) : null,
          classRoomId: newClassRoomId || null,
          assignedUserId: newAssignedUserId || null,
          items: newItems
            .filter((item) => item.title.trim())
            .map((item) => ({
              id: item.id,
              title: item.title.trim(),
              description: item.description.trim() || null,
              lessonId: item.lessonId || null,
              policyDocumentId: item.policyDocumentId || null,
              directLinkLabel: item.directLinkLabel.trim() || null,
              directLink: item.directLink.trim() || null,
              policyLink: item.policyLink.trim() || null,
              mediaLink: item.mediaLink.trim() || null,
              taskTime: item.taskTime || null,
            })),
        }),
      });
      closeForm();
      setSuccess(editingChecklistId ? "Task checklist updated." : "Task checklist created.");
      await loadData();
    } catch (nextError) {
      setError(nextError.message || "Failed to save checklist");
    } finally {
      setSaving(false);
    }
  }

  async function deleteChecklist(id) {
    if (!confirm("Delete this checklist and all of its items? This cannot be undone.")) return;
    setError("");
    try {
      await apiJson("/api/v1/daily-checklists", {
        method: "DELETE",
        body: JSON.stringify({ id }),
      });
      await loadData();
    } catch (nextError) {
      setError(nextError.message || "Failed to delete checklist");
    }
  }

  async function toggleActive(id, currentActive) {
    setError("");
    try {
      await apiJson("/api/v1/daily-checklists", {
        method: "PUT",
        body: JSON.stringify({ id, active: !currentActive }),
      });
      await loadData();
    } catch (nextError) {
      setError(nextError.message || "Failed to update checklist status");
    }
  }

  function addItemRow() {
    setNewItems((current) => [...current, blankItemRow()]);
  }

  function removeItemRow(index) {
    setNewItems((current) => current.filter((_, rowIndex) => rowIndex !== index));
  }

  function updateItemRow(index, field, value) {
    setNewItems((current) =>
      current.map((item, rowIndex) =>
        rowIndex === index ? { ...item, [field]: value } : item,
      ),
    );
  }

  const filtered = useMemo(() => {
    const needle = String(search || "").trim().toLowerCase();
    return checklists.filter((checklist) => {
      if (filterCategory && checklist.category !== filterCategory) return false;
      if (filterFrequency && checklist.frequency !== filterFrequency) return false;
      if (!needle) return true;

      const haystack = [
        checklist.title,
        checklist.description,
        checklist.classRoom?.name,
        checklist.assignedUser?.name,
        checklist.assignedUser?.email,
        ...(checklist.items || []).flatMap((item) => [
          item.title,
          item.description,
          item.lesson?.title,
          item.policyDocument?.title,
          item.directLinkLabel,
        ]),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(needle);
    });
  }, [checklists, filterCategory, filterFrequency, search]);

  const grouped = useMemo(() => {
    const map = {};
    for (const checklist of filtered) {
      if (!map[checklist.category]) map[checklist.category] = [];
      map[checklist.category].push(checklist);
    }
    return map;
  }, [filtered]);

  const countsByCategory = useMemo(() => {
    const counts = {};
    for (const checklist of checklists) {
      counts[checklist.category] = (counts[checklist.category] || 0) + 1;
    }
    return counts;
  }, [checklists]);

  return (
    <div className="space-y-4">
      {error ? (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <span className="font-semibold">Error:</span>
          <span>{error}</span>
          <button type="button" onClick={() => setError("")} className="ml-auto text-red-400 hover:text-red-600">
            &times;
          </button>
        </div>
      ) : null}

      {success ? (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          <span className="font-semibold">Saved.</span>
          <span>{success}</span>
          <button type="button" onClick={() => setSuccess("")} className="ml-auto text-emerald-400 hover:text-emerald-600">
            &times;
          </button>
        </div>
      ) : null}

      <div className="rounded-2xl border border-gray-200 bg-white p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex flex-wrap items-end gap-3">
            <button
              type="button"
              onClick={() => (showCreate ? closeForm() : openCreate())}
              className={[
                "inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all",
                showCreate
                  ? "bg-gray-100 text-gray-700 ring-1 ring-gray-200"
                  : "bg-sky-600 text-white shadow-sm hover:bg-sky-700",
              ].join(" ")}
            >
              <span className="text-base leading-none">+</span>
              {showCreate ? "Cancel" : "New Task Checklist"}
            </button>

            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search checklists, tasks, lessons, or staff..."
              className="w-72 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm focus:border-sky-300 focus:bg-white focus:outline-none focus:ring-1 focus:ring-sky-200"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <select
              value={filterFrequency}
              onChange={(event) => setFilterFrequency(event.target.value)}
              className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm focus:border-sky-300 focus:bg-white focus:outline-none focus:ring-1 focus:ring-sky-200"
            >
              <option value="">All repeats</option>
              {FREQUENCY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            <select
              value={filterCategory}
              onChange={(event) => setFilterCategory(event.target.value)}
              className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm focus:border-sky-300 focus:bg-white focus:outline-none focus:ring-1 focus:ring-sky-200"
            >
              <option value="">All categories</option>
              {CATEGORY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                  {countsByCategory[option.value] ? ` (${countsByCategory[option.value]})` : ""}
                </option>
              ))}
            </select>
          </div>
        </div>

        {showCreate ? (
          <form onSubmit={saveChecklist} className="mt-4 space-y-4 border-t border-gray-100 pt-4">
            <h3 className="text-sm font-bold text-gray-900">
              {editingChecklistId ? "Edit Task Checklist" : "New Task Checklist"}
            </h3>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
              <label className="block">
                <div className="mb-1 text-xs font-semibold text-gray-500">Checklist Title *</div>
                <input
                  value={newTitle}
                  onChange={(event) => setNewTitle(event.target.value)}
                  placeholder="e.g. Monday Opening Tasks"
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm focus:border-sky-300 focus:bg-white focus:outline-none focus:ring-1 focus:ring-sky-200"
                />
              </label>
              <label className="block">
                <div className="mb-1 text-xs font-semibold text-gray-500">Category</div>
                <select
                  value={newCategory}
                  onChange={(event) => setNewCategory(event.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm focus:border-sky-300 focus:bg-white focus:outline-none focus:ring-1 focus:ring-sky-200"
                >
                  {CATEGORY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <div className="mb-1 text-xs font-semibold text-gray-500">Repeat</div>
                <select
                  value={newFrequency}
                  onChange={(event) => {
                    const next = event.target.value;
                    setNewFrequency(next);
                    if (next !== "WEEKLY") setNewRepeatDays([]);
                    if (next !== "MONTHLY") setNewMonthlyDay("");
                  }}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm focus:border-sky-300 focus:bg-white focus:outline-none focus:ring-1 focus:ring-sky-200"
                >
                  {FREQUENCY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <div className="mb-1 text-xs font-semibold text-gray-500">Classroom</div>
                <select
                  value={newClassRoomId}
                  onChange={(event) => setNewClassRoomId(event.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm focus:border-sky-300 focus:bg-white focus:outline-none focus:ring-1 focus:ring-sky-200"
                >
                  <option value="">All classrooms</option>
                  {classrooms.map((room) => (
                    <option key={room.id} value={room.id}>
                      {room.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <div className="mb-1 text-xs font-semibold text-gray-500">Teacher / Staff</div>
                <select
                  value={newAssignedUserId}
                  onChange={(event) => setNewAssignedUserId(event.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm focus:border-sky-300 focus:bg-white focus:outline-none focus:ring-1 focus:ring-sky-200"
                >
                  <option value="">Anyone in scope</option>
                  {staffMembers.map((user) => (
                    <option key={user.id} value={user.id}>
                      {(user.name || user.email) + ` (${roleLabel(user.role)})`}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block md:col-span-2 lg:col-span-3">
                <div className="mb-1 text-xs font-semibold text-gray-500">Description</div>
                <input
                  value={newDescription}
                  onChange={(event) => setNewDescription(event.target.value)}
                  placeholder="Optional context for this checklist."
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm focus:border-sky-300 focus:bg-white focus:outline-none focus:ring-1 focus:ring-sky-200"
                />
              </label>
            </div>

            {newFrequency === "WEEKLY" ? (
              <div>
                <div className="mb-2 text-xs font-semibold text-gray-500">Show on these weekdays</div>
                <div className="flex flex-wrap gap-2">
                  {WEEKDAY_OPTIONS.map((option) => {
                    const active = normalizeRepeatDays(newRepeatDays).includes(option.value);
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setNewRepeatDays((current) => toggleRepeatDay(current, option.value))}
                        className={[
                          "rounded-full px-3 py-1.5 text-xs font-semibold transition",
                          active
                            ? "bg-sky-600 text-white"
                            : "border border-gray-200 bg-white text-gray-700 hover:bg-gray-50",
                        ].join(" ")}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {newFrequency === "MONTHLY" ? (
              <label className="block max-w-xs">
                <div className="mb-1 text-xs font-semibold text-gray-500">Day of month</div>
                <input
                  type="number"
                  min="1"
                  max="31"
                  value={newMonthlyDay}
                  onChange={(event) => setNewMonthlyDay(event.target.value)}
                  placeholder="20"
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm focus:border-sky-300 focus:bg-white focus:outline-none focus:ring-1 focus:ring-sky-200"
                />
              </label>
            ) : null}

            <div>
              <div className="mb-2 flex items-center justify-between">
                <div className="text-xs font-semibold text-gray-500">Checklist Items</div>
                <button
                  type="button"
                  onClick={addItemRow}
                  className="rounded-lg px-3 py-1.5 text-xs font-semibold text-sky-600 hover:bg-sky-50"
                >
                  + Add Item
                </button>
              </div>

              <div className="space-y-3">
                {newItems.map((item, index) => (
                  <div key={item.id || index} className="rounded-2xl border border-gray-200 bg-gray-50/60 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-gray-500">
                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-gray-700">
                          {index + 1}
                        </span>
                        Task Item
                      </div>
                      <button
                        type="button"
                        onClick={() => removeItemRow(index)}
                        disabled={newItems.length <= 1}
                        className="rounded-lg px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-40"
                      >
                        Remove
                      </button>
                    </div>

                    <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                      <label className="block">
                        <div className="mb-1 text-xs font-semibold text-gray-500">Time</div>
                        <input
                          type="time"
                          value={item.taskTime || ""}
                          onChange={(event) => updateItemRow(index, "taskTime", event.target.value)}
                          className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm focus:border-sky-300 focus:outline-none focus:ring-1 focus:ring-sky-200"
                        />
                      </label>
                      <label className="block xl:col-span-2">
                        <div className="mb-1 text-xs font-semibold text-gray-500">Task *</div>
                        <input
                          value={item.title}
                          onChange={(event) => updateItemRow(index, "title", event.target.value)}
                          placeholder="e.g. Complete lunch activity log"
                          className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm focus:border-sky-300 focus:outline-none focus:ring-1 focus:ring-sky-200"
                        />
                      </label>
                      <label className="block">
                        <div className="mb-1 text-xs font-semibold text-gray-500">Lesson</div>
                        <select
                          value={item.lessonId}
                          onChange={(event) => updateItemRow(index, "lessonId", event.target.value)}
                          className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm focus:border-sky-300 focus:outline-none focus:ring-1 focus:ring-sky-200"
                        >
                          <option value="">No linked lesson</option>
                          {lessons.map((lesson) => (
                            <option key={lesson.id} value={lesson.id}>
                              {lesson.title}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="block xl:col-span-2">
                        <div className="mb-1 text-xs font-semibold text-gray-500">Details</div>
                        <input
                          value={item.description}
                          onChange={(event) => updateItemRow(index, "description", event.target.value)}
                          placeholder="Optional instructions or notes"
                          className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm focus:border-sky-300 focus:outline-none focus:ring-1 focus:ring-sky-200"
                        />
                      </label>
                      <label className="block">
                        <div className="mb-1 text-xs font-semibold text-gray-500">Policy</div>
                        <select
                          value={item.policyDocumentId}
                          onChange={(event) => updateItemRow(index, "policyDocumentId", event.target.value)}
                          className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm focus:border-sky-300 focus:outline-none focus:ring-1 focus:ring-sky-200"
                        >
                          <option value="">No linked policy</option>
                          {policies.map((policy) => (
                            <option key={policy.id} value={policy.id}>
                              {policy.title}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="block">
                        <div className="mb-1 text-xs font-semibold text-gray-500">Direct Link Label</div>
                        <input
                          value={item.directLinkLabel}
                          onChange={(event) => updateItemRow(index, "directLinkLabel", event.target.value)}
                          placeholder="e.g. Open Activity Log"
                          className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm focus:border-sky-300 focus:outline-none focus:ring-1 focus:ring-sky-200"
                        />
                      </label>
                      <label className="block xl:col-span-2">
                        <div className="mb-1 text-xs font-semibold text-gray-500">Direct Link URL / Route</div>
                        <input
                          value={item.directLink}
                          onChange={(event) => updateItemRow(index, "directLink", event.target.value)}
                          placeholder="e.g. /teacher/logs?centerId=..."
                          className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm focus:border-sky-300 focus:outline-none focus:ring-1 focus:ring-sky-200"
                        />
                      </label>
                      <label className="block">
                        <div className="mb-1 text-xs font-semibold text-gray-500">Reference URL</div>
                        <input
                          value={item.policyLink}
                          onChange={(event) => updateItemRow(index, "policyLink", event.target.value)}
                          placeholder="Optional external/internal reference"
                          className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm focus:border-sky-300 focus:outline-none focus:ring-1 focus:ring-sky-200"
                        />
                      </label>
                      <label className="block">
                        <div className="mb-1 text-xs font-semibold text-gray-500">Training Video URL</div>
                        <input
                          value={item.mediaLink}
                          onChange={(event) => updateItemRow(index, "mediaLink", event.target.value)}
                          placeholder="Optional video URL"
                          className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm focus:border-sky-300 focus:outline-none focus:ring-1 focus:ring-sky-200"
                        />
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="submit"
                disabled={saving}
                className="rounded-xl bg-sky-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-sky-700 disabled:opacity-50"
              >
                {saving ? "Saving..." : editingChecklistId ? "Save Checklist" : "Create Checklist"}
              </button>
              <button
                type="button"
                onClick={closeForm}
                className="rounded-xl px-4 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-100"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : null}
      </div>

      {loading ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-6">
          <Skeleton count={6} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-300 bg-white py-14 text-center">
          <div className="text-sm font-bold text-gray-900">
            {search || filterCategory || filterFrequency ? "No matching task checklists" : "No task checklists yet"}
          </div>
          <p className="mt-1 max-w-md text-xs text-gray-500">
            {search || filterCategory || filterFrequency
              ? "Adjust the filters or search terms and try again."
              : "Create a recurring checklist and assign it to a classroom or staff member so it appears on the right day."}
          </p>
        </div>
      ) : (
        Object.entries(grouped).map(([categoryKey, lists]) => {
          const category = CATEGORY_OPTIONS.find((option) => option.value === categoryKey);
          const styles = CATEGORY_STYLES[categoryKey] || CATEGORY_STYLES.OTHER;

          return (
            <div key={categoryKey} className="space-y-2">
              <div className="flex items-center gap-2">
                <div className={`h-3 w-3 rounded-sm border-l-4 ${styles.bg} ${styles.border}`} />
                <h3 className="text-xs font-extrabold uppercase tracking-wide text-gray-500">
                  {category?.label || categoryKey}
                  <span className="ml-1.5 font-semibold text-gray-400">({lists.length})</span>
                </h3>
              </div>

              {lists.map((checklist) => {
                const stylesForCard = CATEGORY_STYLES[checklist.category] || CATEGORY_STYLES.OTHER;
                const items = sortByTaskTime(checklist.items);
                const expanded = expandedId === checklist.id;
                return (
                  <div
                    key={checklist.id}
                    className={[
                      "overflow-hidden rounded-2xl border-l-4 border bg-white transition-shadow",
                      stylesForCard.border,
                      checklist.active ? "border-gray-200" : "border-gray-200 opacity-55",
                      expanded ? "shadow-md" : "hover:shadow-sm",
                    ].join(" ")}
                  >
                    <div className="flex items-center gap-3 p-4">
                      <button
                        type="button"
                        className="flex min-w-0 flex-1 items-center gap-3 text-left"
                        onClick={() => setExpandedId(expanded ? "" : checklist.id)}
                      >
                        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${stylesForCard.bg} ${stylesForCard.text}`}>
                          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-bold text-gray-900">{checklist.title}</span>
                            <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${FREQUENCY_STYLES[checklist.frequency] || FREQUENCY_STYLES.DAILY}`}>
                              {describeChecklistSchedule(checklist)}
                            </span>
                            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-600">
                              {items.length} {items.length === 1 ? "item" : "items"}
                            </span>
                            {checklist.classRoom ? (
                              <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-semibold text-sky-700">
                                {checklist.classRoom.name}
                              </span>
                            ) : null}
                            {checklist.assignedUser ? (
                              <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[11px] font-semibold text-violet-700">
                                {checklist.assignedUser.name || checklist.assignedUser.email}
                              </span>
                            ) : null}
                            {!checklist.active ? (
                              <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-bold text-red-600">
                                Inactive
                              </span>
                            ) : null}
                          </div>
                          {checklist.description ? (
                            <p className="mt-1 text-xs text-gray-500">{checklist.description}</p>
                          ) : null}
                        </div>

                        <svg
                          className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${expanded ? "rotate-180" : ""}`}
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                        </svg>
                      </button>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => openEdit(checklist)}
                          className="rounded-lg px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-sky-50 hover:text-sky-700"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleActive(checklist.id, checklist.active)}
                          className={[
                            "rounded-lg px-3 py-1.5 text-xs font-semibold",
                            checklist.active
                              ? "text-gray-600 hover:bg-gray-100"
                              : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100",
                          ].join(" ")}
                        >
                          {checklist.active ? "Deactivate" : "Activate"}
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteChecklist(checklist.id)}
                          className="rounded-lg px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50"
                        >
                          Delete
                        </button>
                      </div>
                    </div>

                    {expanded ? (
                      <div className="border-t border-gray-100 bg-gray-50/30 p-4">
                        {items.length === 0 ? (
                          <p className="text-sm text-gray-500">No items have been added to this checklist yet.</p>
                        ) : (
                          <div className="space-y-2">
                            {items.map((item, index) => {
                              const links = summaryForItem(item);
                              return (
                                <div key={item.id} className="rounded-xl border border-gray-200 bg-white p-3">
                                  <div className="flex items-start gap-3">
                                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-[11px] font-bold text-gray-600">
                                      {index + 1}
                                    </span>
                                    <div className="min-w-0 flex-1">
                                      {item.taskTime ? (
                                        <div className="mb-1 text-[10px] font-bold uppercase tracking-wide text-sky-600">
                                          {formatTaskTime(item.taskTime)}
                                        </div>
                                      ) : null}
                                      <div className="text-sm font-semibold text-gray-900">{item.title}</div>
                                      {item.description ? (
                                        <p className="mt-1 text-xs text-gray-500">{item.description}</p>
                                      ) : null}
                                      {links.length ? (
                                        <div className="mt-2 flex flex-wrap gap-1.5">
                                          {links.map((label) => (
                                            <span key={label} className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-700">
                                              {label}
                                            </span>
                                          ))}
                                        </div>
                                      ) : null}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    ) : null}
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
