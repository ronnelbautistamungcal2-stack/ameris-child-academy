import Skeleton from "@/components/ui/Skeleton";
import { apiJson } from "@/lib/api";
import {
  getChecklistClassRooms,
  normalizeChecklistClassRoomIds,
} from "@/lib/dailyChecklistClassrooms";
import { getChecklistAssignedUsers } from "@/lib/dailyChecklistAssignees";
import {
  CHECKLIST_FREQUENCY_OPTIONS,
  MONTHLY_WEEK_OPTIONS,
  WEEKDAY_OPTIONS,
  describeChecklistSchedule,
  formatDateInputValue,
  getEffectiveItemSchedule,
  normalizeMonthlyDay,
  normalizeMonthlyWeek,
  normalizeMonthlyWeekday,
  normalizeOneTimeDate,
  normalizeRepeatDays,
  summarizeChecklistFrequency,
  summarizeChecklistSchedule,
} from "@/lib/checklistSchedule";
import {
  LESSON_SOURCE_OPTIONS,
  lessonOptionLabel,
  normalizeLessonSource,
} from "@/lib/lessonScheduling";
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

const FREQUENCY_OPTIONS = CHECKLIST_FREQUENCY_OPTIONS;

const FREQUENCY_STYLES = {
  DAILY: "bg-sky-50 text-sky-700",
  WEEKLY: "bg-violet-50 text-violet-700",
  MONTHLY: "bg-amber-50 text-amber-700",
  ONE_TIME: "bg-rose-50 text-rose-700",
  MIXED: "bg-slate-100 text-slate-700",
};

function blankItemRow() {
  return {
    title: "",
    description: "",
    frequency: "DAILY",
    repeatDays: [],
    monthlyMode: "DAY",
    monthlyDay: "",
    monthlyWeek: "",
    monthlyWeekday: "",
    oneTimeDate: "",
    lessonSource: "NONE",
    lessonSlot: "",
    lessonCategoryId: "",
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

function lessonCategoryLabel(category) {
  if (!category) return "";
  const parts = [category.name || ""];
  if (category.ageRange) parts.push(category.ageRange);
  return parts.filter(Boolean).join(" | ");
}

function summaryForItem(item) {
  const labels = [];
  labels.push(`Repeat: ${describeChecklistSchedule(item)}`);
  const lessonSource = normalizeLessonSource(
    item.lessonSource,
    item.lessonId,
    item.lessonSlot,
  );
  if (lessonSource === "AUTO_SLOT" && item.lessonSlot) {
    labels.push(`Auto lesson slot: ${item.lessonSlot}`);
    if (item.lessonCategory?.name) {
      labels.push(`Lesson bank: ${lessonCategoryLabel(item.lessonCategory)}`);
    }
  } else if (item.lesson?.title) {
    labels.push(`Lesson: ${item.lesson.title}`);
  }
  if (item.policyDocument?.title) labels.push(`Policy: ${item.policyDocument.title}`);
  if (item.directLink) labels.push(item.directLinkLabel || "Direct link");
  if (item.mediaLink) labels.push("Training video");
  if (item.policyLink) labels.push("Reference link");
  return labels;
}

function isValidMonthlySchedule(item) {
  if (item.monthlyMode === "WEEKDAY") {
    return normalizeMonthlyWeek(item.monthlyWeek) !== null && normalizeMonthlyWeekday(item.monthlyWeekday) !== null;
  }
  return !!normalizeMonthlyDay(item.monthlyDay);
}

function toggleRepeatDay(days, dayValue) {
  const set = new Set(normalizeRepeatDays(days));
  if (set.has(dayValue)) set.delete(dayValue);
  else set.add(dayValue);
  return [...set].sort((a, b) => a - b);
}

function toggleClassroomSelection(ids, classRoomId) {
  const set = new Set(normalizeChecklistClassRoomIds(ids));
  if (set.has(classRoomId)) set.delete(classRoomId);
  else set.add(classRoomId);
  return [...set];
}

function selectedClassroomSummary(classrooms, selectedIds) {
  const selected = classrooms.filter((room) => selectedIds.includes(room.id));
  if (!selected.length) {
    return {
      title: "All classrooms",
    };
  }
  if (selected.length === 1) {
    return {
      title: selected[0].name,
    };
  }
  return {
    title: `${selected.length} classrooms selected`,
  };
}

function toggleAssigneeSelection(ids, userId) {
  const set = new Set(ids);
  if (set.has(userId)) set.delete(userId);
  else set.add(userId);
  return [...set];
}

function selectedAssigneeSummary(staffMembers, selectedIds) {
  const selected = staffMembers.filter((user) => selectedIds.includes(user.id));
  if (!selected.length) {
    return {
      title: "Anyone in scope",
    };
  }
  if (selected.length === 1) {
    return {
      title: selected[0].name || selected[0].email,
    };
  }
  return {
    title: `${selected.length} staff selected`,
  };
}

function blankTermCalendarRow() {
  return {
    term: "",
    startDate: "",
    endDate: "",
  };
}

function checklistMatchesFrequency(checklist, frequency) {
  if (!frequency) return true;
  return (checklist.items || []).some(
    (item) => getEffectiveItemSchedule(item, checklist).frequency === frequency,
  );
}

export default function AdminTaskChecklistManager({ centerId }) {
  const [checklists, setChecklists] = useState([]);
  const [classrooms, setClassrooms] = useState([]);
  const [lessons, setLessons] = useState([]);
  const [lessonCategories, setLessonCategories] = useState([]);
  const [termCalendars, setTermCalendars] = useState([blankTermCalendarRow()]);
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
  const [newClassRoomIds, setNewClassRoomIds] = useState([]);
  const [classroomAccordionOpen, setClassroomAccordionOpen] = useState(false);
  const [newAssignedUserIds, setNewAssignedUserIds] = useState([]);
  const [assigneeAccordionOpen, setAssigneeAccordionOpen] = useState(false);
  const [newItems, setNewItems] = useState([blankItemRow()]);
  const [saving, setSaving] = useState(false);
  const [savingTermCalendars, setSavingTermCalendars] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [lists, rooms, lessonRows, categoryRows, calendarRows, policyRows, userRows] = await Promise.all([
        apiJson(`/api/v1/daily-checklists?centerId=${encodeURIComponent(centerId)}`),
        apiJson(`/api/v1/classes?centerId=${encodeURIComponent(centerId)}`),
        apiJson(`/api/v1/lessons?centerId=${encodeURIComponent(centerId)}`),
        apiJson(`/api/v1/lesson-categories?centerId=${encodeURIComponent(centerId)}`).catch(() => []),
        apiJson(`/api/v1/lesson-term-calendars?centerId=${encodeURIComponent(centerId)}`).catch(() => []),
        apiJson(`/api/v1/policies?centerId=${encodeURIComponent(centerId)}`).catch(() => []),
        apiJson(`/api/v1/users?centerId=${encodeURIComponent(centerId)}&roles=TEACHER,OTHER_STAFF,COACH`),
      ]);
      setChecklists(Array.isArray(lists) ? lists : []);
      setClassrooms(Array.isArray(rooms) ? rooms : []);
      setLessons(Array.isArray(lessonRows) ? lessonRows : []);
      setLessonCategories(Array.isArray(categoryRows) ? categoryRows : []);
      setTermCalendars(
        Array.isArray(calendarRows) && calendarRows.length
          ? calendarRows.map((row) => ({
              term: row.term || "",
              startDate: formatDateInputValue(row.startDate),
              endDate: formatDateInputValue(row.endDate),
            }))
          : [blankTermCalendarRow()],
      );
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
    setNewClassRoomIds([]);
    setClassroomAccordionOpen(false);
    setNewAssignedUserIds([]);
    setAssigneeAccordionOpen(false);
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
    setNewClassRoomIds(normalizeChecklistClassRoomIds(checklist.classRoomIds, checklist.classRoomId));
    setNewAssignedUserIds(
      Array.isArray(checklist.assignedUserIds) && checklist.assignedUserIds.length
        ? checklist.assignedUserIds
        : checklist.assignedUserId
          ? [checklist.assignedUserId]
          : [],
    );
    const rows = sortByTaskTime(checklist.items).map((item) => {
      const schedule = getEffectiveItemSchedule(item, checklist);
      const lessonSource = normalizeLessonSource(
        item.lessonSource,
        item.lessonId,
        item.lessonSlot,
      );
      return {
        id: item.id,
        title: item.title || "",
        description: item.description || "",
        frequency: schedule.frequency,
        repeatDays: schedule.repeatDays,
        monthlyMode: schedule.monthlyWeek && schedule.monthlyWeekday !== null ? "WEEKDAY" : "DAY",
        monthlyDay: schedule.monthlyDay
          ? String(schedule.monthlyDay)
          : "",
        monthlyWeek: schedule.monthlyWeek ? String(schedule.monthlyWeek) : "",
        monthlyWeekday:
          schedule.monthlyWeekday !== null && schedule.monthlyWeekday !== undefined
            ? String(schedule.monthlyWeekday)
            : "",
        oneTimeDate: schedule.oneTimeDate
          ? formatDateInputValue(schedule.oneTimeDate)
          : "",
        lessonSource,
        lessonSlot: item.lessonSlot || "",
        lessonCategoryId: lessonSource === "AUTO_SLOT" ? item.lessonCategoryId || "" : "",
        lessonId: lessonSource === "FIXED" ? item.lessonId || "" : "",
        policyDocumentId: item.policyDocumentId || "",
        directLinkLabel: item.directLinkLabel || "",
        directLink: item.directLink || "",
        policyLink: item.policyLink || "",
        mediaLink: item.mediaLink || "",
        taskTime: item.taskTime || "",
      };
    });
    setNewItems(rows.length ? rows : [blankItemRow()]);
    setShowCreate(true);
  }

  function validateForm() {
    if (!newTitle.trim()) return "Checklist title is required.";
    if (!newItems.some((item) => item.title.trim())) {
      return "Add at least one task item.";
    }
    const invalidItem = newItems.find((item) => {
      if (!item.title.trim()) return false;
      if (item.frequency === "WEEKLY") {
        return normalizeRepeatDays(item.repeatDays).length === 0;
      }
      if (item.frequency === "MONTHLY") {
        return !isValidMonthlySchedule(item);
      }
      if (item.frequency === "ONE_TIME") {
        return !normalizeOneTimeDate(item.oneTimeDate);
      }
      if (
        normalizeLessonSource(item.lessonSource, item.lessonId, item.lessonSlot) ===
          "AUTO_SLOT" &&
        !String(item.lessonSlot || "").trim()
      ) {
        return true;
      }
      return false;
    });
    if (invalidItem) {
      const itemNumber = newItems.indexOf(invalidItem) + 1;
      if (invalidItem.frequency === "WEEKLY") {
        return `Task item ${itemNumber} must include at least one weekday.`;
      }
      if (invalidItem.frequency === "MONTHLY") {
        return invalidItem.monthlyMode === "WEEKDAY"
          ? `Task item ${itemNumber} needs a week and weekday selected (e.g. 2nd Tuesday).`
          : `Task item ${itemNumber} needs a valid day of month between 1 and 31.`;
      }
      if (invalidItem.frequency === "ONE_TIME") {
        return `Task item ${itemNumber} needs a one-time date.`;
      }
      if (
        normalizeLessonSource(
          invalidItem.lessonSource,
          invalidItem.lessonId,
          invalidItem.lessonSlot,
        ) === "AUTO_SLOT"
      ) {
        return `Task item ${itemNumber} needs a lesson slot name for automatic matching.`;
      }
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
          classRoomIds: normalizeChecklistClassRoomIds(newClassRoomIds),
          assignedUserIds: newAssignedUserIds,
          items: newItems
            .filter((item) => item.title.trim())
            .map((item) => ({
              id: item.id,
              title: item.title.trim(),
              description: item.description.trim() || null,
              frequency: item.frequency || "DAILY",
              repeatDays: item.frequency === "WEEKLY" ? normalizeRepeatDays(item.repeatDays) : [],
              monthlyDay:
                item.frequency === "MONTHLY" && item.monthlyMode !== "WEEKDAY"
                  ? normalizeMonthlyDay(item.monthlyDay)
                  : null,
              monthlyWeek:
                item.frequency === "MONTHLY" && item.monthlyMode === "WEEKDAY"
                  ? normalizeMonthlyWeek(item.monthlyWeek)
                  : null,
              monthlyWeekday:
                item.frequency === "MONTHLY" && item.monthlyMode === "WEEKDAY"
                  ? normalizeMonthlyWeekday(item.monthlyWeekday)
                  : null,
              oneTimeDate: item.frequency === "ONE_TIME" ? item.oneTimeDate || null : null,
              lessonSource: normalizeLessonSource(
                item.lessonSource,
                item.lessonId,
                item.lessonSlot,
              ),
              lessonSlot:
                normalizeLessonSource(item.lessonSource, item.lessonId, item.lessonSlot) ===
                "AUTO_SLOT"
                  ? String(item.lessonSlot || "").trim() || null
                  : null,
              lessonCategoryId:
                normalizeLessonSource(item.lessonSource, item.lessonId, item.lessonSlot) ===
                "AUTO_SLOT"
                  ? item.lessonCategoryId || null
                  : null,
              lessonId:
                normalizeLessonSource(item.lessonSource, item.lessonId, item.lessonSlot) ===
                "FIXED"
                  ? item.lessonId || null
                  : null,
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
      setSuccess(editingChecklistId ? "Checklist updated." : "Checklist created.");
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

  function addTermCalendarRow() {
    setTermCalendars((current) => [...current, blankTermCalendarRow()]);
  }

  function removeTermCalendarRow(index) {
    setTermCalendars((current) =>
      current.length <= 1
        ? [blankTermCalendarRow()]
        : current.filter((_, rowIndex) => rowIndex !== index),
    );
  }

  function updateTermCalendarRow(index, field, value) {
    setTermCalendars((current) =>
      current.map((row, rowIndex) =>
        rowIndex === index ? { ...row, [field]: value } : row,
      ),
    );
  }

  async function saveTermCalendarRows() {
    setSavingTermCalendars(true);
    setError("");
    setSuccess("");
    try {
      const saved = await apiJson(
        `/api/v1/lesson-term-calendars?centerId=${encodeURIComponent(centerId)}`,
        {
          method: "PUT",
          body: JSON.stringify({
            calendars: termCalendars
              .map((row) => ({
                term: String(row.term || "").trim(),
                startDate: row.startDate || null,
                endDate: row.endDate || null,
              }))
              .filter((row) => row.term || row.startDate || row.endDate),
          }),
        },
      );
      setTermCalendars(
        Array.isArray(saved) && saved.length
          ? saved.map((row) => ({
              term: row.term || "",
              startDate: formatDateInputValue(row.startDate),
              endDate: formatDateInputValue(row.endDate),
            }))
          : [blankTermCalendarRow()],
      );
      setSuccess("Term calendar updated.");
    } catch (nextError) {
      setError(nextError.message || "Failed to save term calendar");
    } finally {
      setSavingTermCalendars(false);
    }
  }

  const filtered = useMemo(() => {
    const needle = String(search || "").trim().toLowerCase();
    return checklists.filter((checklist) => {
      if (filterCategory && checklist.category !== filterCategory) return false;
      if (!checklistMatchesFrequency(checklist, filterFrequency)) return false;
      if (!needle) return true;

      const haystack = [
        checklist.title,
        checklist.description,
        checklist.classRoom?.name,
        ...(checklist.classRooms || []).map((room) => room.name),
        checklist.assignedUser?.name,
        checklist.assignedUser?.email,
        ...getChecklistAssignedUsers(checklist).flatMap((user) => [user.name, user.email]),
        ...(checklist.items || []).flatMap((item) => [
          item.title,
          item.description,
          item.lesson?.title,
          item.lessonCategory?.name,
          item.lessonSlot,
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

  const selectedRooms = useMemo(
    () => classrooms.filter((room) => newClassRoomIds.includes(room.id)),
    [classrooms, newClassRoomIds],
  );

  const classroomScopeSummary = useMemo(
    () => selectedClassroomSummary(classrooms, newClassRoomIds),
    [classrooms, newClassRoomIds],
  );

  const selectedAssignees = useMemo(
    () => staffMembers.filter((user) => newAssignedUserIds.includes(user.id)),
    [staffMembers, newAssignedUserIds],
  );

  const assigneeScopeSummary = useMemo(
    () => selectedAssigneeSummary(staffMembers, newAssignedUserIds),
    [staffMembers, newAssignedUserIds],
  );

  const lessonSlotOptions = useMemo(() => {
    const values = new Set();

    for (const lesson of lessons) {
      if (lesson.lessonSlot) values.add(lesson.lessonSlot);
    }

    for (const checklist of checklists) {
      for (const item of checklist.items || []) {
        if (item.lessonSlot) values.add(item.lessonSlot);
      }
    }

    return [...values].sort((left, right) => left.localeCompare(right));
  }, [checklists, lessons]);

  const autoLessonCategoryOptions = useMemo(
    () =>
      lessonCategories
        .slice()
        .sort((left, right) => lessonCategoryLabel(left).localeCompare(lessonCategoryLabel(right))),
    [lessonCategories],
  );

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
            {showCreate ? "Cancel" : "New Checklist"}
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
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-bold text-gray-900">
                {editingChecklistId ? "Edit Checklist" : "New Checklist"}
              </h3>
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
            </div>
            <datalist id="lesson-slot-options">
              {lessonSlotOptions.map((slot) => (
                <option key={slot} value={slot} />
              ))}
            </datalist>

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
                <div className="mb-1 text-xs font-semibold text-gray-500">Classrooms</div>
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                  <button
                    type="button"
                    onClick={() => setClassroomAccordionOpen((current) => !current)}
                    className="flex w-full items-center justify-between gap-3 text-left"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-gray-900">
                        {classroomScopeSummary.title}
                      </div>
                    </div>
                    <svg
                      className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${classroomAccordionOpen ? "rotate-180" : ""}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                    </svg>
                  </button>

                  {classroomAccordionOpen ? (
                    <div className="mt-3 space-y-2 border-t border-gray-200 pt-3">
                      <label className="flex cursor-pointer items-center gap-3 rounded-lg bg-white px-3 py-2 text-sm text-gray-700">
                        <input
                          type="checkbox"
                          checked={newClassRoomIds.length === 0}
                          onChange={() => setNewClassRoomIds([])}
                          className="h-4 w-4 rounded border-gray-300 text-sky-600 focus:ring-sky-500"
                        />
                        <span className="font-medium">All classrooms</span>
                      </label>

                      <div className="space-y-2">
                        {classrooms.map((room) => {
                          const selected = newClassRoomIds.includes(room.id);
                          return (
                            <label
                              key={room.id}
                              className="flex cursor-pointer items-center gap-3 rounded-lg bg-white px-3 py-2 text-sm text-gray-700"
                            >
                              <input
                                type="checkbox"
                                checked={selected}
                                onChange={() =>
                                  setNewClassRoomIds((current) => toggleClassroomSelection(current, room.id))
                                }
                                className="h-4 w-4 rounded border-gray-300 text-sky-600 focus:ring-sky-500"
                              />
                              <span>{room.name}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}

                  {selectedRooms.length ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {selectedRooms.map((room) => (
                        <span
                          key={room.id}
                          className="rounded-full bg-sky-100 px-2.5 py-1 text-[11px] font-medium text-sky-700"
                        >
                          {room.name}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
              </label>
              <label className="block">
                <div className="mb-1 text-xs font-semibold text-gray-500">Teacher / Staff</div>
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                  <button
                    type="button"
                    onClick={() => setAssigneeAccordionOpen((current) => !current)}
                    className="flex w-full items-center justify-between gap-3 text-left"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-gray-900">
                        {assigneeScopeSummary.title}
                      </div>
                    </div>
                    <svg
                      className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${assigneeAccordionOpen ? "rotate-180" : ""}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                    </svg>
                  </button>

                  {assigneeAccordionOpen ? (
                    <div className="mt-3 space-y-2 border-t border-gray-200 pt-3">
                      <label className="flex cursor-pointer items-center gap-3 rounded-lg bg-white px-3 py-2 text-sm text-gray-700">
                        <input
                          type="checkbox"
                          checked={newAssignedUserIds.length === 0}
                          onChange={() => setNewAssignedUserIds([])}
                          className="h-4 w-4 rounded border-gray-300 text-sky-600 focus:ring-sky-500"
                        />
                        <span className="font-medium">Anyone in scope</span>
                      </label>

                      <div className="space-y-2">
                        {staffMembers.map((user) => {
                          const selected = newAssignedUserIds.includes(user.id);
                          return (
                            <label
                              key={user.id}
                              className="flex cursor-pointer items-center gap-3 rounded-lg bg-white px-3 py-2 text-sm text-gray-700"
                            >
                              <input
                                type="checkbox"
                                checked={selected}
                                onChange={() =>
                                  setNewAssignedUserIds((current) => toggleAssigneeSelection(current, user.id))
                                }
                                className="h-4 w-4 rounded border-gray-300 text-sky-600 focus:ring-sky-500"
                              />
                              <span>{user.name || user.email}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}

                  {selectedAssignees.length ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {selectedAssignees.map((user) => (
                        <span
                          key={user.id}
                          className="rounded-full bg-violet-100 px-2.5 py-1 text-[11px] font-medium text-violet-700"
                        >
                          {user.name || user.email}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
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

            <div className="rounded-xl border border-sky-100 bg-sky-50 px-4 py-3 text-sm text-sky-900">
              Each checklist item now has its own repeat schedule. You can mix daily, weekly, monthly, and one-time tasks in the same checklist.
            </div>

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

                    <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-6">
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
                        <div className="mb-1 text-xs font-semibold text-gray-500">Repeat</div>
                        <select
                          value={item.frequency || "DAILY"}
                          onChange={(event) => {
                            const next = event.target.value;
                            updateItemRow(index, "frequency", next);
                            if (next !== "WEEKLY") updateItemRow(index, "repeatDays", []);
                            if (next !== "MONTHLY") {
                              updateItemRow(index, "monthlyMode", "DAY");
                              updateItemRow(index, "monthlyDay", "");
                              updateItemRow(index, "monthlyWeek", "");
                              updateItemRow(index, "monthlyWeekday", "");
                            }
                            if (next !== "ONE_TIME") updateItemRow(index, "oneTimeDate", "");
                          }}
                          className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm focus:border-sky-300 focus:outline-none focus:ring-1 focus:ring-sky-200"
                        >
                          {FREQUENCY_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="block">
                        <div className="mb-1 text-xs font-semibold text-gray-500">Lesson Source</div>
                        <select
                          value={normalizeLessonSource(item.lessonSource, item.lessonId, item.lessonSlot)}
                          onChange={(event) => {
                            const nextSource = event.target.value;
                            updateItemRow(index, "lessonSource", nextSource);
                            if (nextSource !== "FIXED") updateItemRow(index, "lessonId", "");
                            if (nextSource !== "AUTO_SLOT") updateItemRow(index, "lessonSlot", "");
                            if (nextSource !== "AUTO_SLOT") updateItemRow(index, "lessonCategoryId", "");
                          }}
                          className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm focus:border-sky-300 focus:outline-none focus:ring-1 focus:ring-sky-200"
                        >
                          {LESSON_SOURCE_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      {normalizeLessonSource(item.lessonSource, item.lessonId, item.lessonSlot) === "FIXED" ? (
                        <label className="block">
                          <div className="mb-1 text-xs font-semibold text-gray-500">Fixed Lesson</div>
                          <select
                            value={item.lessonId}
                            onChange={(event) => updateItemRow(index, "lessonId", event.target.value)}
                            className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm focus:border-sky-300 focus:outline-none focus:ring-1 focus:ring-sky-200"
                          >
                            <option value="">Select a lesson</option>
                            {lessons.map((lesson) => (
                              <option key={lesson.id} value={lesson.id}>
                                {lessonOptionLabel(lesson)}
                              </option>
                            ))}
                          </select>
                        </label>
                      ) : null}
                      {normalizeLessonSource(item.lessonSource, item.lessonId, item.lessonSlot) === "AUTO_SLOT" ? (
                        <>
                          <label className="block">
                            <div className="mb-1 text-xs font-semibold text-gray-500">Lesson Slot</div>
                            <input
                              list="lesson-slot-options"
                              value={item.lessonSlot}
                              onChange={(event) => updateItemRow(index, "lessonSlot", event.target.value)}
                              placeholder="e.g. Large Group 1"
                              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm focus:border-sky-300 focus:outline-none focus:ring-1 focus:ring-sky-200"
                            />
                          </label>
                          <label className="block">
                            <div className="mb-1 text-xs font-semibold text-gray-500">Lesson Bank</div>
                            <select
                              value={item.lessonCategoryId || ""}
                              onChange={(event) => updateItemRow(index, "lessonCategoryId", event.target.value)}
                              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm focus:border-sky-300 focus:outline-none focus:ring-1 focus:ring-sky-200"
                            >
                              <option value="">Any lesson category</option>
                              {autoLessonCategoryOptions.map((category) => (
                                <option key={category.id} value={category.id}>
                                  {lessonCategoryLabel(category)}
                                </option>
                              ))}
                            </select>
                          </label>
                        </>
                      ) : null}
                      <label className="block xl:col-span-2">
                        <div className="mb-1 text-xs font-semibold text-gray-500">Details</div>
                        <input
                          value={item.description}
                          onChange={(event) => updateItemRow(index, "description", event.target.value)}
                          placeholder="Optional instructions or notes"
                          className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm focus:border-sky-300 focus:outline-none focus:ring-1 focus:ring-sky-200"
                        />
                      </label>
                      <label className="block xl:col-span-2">
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
                      <label className="block xl:col-span-2">
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
                      <label className="block xl:col-span-2">
                        <div className="mb-1 text-xs font-semibold text-gray-500">Reference URL</div>
                        <input
                          value={item.policyLink}
                          onChange={(event) => updateItemRow(index, "policyLink", event.target.value)}
                          placeholder="Optional external/internal reference"
                          className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm focus:border-sky-300 focus:outline-none focus:ring-1 focus:ring-sky-200"
                        />
                      </label>
                      <label className="block xl:col-span-2">
                        <div className="mb-1 text-xs font-semibold text-gray-500">Training Video URL</div>
                        <input
                          value={item.mediaLink}
                          onChange={(event) => updateItemRow(index, "mediaLink", event.target.value)}
                          placeholder="Optional video URL"
                          className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm focus:border-sky-300 focus:outline-none focus:ring-1 focus:ring-sky-200"
                        />
                      </label>
                    </div>

                    {item.frequency === "WEEKLY" ? (
                      <div className="mt-3">
                        <div className="mb-2 text-xs font-semibold text-gray-500">Show this task on these weekdays</div>
                        <div className="flex flex-wrap gap-2">
                          {WEEKDAY_OPTIONS.map((option) => {
                            const active = normalizeRepeatDays(item.repeatDays).includes(option.value);
                            return (
                              <button
                                key={option.value}
                                type="button"
                                onClick={() =>
                                  updateItemRow(index, "repeatDays", toggleRepeatDay(item.repeatDays, option.value))
                                }
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

                    {item.frequency === "MONTHLY" ? (
                      <div className="mt-3">
                        <div className="mb-2 flex gap-2">
                          <button
                            type="button"
                            onClick={() => updateItemRow(index, "monthlyMode", "DAY")}
                            className={[
                              "rounded-full px-3 py-1.5 text-xs font-semibold transition",
                              (item.monthlyMode || "DAY") === "DAY"
                                ? "bg-sky-600 text-white"
                                : "border border-gray-200 bg-white text-gray-700 hover:bg-gray-50",
                            ].join(" ")}
                          >
                            Day of month
                          </button>
                          <button
                            type="button"
                            onClick={() => updateItemRow(index, "monthlyMode", "WEEKDAY")}
                            className={[
                              "rounded-full px-3 py-1.5 text-xs font-semibold transition",
                              item.monthlyMode === "WEEKDAY"
                                ? "bg-sky-600 text-white"
                                : "border border-gray-200 bg-white text-gray-700 hover:bg-gray-50",
                            ].join(" ")}
                          >
                            Day of week
                          </button>
                        </div>

                        {(item.monthlyMode || "DAY") === "DAY" ? (
                          <label className="block max-w-xs">
                            <div className="mb-1 text-xs font-semibold text-gray-500">Day of month</div>
                            <input
                              type="number"
                              min="1"
                              max="31"
                              value={item.monthlyDay || ""}
                              onChange={(event) => updateItemRow(index, "monthlyDay", event.target.value)}
                              placeholder="20"
                              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm focus:border-sky-300 focus:bg-white focus:outline-none focus:ring-1 focus:ring-sky-200"
                            />
                          </label>
                        ) : (
                          <div className="flex max-w-md gap-3">
                            <label className="block flex-1">
                              <div className="mb-1 text-xs font-semibold text-gray-500">Week</div>
                              <select
                                value={item.monthlyWeek || ""}
                                onChange={(event) => updateItemRow(index, "monthlyWeek", event.target.value)}
                                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm focus:border-sky-300 focus:outline-none focus:ring-1 focus:ring-sky-200"
                              >
                                <option value="">Select week</option>
                                {MONTHLY_WEEK_OPTIONS.map((option) => (
                                  <option key={option.value} value={option.value}>
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label className="block flex-1">
                              <div className="mb-1 text-xs font-semibold text-gray-500">Weekday</div>
                              <select
                                value={item.monthlyWeekday || ""}
                                onChange={(event) => updateItemRow(index, "monthlyWeekday", event.target.value)}
                                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm focus:border-sky-300 focus:outline-none focus:ring-1 focus:ring-sky-200"
                              >
                                <option value="">Select weekday</option>
                                {WEEKDAY_OPTIONS.map((option) => (
                                  <option key={option.value} value={option.value}>
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                            </label>
                          </div>
                        )}
                      </div>
                    ) : null}

                    {item.frequency === "ONE_TIME" ? (
                      <label className="mt-3 block max-w-xs">
                        <div className="mb-1 text-xs font-semibold text-gray-500">One-time date</div>
                        <input
                          type="date"
                          value={item.oneTimeDate || ""}
                          onChange={(event) => updateItemRow(index, "oneTimeDate", event.target.value)}
                          className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm focus:border-sky-300 focus:bg-white focus:outline-none focus:ring-1 focus:ring-sky-200"
                        />
                      </label>
                    ) : null}
                  </div>
                ))}
              </div>

              <div className="mt-3 flex justify-end">
                <button
                  type="button"
                  onClick={addItemRow}
                  className="rounded-lg px-3 py-1.5 text-xs font-semibold text-sky-600 hover:bg-sky-50"
                >
                  + Add Item
                </button>
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
            {search || filterCategory || filterFrequency ? "No matching checklists" : "No checklists yet"}
          </div>
          <p className="mt-1 max-w-md text-xs text-gray-500">
            {search || filterCategory || filterFrequency
              ? "Adjust the filters or search terms and try again."
              : "Create a checklist and set the schedule on each task so only the right items appear on the right day."}
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
                const checklistRooms = getChecklistClassRooms(checklist);
                const checklistAssignedUsers = getChecklistAssignedUsers(checklist);
                const expanded = expandedId === checklist.id;
                const scheduleKey = summarizeChecklistFrequency(checklist);
                const scheduleLabel = summarizeChecklistSchedule(checklist);
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
                            <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${FREQUENCY_STYLES[scheduleKey] || FREQUENCY_STYLES.DAILY}`}>
                              {scheduleLabel}
                            </span>
                            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-600">
                              {items.length} {items.length === 1 ? "item" : "items"}
                            </span>
                            {checklistRooms.slice(0, 2).map((room) => (
                              <span
                                key={room.id}
                                className="rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-semibold text-sky-700"
                              >
                                {room.name}
                              </span>
                            ))}
                            {checklistRooms.length > 2 ? (
                              <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-semibold text-sky-700">
                                +{checklistRooms.length - 2} more
                              </span>
                            ) : null}
                            {checklistAssignedUsers.slice(0, 2).map((user) => (
                              <span
                                key={user.id}
                                className="rounded-full bg-violet-50 px-2 py-0.5 text-[11px] font-semibold text-violet-700"
                              >
                                {user.name || user.email}
                              </span>
                            ))}
                            {checklistAssignedUsers.length > 2 ? (
                              <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[11px] font-semibold text-violet-700">
                                +{checklistAssignedUsers.length - 2} more
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
                              const itemSchedule = getEffectiveItemSchedule(item, checklist);
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
                                      <div className="mt-1">
                                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${FREQUENCY_STYLES[itemSchedule.frequency] || FREQUENCY_STYLES.DAILY}`}>
                                          {describeChecklistSchedule(itemSchedule)}
                                        </span>
                                      </div>
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
