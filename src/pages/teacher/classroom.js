import TeacherLayout from "@/components/teacher/TeacherLayout";
import { SkeletonTable } from "@/components/ui/Skeleton";
import { apiJson } from "@/lib/api";
import ActivityPhotos from "@/components/reports/ActivityPhotos";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

function byString(a, b) {
  return String(a || "").localeCompare(String(b || ""));
}

const ACTIVITY_TYPES = [
  "DIAPER_CHANGE",
  "NAP",
  "BOTTLE",
  "MEAL",
  "SNACK",
  "ACTIVITY",
  "TASK_CHECKLIST",
  "BEHAVIOR",
  "INCIDENT",
  "TOILETING",
  "CHARACTER_HIGHLIGHT",
  "OTHER",
];

const ACTIVITY_TYPE_META = {
  DIAPER_CHANGE: { label: "Diaper Change", icon: "💧", tint: "bg-violet-50 text-violet-700 border-violet-200" },
  NAP: { label: "Nap", icon: "😴", tint: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  BOTTLE: { label: "Bottle", icon: "🍼", tint: "bg-sky-50 text-sky-700 border-sky-200" },
  MEAL: { label: "Meal", icon: "🍽️", tint: "bg-amber-50 text-amber-700 border-amber-200" },
  SNACK: { label: "Snack", icon: "🍎", tint: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  ACTIVITY: { label: "Activity", icon: "🎨", tint: "bg-pink-50 text-pink-700 border-pink-200" },
  TASK_CHECKLIST: { label: "Task/Checklist", icon: "✅", tint: "bg-teal-50 text-teal-700 border-teal-200" },
  BEHAVIOR: { label: "Course Correction", icon: "🤝", tint: "bg-orange-50 text-orange-700 border-orange-200" },
  INCIDENT: { label: "Incident", icon: "⚠️", tint: "bg-red-50 text-red-700 border-red-200" },
  TOILETING: { label: "Toileting", icon: "🚽", tint: "bg-cyan-50 text-cyan-700 border-cyan-200" },
  CHARACTER_HIGHLIGHT: { label: "Character Highlight", icon: "🌟", tint: "bg-yellow-50 text-yellow-700 border-yellow-200" },
  OTHER: { label: "Other", icon: "📝", tint: "bg-gray-50 text-gray-700 border-gray-200" },
};

const TOILETING_TYPE_LABELS = {
  SUCCESS: "Success",
  TRIED: "Tried",
  ACCIDENT: "Accident",
};

const CHARACTER_HIGHLIGHT_TYPE_LABELS = {
  BROTHERS_KEEPER: "Brother's Keeper",
  CHAMPION_OF_VIRTUE: "Champion of Virtue",
  FULL_REPENTANCE: "Full Repentance",
  CHAMPION_OF_OBEDIENCE: "Champion of Obedience",
  CHAMPION_OF_RESPECT: "Champion of Respect",
  CHAMPION_OF_HONESTY: "Champion of Honesty",
  OTHER: "Other",
};

const DIAPER_TYPE_LABELS = {
  BM: "BM",
  W: "Wet",
  D: "Dry",
};

const BEHAVIOR_TYPE_LABELS = {
  PHYSICAL_VIOLENCE: "Physical violence",
  VIRTUE: "Virtue",
  RESPECT: "Respect",
  OBEDIENCE: "Obedience",
  HONESTY: "Honesty",
  OTHER: "Other",
};

const QUANTITY_LABELS = {
  ALL: "All",
  MOST: "Most",
  SOME: "Some",
  NONE: "None",
};

function formatClockTimeString(value) {
  if (!value) return null;
  const [hoursRaw, minutesRaw] = String(value).split(":");
  const hours = Number(hoursRaw);
  const minutes = Number(minutesRaw);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function isToday(dateStr) {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return false;
  return d.toDateString() === new Date().toDateString();
}

function dayLabel(dateKey) {
  if (!dateKey) return "Unknown date";
  const date = new Date(dateKey);
  if (Number.isNaN(date.getTime())) return "Unknown date";
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return date.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric", year: "numeric" });
}

function groupActivitiesByDay(activities) {
  const groups = new Map();
  for (const activity of activities) {
    const date = new Date(activity.createdAt);
    const key = Number.isNaN(date.getTime()) ? "unknown" : date.toDateString();
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(activity);
  }
  return [...groups.entries()].map(([key, items]) => ({ key, label: dayLabel(key === "unknown" ? "" : key), items }));
}

function relativeTime(dateStr) {
  const now = new Date();
  const value = new Date(dateStr);
  if (Number.isNaN(value.getTime())) return "-";
  const diffMs = now - value;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return value.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: value.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
}

function formatDateTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleString();
}

function describeActivity(activity) {
  const details = activity?.details && typeof activity.details === "object" ? activity.details : {};
  if (activity.type === "NAP") {
    const start =
      formatClockTimeString(details.startTime) ||
      (details.start ? new Date(details.start).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : null);
    const end =
      formatClockTimeString(details.endTime) ||
      (details.end ? new Date(details.end).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : null);
    if (start && end) return `Slept from ${start} to ${end}`;
    if (start) return `Nap started at ${start}`;
    if (end) return `Nap ended at ${end}`;
  }
  if (activity.type === "BOTTLE") {
    const parts = [];
    if (details.amount) parts.push(`Served ${details.amount}`);
    if (details.consumed) parts.push(`Consumed ${details.consumed}`);
    if (parts.length) return parts.join(" • ");
  }
  if (activity.type === "MEAL" || activity.type === "SNACK") {
    const parts = [];
    if (details.meal) parts.push(details.meal);
    else if (details.food) parts.push(details.food);
    if (details.quantity) parts.push(QUANTITY_LABELS[details.quantity] || details.quantity);
    else if (details.amount) parts.push(details.amount);
    if (parts.length) return parts.join(" • ");
  }
  if (activity.type === "DIAPER_CHANGE" && details.diaperType) {
    return DIAPER_TYPE_LABELS[details.diaperType] || details.diaperType;
  }
  if (activity.type === "BEHAVIOR") {
    const parts = [];
    if (details.behaviorType) parts.push(BEHAVIOR_TYPE_LABELS[details.behaviorType] || details.behaviorType);
    if (details.behaviorLevel) parts.push(`Level ${details.behaviorLevel}`);
    if (details.ipp) parts.push("Flagged for IPP");
    if (parts.length) return parts.join(" • ");
  }
  if (activity.type === "TOILETING" && details.toiletingType) {
    return TOILETING_TYPE_LABELS[details.toiletingType] || details.toiletingType;
  }
  if (activity.type === "CHARACTER_HIGHLIGHT" && details.characterHighlightType) {
    return CHARACTER_HIGHLIGHT_TYPE_LABELS[details.characterHighlightType] || details.characterHighlightType;
  }
  return activity.notes || null;
}

function fullName(child) {
  if (!child) return "";
  return `${child.firstName || ""}${child.lastName ? ` ${child.lastName}` : ""}`.trim();
}

function initials(child) {
  const f = (child?.firstName || "").trim().slice(0, 1).toUpperCase();
  const l = (child?.lastName || "").trim().slice(0, 1).toUpperCase();
  return `${f}${l}` || "C";
}

function formatTime(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function IconUsers({ className }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" className={className} aria-hidden="true">
      <path d="M7 8a3 3 0 1 1 6 0 3 3 0 0 1-6 0Z" />
      <path d="M3.5 16.5c.7-2.7 3.2-4 6.5-4s5.8 1.3 6.5 4" strokeLinecap="round" />
    </svg>
  );
}

function IconCheck({ className }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden="true">
      <path d="m5 10 3 3 7-7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconClock({ className }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" className={className} aria-hidden="true">
      <circle cx="10" cy="10" r="7" />
      <path d="M10 6v4l3 2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconAlert({ className }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" className={className} aria-hidden="true">
      <path d="M10 3.5 17 16H3l7-12.5Z" strokeLinejoin="round" />
      <path d="M10 7.5v4" strokeLinecap="round" />
      <circle cx="10" cy="13.5" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  );
}

function IconRefresh({ className }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" className={className} aria-hidden="true">
      <path d="M16 10a6 6 0 1 1-1.5-4" strokeLinecap="round" />
      <path d="M16 4v4h-4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconClipboard({ className }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" className={className} aria-hidden="true">
      <rect x="5" y="4.5" width="10" height="12" rx="2" />
      <path d="M8 4.5h4a1 1 0 0 0-1-1h-2a1 1 0 0 0-1 1Z" />
    </svg>
  );
}

function IconNote({ className }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" className={className} aria-hidden="true">
      <path d="M5 3.5h7l3 3V16a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1Z" />
      <path d="M12 3.5V7h3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconSearch({ className }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" className={className} aria-hidden="true">
      <circle cx="9" cy="9" r="5.5" />
      <path d="m14.5 14.5 3 3" strokeLinecap="round" />
    </svg>
  );
}

function IconX({ className }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden="true">
      <path d="M5 5l10 10M15 5 5 15" strokeLinecap="round" />
    </svg>
  );
}

function IconChart({ className }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" className={className} aria-hidden="true">
      <path d="M4 15.5h12" strokeLinecap="round" />
      <path d="M6 14V9" strokeLinecap="round" />
      <path d="M10 14V6" strokeLinecap="round" />
      <path d="M14 14v-4" strokeLinecap="round" />
    </svg>
  );
}

function IconChevronRight({ className }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden="true">
      <path d="m8 5 5 5-5 5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconSwap({ className }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" className={className} aria-hidden="true">
      <path d="M4 6h10" strokeLinecap="round" />
      <path d="m11 3 3 3-3 3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M16 14H6" strokeLinecap="round" />
      <path d="m9 11-3 3 3 3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}


function flagsForChild(ch) {
  const flags = [];
  if (ch?.allergies) flags.push({ label: "Allergies", color: "border-red-200 bg-red-50 text-red-800" });
  if (!ch?.emergencyContact) flags.push({ label: "No emergency contact", color: "border-amber-200 bg-amber-50 text-amber-800" });
  if (!ch?.birthDate) flags.push({ label: "Missing DOB", color: "border-amber-200 bg-amber-50 text-amber-800" });
  return flags;
}

// Student names open the Student Performance Report (client request 2026-10-29).
function performanceHref(childId) {
  return `/teacher/student-performance-report?childId=${encodeURIComponent(childId)}`;
}

export default function TeacherClassroom() {
  const [attendanceFilter, setAttendanceFilter] = useState("all");
  const [centers, setCenters] = useState([]);
  const [centerId, setCenterId] = useState("");

  const [classes, setClasses] = useState([]);
  const [transferClasses, setTransferClasses] = useState([]);
  const [classId, setClassId] = useState("");
  const [search, setSearch] = useState("");

  const [children, setChildren] = useState([]);
  const [attendance, setAttendance] = useState(null);
  const [lastRefreshAt, setLastRefreshAt] = useState(null);



  const [activities, setActivities] = useState([]);
  const [activitiesLoading, setActivitiesLoading] = useState(false);
  const [detailChildId, setDetailChildId] = useState("");

  const [busyChildId, setBusyChildId] = useState("");

  const [transferChild, setTransferChild] = useState(null);
  const [transferClassRoomId, setTransferClassRoomId] = useState("");
  const [transferBusy, setTransferBusy] = useState(false);
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

  async function refreshAttendance(id = centerId) {
    if (!id) {
      setAttendance(null);
      setLastRefreshAt(null);
      return;
    }
    try {
      const att = await apiJson(`/api/v1/attendance/today?centerId=${encodeURIComponent(id)}`);
      setAttendance(att);
      setLastRefreshAt(new Date());
    } catch {
      setAttendance(null);
    }
  }

  async function loadCenterData(id) {
    if (!id) return;
    const [cls, kids, allClasses, att] = await Promise.all([
      apiJson(`/api/v1/classes?centerId=${encodeURIComponent(id)}`),
      apiJson(`/api/v1/children?centerId=${encodeURIComponent(id)}`),
      apiJson(`/api/v1/classes?centerId=${encodeURIComponent(id)}&mode=transfer`),
      apiJson(`/api/v1/attendance/today?centerId=${encodeURIComponent(id)}`),
    ]);
    setClasses(Array.isArray(cls) ? cls : []);
    setChildren(Array.isArray(kids) ? kids : []);
    setTransferClasses(Array.isArray(allClasses) ? allClasses : []);
    setAttendance(att || null);
    setLastRefreshAt(new Date());
  }

  useEffect(() => {
    if (!centerId) {
      setClasses([]);
      setTransferClasses([]);
      setChildren([]);
      setClassId("");
      setAttendance(null);
      setLastRefreshAt(null);
      setTransferChild(null);
      setTransferClassRoomId("");
      return;
    }

    (async () => {
      setLoading(true);
      setError("");
      try {
        await loadCenterData(centerId);
      } catch (e) {
        setError(e.message || "Failed to load classroom data");
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [centerId]);


  useEffect(() => {
    setAttendanceFilter("all");
  }, [centerId, classId]);


  useEffect(() => {
    (async () => {
      if (!centerId) { setActivities([]); return; }
      setActivitiesLoading(true);
      try {
        const res = await apiJson(`/api/v1/activities?centerId=${encodeURIComponent(centerId)}`);
        setActivities(Array.isArray(res) ? res : []);
      } catch { setActivities([]); }
      finally { setActivitiesLoading(false); }
    })();
  }, [centerId]);

  const classNameById = useMemo(() => {
    return Object.fromEntries((classes || []).map((c) => [c.id, c.name]));
  }, [classes]);
  const transferClassNameById = useMemo(() => {
    return Object.fromEntries((transferClasses || []).map((c) => [c.id, c.name]));
  }, [transferClasses]);
  const centerNameById = useMemo(() => {
    return Object.fromEntries((centers || []).map((c) => [c.id, c.name]));
  }, [centers]);
  const selectedCenterName = centerNameById[centerId] || "";
  const selectedClassName = classNameById[classId] || "";

  const attendanceByChildId = useMemo(() => {
    const map = new Map();
    for (const row of attendance?.checkedInChildren || []) {
      if (row?.child?.id) map.set(row.child.id, { checkedIn: true, checkedInAt: row.checkedInAt });
    }
    for (const row of attendance?.missingChildren || []) {
      if (row?.child?.id && !map.has(row.child.id)) {
        map.set(row.child.id, { checkedIn: false, checkedInAt: row.checkedInAt || null, checkedOutAt: row.checkedOutAt || null });
      }
    }
    return map;
  }, [attendance]);

  const visibleChildren = useMemo(() => {
    const base = children || [];
    const byClass = classId ? base.filter((c) => c.classRoomId === classId) : base;
    const q = search.trim().toLowerCase();
    const searched = q
      ? byClass.filter((c) => fullName(c).toLowerCase().includes(q))
      : byClass;
    return searched.slice().sort((a, b) => byString(a.firstName, b.firstName));
  }, [children, classId, search]);

  const filteredChildren = useMemo(() => {
    if (attendanceFilter === "checked-in") {
      return visibleChildren.filter((child) => attendanceByChildId.get(child.id)?.checkedIn);
    }
    if (attendanceFilter === "not-checked-in") {
      return visibleChildren.filter((child) => !attendanceByChildId.get(child.id)?.checkedIn);
    }
    return visibleChildren;
  }, [attendanceByChildId, attendanceFilter, visibleChildren]);







  const redFlagged = useMemo(() => {
    return filteredChildren.filter((c) => c?.allergies || !c?.birthDate || !c?.emergencyContact);
  }, [filteredChildren]);

  const stats = useMemo(() => {
    const total = visibleChildren.length;
    let checkedIn = 0;
    for (const ch of visibleChildren) {
      const att = attendanceByChildId.get(ch.id);
      if (att?.checkedIn) checkedIn += 1;
    }
    const checkedOut = total - checkedIn;
    return { total, checkedIn, checkedOut, flagged: redFlagged.length };
  }, [visibleChildren, attendanceByChildId, redFlagged.length]);


  const attendanceFilterLabel =
    attendanceFilter === "checked-in"
      ? "Checked In"
      : attendanceFilter === "not-checked-in"
        ? "Not Checked In"
        : "All Children";

  function toggleAttendanceFilter(nextFilter) {
    setAttendanceFilter((current) => (current === nextFilter ? "all" : nextFilter));
  }

  async function checkIn(childId) {
    if (!childId) return;
    setBusyChildId(childId);
    setError("");
    try {
      await apiJson("/api/v1/attendance/check-in", {
        method: "POST",
        body: JSON.stringify({ childId }),
      });
      await refreshAttendance();
    } catch (e) {
      setError(e.message || "Failed to check in");
    } finally {
      setBusyChildId("");
    }
  }

  async function checkOut(childId) {
    if (!childId) return;
    setBusyChildId(childId);
    setError("");
    try {
      await apiJson("/api/v1/attendance/check-out", {
        method: "POST",
        body: JSON.stringify({ childId }),
      });
      await refreshAttendance();
    } catch (e) {
      setError(e.message || "Failed to check out");
    } finally {
      setBusyChildId("");
    }
  }




  function openTransfer(child) {
    setTransferChild(child);
    setTransferClassRoomId(child?.classRoomId || "");
    setError("");
  }

  function closeTransfer() {
    setTransferChild(null);
    setTransferClassRoomId("");
    setTransferBusy(false);
  }

  async function saveTransfer() {
    if (!transferChild) return;
    setTransferBusy(true);
    setError("");
    try {
      await apiJson("/api/v1/attendance/transfer-classroom", {
        method: "POST",
        body: JSON.stringify({
          childId: transferChild.id,
          targetClassRoomId: transferClassRoomId || null,
        }),
      });
      await loadCenterData(centerId);
      closeTransfer();
    } catch (e) {
      setError(e.message || "Failed to move child");
      setTransferBusy(false);
    }
  }

  return (
    <TeacherLayout title="My Classroom">
      <div className="space-y-5">
        {/* Header */}
        <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 via-white to-sky-50 p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-extrabold text-gray-900">My Classroom</h2>
                {selectedCenterName && (
                  <span className="rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[11px] font-semibold text-sky-700">
                    {selectedCenterName}
                  </span>
                )}
                {selectedClassName && (
                  <span className="rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-700">
                    {selectedClassName}
                  </span>
                )}
              </div>
              {lastRefreshAt ? (
                <p className="mt-1 text-xs text-gray-400">
                  Last updated {formatTime(lastRefreshAt.toISOString())}
                </p>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={async () => {
                  setError("");
                  try {
                    await loadCenterData(centerId);
                  } catch (e) {
                    setError(e.message || "Failed to refresh classroom data");
                  }
                }}
                className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
              >
                <IconRefresh className="h-4 w-4 text-gray-500" />
                Refresh
              </button>
              <Link
                href="/teacher/logs"
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-3 py-2 text-xs font-extrabold text-white hover:bg-blue-700"
              >
                <IconNote className="h-4 w-4 text-white/90" />
                Log Activity
              </Link>
              <Link
                href="/teacher/checklists"
                className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-800 hover:bg-gray-50"
              >
                <IconClipboard className="h-4 w-4 text-gray-600" />
                Checklists
              </Link>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-end gap-3">
            <label className="block">
              <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Center
              </div>
              <select
                value={centerId}
                onChange={(e) => setCenterId(e.target.value)}
                className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm sm:w-56"
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
              <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Classroom
              </div>
              <select
                value={classId}
                onChange={(e) => setClassId(e.target.value)}
                className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm sm:w-56"
                disabled={!centerId}
              >
                <option value="">All classrooms</option>
                {classes
                  .slice()
                  .sort((a, b) => byString(a.name, b.name))
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
              </select>
            </label>

            <label className="block flex-1">
              <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Search
              </div>
              <div className="relative mt-1 sm:max-w-sm">
                <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={centerId ? "Search by name..." : "Select a center to search"}
                  disabled={!centerId}
                  className="w-full rounded-xl border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm focus:border-blue-300 focus:outline-none focus:ring-1 focus:ring-blue-300 disabled:bg-gray-50"
                />
              </div>
            </label>
          </div>
        </div>

        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {error}
          </div>
        ) : null}

        {loading ? (
          <div className="rounded-xl border border-gray-200 bg-white p-6"><SkeletonTable rows={5} cols={4} /></div>
        ) : !centerId ? (
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-6 text-center text-sm text-gray-600">
            Select a center to view your classroom roster.
          </div>
        ) : (
          <>
            {/* Stats */}
            <div className="grid grid-cols-2 items-stretch gap-3 sm:grid-cols-4 sm:gap-4">
              <StatCard label="Total Children" value={stats.total} color="sky" icon={<IconUsers className="h-4 w-4" />} />
              <StatCard
                label="Checked In"
                value={stats.checkedIn}
                color="emerald"
                icon={<IconCheck className="h-4 w-4" />}
                active={attendanceFilter === "checked-in"}
                onClick={() => toggleAttendanceFilter("checked-in")}
              />
              <StatCard
                label="Not Checked In"
                value={stats.checkedOut}
                color="gray"
                icon={<IconClock className="h-4 w-4" />}
                active={attendanceFilter === "not-checked-in"}
                onClick={() => toggleAttendanceFilter("not-checked-in")}
              />
              <StatCard label="Red Flagged" value={stats.flagged} color="rose" icon={<IconAlert className="h-4 w-4" />} />
            </div>

            <div className="grid grid-cols-1 items-stretch gap-4 xl:grid-cols-[1fr_340px]">
              {/* Main content */}
              <div className="min-w-0 space-y-4">
                {/* Red flags, above the roster (client request 2026-10-29) */}
                {redFlagged.length > 0 && (
                  <div className="rounded-2xl border border-rose-200 bg-rose-50/50 p-4">
                    <div className="flex items-center gap-2 border-b border-rose-200/60 pb-3">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-rose-100 text-xs font-bold text-rose-600">!</span>
                      <h3 className="text-sm font-extrabold text-rose-900">
                        Red Flags ({redFlagged.length})
                      </h3>
                    </div>
                    <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {redFlagged.slice(0, 8).map((c) => {
                        const flags = flagsForChild(c);
                        return (
                          <div key={c.id} className="flex items-start gap-3 rounded-xl border border-rose-200 bg-white p-3">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-rose-100 text-xs font-extrabold text-rose-700">
                              {initials(c)}
                            </div>
                            <div className="min-w-0">
                              <Link
                                href={performanceHref(c.id)}
                                className="text-sm font-extrabold text-gray-900 hover:text-blue-700 hover:underline"
                              >
                                {fullName(c)}
                              </Link>
                              <div className="mt-1 flex flex-wrap gap-1">
                                {flags.map((f) => (
                                  <span key={f.label} className={["rounded-md border px-1.5 py-0.5 text-[10px] font-semibold", f.color].join(" ")}>
                                    {f.label}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Class roster as a table (client mockup r050) */}
                <div className="rounded-2xl border border-gray-200 bg-white p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 pb-3">
                    <div className="flex items-center gap-3">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-600">
                        <IconUsers className="h-4 w-4" />
                      </span>
                      <h3 className="text-base font-extrabold text-[#0b2a5b]">Class Roster</h3>
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-600">
                        {filteredChildren.length}
                      </span>
                    </div>
                    <select
                      value={attendanceFilter}
                      onChange={(e) => setAttendanceFilter(e.target.value)}
                      aria-label="Status"
                      className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
                    >
                      <option value="all">All Statuses</option>
                      <option value="checked-in">Checked In</option>
                      <option value="not-checked-in">Not Checked In</option>
                    </select>
                  </div>

                  {filteredChildren.length === 0 ? (
                    <div className="mt-3 rounded-xl border border-gray-200 bg-gray-50 p-4 text-center text-sm text-gray-600">
                      {attendanceFilter === "all"
                        ? "No children found for the current filters."
                        : `No ${attendanceFilterLabel.toLowerCase()} children found for the current filters.`}
                    </div>
                  ) : (
                    <RosterTable
                      items={filteredChildren}
                      hasAttendance={!!attendance}
                      attendanceByChildId={attendanceByChildId}
                      busyChildId={busyChildId}
                      onCheckIn={checkIn}
                      onCheckOut={checkOut}
                      onOpenTransfer={openTransfer}
                    />
                  )}
                </div>

                {/* Activity Log Summary */}
                <ActivityLogSummaryPanel
                  activities={activities}
                  loading={activitiesLoading}
                  children={filteredChildren}
                  classNameById={classNameById}
                  detailChildId={detailChildId}
                  onOpenDetail={setDetailChildId}
                  onCloseDetail={() => setDetailChildId("")}
                  onActivityChanged={(updated) => setActivities((rows) => rows.map((a) => (a.id === updated.id ? { ...a, ...updated } : a)))}
                  onActivityDeleted={(id) => setActivities((rows) => rows.filter((a) => a.id !== id))}
                />
              </div>

              {/* Sidebar */}
              <aside className="min-w-0 space-y-4">
                {/* Quick links */}
                <div className="rounded-2xl border border-gray-200 bg-white p-4">
                  <h3 className="text-sm font-extrabold text-gray-900 border-b border-gray-100 pb-3">Quick Actions</h3>
                  <div className="mt-3 grid grid-cols-1 gap-2">
                    <Link
                      href="/teacher/logs"
                      className="group flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-gradient-to-r from-white via-white to-slate-50 px-3 py-2.5 text-sm font-semibold text-gray-800 hover:border-blue-200 hover:bg-blue-50/40"
                    >
                      <div className="flex items-center gap-3">
                        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                          <IconNote className="h-4 w-4" />
                        </span>
                        <div className="leading-tight">
                          <div className="text-sm font-semibold text-gray-900">Log Activity</div>
                          <div className="text-xs font-medium text-gray-500">Record learning moments</div>
                        </div>
                      </div>
                      <IconChevronRight className="h-4 w-4 text-gray-400 group-hover:text-blue-600" />
                    </Link>
                    <Link
                      href="/teacher/checklists"
                      className="group flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-gradient-to-r from-white via-white to-slate-50 px-3 py-2.5 text-sm font-semibold text-gray-800 hover:border-emerald-200 hover:bg-emerald-50/40"
                    >
                      <div className="flex items-center gap-3">
                        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                          <IconClipboard className="h-4 w-4" />
                        </span>
                        <div className="leading-tight">
                          <div className="text-sm font-semibold text-gray-900">Checklists</div>
                          <div className="text-xs font-medium text-gray-500">Daily classroom flow</div>
                        </div>
                      </div>
                      <IconChevronRight className="h-4 w-4 text-gray-400 group-hover:text-emerald-600" />
                    </Link>
                    <Link
                      href="/teacher/class-performance-report"
                      className="group flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-gradient-to-r from-white via-white to-slate-50 px-3 py-2.5 text-sm font-semibold text-gray-800 hover:border-indigo-200 hover:bg-indigo-50/40"
                    >
                      <div className="flex items-center gap-3">
                        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
                          <IconChart className="h-4 w-4" />
                        </span>
                        <div className="leading-tight">
                          <div className="text-sm font-semibold text-gray-900">Class Performance Report</div>
                          <div className="text-xs font-medium text-gray-500">Attendance and progress</div>
                        </div>
                      </div>
                      <IconChevronRight className="h-4 w-4 text-gray-400 group-hover:text-indigo-600" />
                    </Link>
                  </div>
                </div>
              </aside>
            </div>
          </>
        )}

        {transferChild ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4">
            <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-sky-100 text-sky-700">
                      <IconSwap className="h-4 w-4" />
                    </span>
                    <h3 className="text-base font-extrabold text-slate-900">Move Child for Today</h3>
                  </div>
                  <p className="mt-2 text-sm text-slate-600">
                    {fullName(transferChild)} stays checked into the center. Their default classroom remains{" "}
                    <span className="font-semibold text-slate-800">
                      {transferClassNameById[transferChild.defaultClassRoomId] || classNameById[transferChild.defaultClassRoomId] || "Unassigned"}
                    </span>{" "}
                    and will resume tomorrow.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeTransfer}
                  className="rounded-lg border border-slate-200 bg-white p-2 text-slate-500 hover:bg-slate-50"
                >
                  <IconX className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-4 space-y-3">
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                  Current classroom today:{" "}
                  <span className="font-semibold text-slate-900">
                    {transferClassNameById[transferChild.classRoomId] || classNameById[transferChild.classRoomId] || "Unassigned"}
                  </span>
                </div>

                <label className="block">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    New classroom for today
                  </div>
                  <select
                    value={transferClassRoomId}
                    onChange={(e) => setTransferClassRoomId(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                    disabled={transferBusy}
                  >
                    <option value="">Return to default classroom</option>
                    {transferClasses
                      .slice()
                      .sort((a, b) => byString(a.name, b.name))
                      .map((classroom) => (
                        <option key={classroom.id} value={classroom.id}>
                          {classroom.name}
                        </option>
                      ))}
                  </select>
                </label>
              </div>

              <div className="mt-5 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={closeTransfer}
                  disabled={transferBusy}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={saveTransfer}
                  disabled={transferBusy}
                  className="inline-flex items-center gap-2 rounded-xl bg-sky-600 px-4 py-2 text-sm font-extrabold text-white hover:bg-sky-700 disabled:opacity-60"
                >
                  <IconSwap className="h-4 w-4 text-white/90" />
                  {transferBusy ? "Saving..." : "Save for Today"}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </TeacherLayout>
  );
}


function ActivityLogSummaryPanel({ activities, loading, children, classNameById, detailChildId, onOpenDetail, onCloseDetail, onActivityChanged, onActivityDeleted }) {
  // A drop-down section (client request 2026-10-02): closed until opened.
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [actionError, setActionError] = useState("");
  const [typeFilter, setTypeFilter] = useState([]);
  useEffect(() => setTypeFilter([]), [detailChildId]);
  const childSummaries = useMemo(() => {
    const byId = new Map();
    for (const ch of children || []) {
      byId.set(ch.id, {
        child: ch,
        todayCounts: {},
        todayTotal: 0,
        todayLatestAt: null,
        allCounts: {},
        allTotal: 0,
        activities: [],
      });
    }
    for (const activity of activities || []) {
      const cid = activity?.child?.id;
      if (!cid || !byId.has(cid)) continue;
      const entry = byId.get(cid);
      entry.allCounts[activity.type] = (entry.allCounts[activity.type] || 0) + 1;
      entry.allTotal += 1;
      entry.activities.push(activity);
      if (isToday(activity.createdAt)) {
        entry.todayCounts[activity.type] = (entry.todayCounts[activity.type] || 0) + 1;
        entry.todayTotal += 1;
        if (!entry.todayLatestAt || new Date(activity.createdAt) > new Date(entry.todayLatestAt)) {
          entry.todayLatestAt = activity.createdAt;
        }
      }
    }
    const list = [...byId.values()];
    for (const entry of list) {
      entry.activities.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }
    list.sort((a, b) => byString(a.child.firstName, b.child.firstName));
    return list;
  }, [activities, children]);

  const detailSummary = useMemo(
    () => childSummaries.find((s) => s.child.id === detailChildId) || null,
    [childSummaries, detailChildId],
  );

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={`flex w-full flex-wrap items-center justify-between gap-3 text-left ${open ? "border-b border-gray-100 pb-3" : ""}`}
      >
        <span className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-100 text-blue-700">
            <IconClipboard className="h-4 w-4" />
          </span>
          <span className="text-base font-extrabold text-[#0b2a5b]">Activity Logs – Today</span>
        </span>
        <span className="flex items-center gap-2 text-xs font-semibold text-gray-500">
          {childSummaries.filter((s) => s.todayTotal > 0).length} children with logs
          <span aria-hidden="true" className={`text-base text-blue-700 transition ${open ? "rotate-180" : ""}`}>▾</span>
        </span>
      </button>

      {!open ? null : loading ? (
        <div className="mt-3 text-sm text-gray-600">Loading activity logs...</div>
      ) : childSummaries.length === 0 ? (
        <div className="mt-3 rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm text-gray-600">
          No children found.
        </div>
      ) : (
        <div className="mt-3 space-y-2">
          {childSummaries.map((summary) => (
            <button
              key={summary.child.id}
              type="button"
              onClick={() => onOpenDetail(summary.child.id)}
              className="flex w-full items-center gap-3 rounded-xl border border-gray-200 bg-white p-3 text-left shadow-sm transition hover:border-blue-200 hover:bg-blue-50/30 hover:shadow-md"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-extrabold text-gray-600">
                {initials(summary.child)}
              </div>
              <div className="w-40 shrink-0">
                <div className="truncate text-sm font-extrabold text-gray-900">{fullName(summary.child)}</div>
                <div className="truncate text-xs text-gray-500">
                  {classNameById?.[summary.child.classRoomId] || "Unassigned"}
                </div>
              </div>
              <div className="flex min-w-0 flex-1 flex-wrap gap-1.5">
                {ACTIVITY_TYPES.map((type) => {
                  const meta = ACTIVITY_TYPE_META[type];
                  const count = summary.todayCounts[type] || 0;
                  return (
                    <span
                      key={type}
                      title={`${meta.label}: ${count}`}
                      className={[
                        "inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[11px] font-semibold",
                        count ? meta.tint : "border-gray-200 bg-gray-50 text-gray-400",
                      ].join(" ")}
                    >
                      <span aria-hidden="true">{meta.icon}</span>
                      {count}
                    </span>
                  );
                })}
              </div>
              <div className="w-28 shrink-0 text-right">
                <div className="text-xs font-semibold text-gray-700">
                  {summary.todayLatestAt ? relativeTime(summary.todayLatestAt) : "No logs today"}
                </div>
                <div className="text-[11px] text-gray-400">
                  {summary.todayTotal} log{summary.todayTotal === 1 ? "" : "s"} today
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {detailSummary ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) onCloseDetail();
          }}
        >
          <div className="max-h-[85vh] w-full max-w-2xl overflow-auto rounded-2xl border border-gray-200 bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3 border-b border-gray-100 pb-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-100 text-sm font-extrabold text-gray-600">
                  {initials(detailSummary.child)}
                </div>
                <div>
                  <div className="text-base font-extrabold text-gray-900">{fullName(detailSummary.child)}</div>
                  <div className="mt-0.5 text-xs text-gray-500">
                    {classNameById?.[detailSummary.child.classRoomId] || "Unassigned"} &middot; {detailSummary.allTotal} log{detailSummary.allTotal === 1 ? "" : "s"} total
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={onCloseDetail}
                aria-label="Close activity details"
                className="rounded-lg border border-gray-200 bg-white p-2 text-gray-500 hover:bg-gray-50"
              >
                <IconX className="h-4 w-4" />
              </button>
            </div>

            {actionError ? <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{actionError}</div> : null}
            <div className="mt-3 flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setTypeFilter([])}
                aria-pressed={!typeFilter.length}
                className={[
                  "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold",
                  !typeFilter.length ? "border-blue-500 bg-blue-600 text-white" : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50",
                ].join(" ")}
              >
                View All &middot; {detailSummary.allTotal}
              </button>
              {ACTIVITY_TYPES.filter((type) => detailSummary.allCounts[type]).map((type) => {
                const meta = ACTIVITY_TYPE_META[type];
                const active = typeFilter.includes(type);
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setTypeFilter((cur) => (cur.includes(type) ? cur.filter((t) => t !== type) : [...cur, type]))}
                    aria-pressed={active}
                    className={[
                      "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold",
                      meta.tint,
                      active ? "ring-2 ring-blue-500 ring-offset-1" : typeFilter.length ? "opacity-50" : "",
                    ].join(" ")}
                  >
                    <span aria-hidden="true">{meta.icon}</span> {meta.label} &middot; {detailSummary.allCounts[type]}
                  </button>
                );
              })}
            </div>

            <div className="mt-4">
              {detailSummary.activities.length === 0 ? (
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-center text-sm text-gray-600">
                  No activity logs recorded for this child yet.
                </div>
              ) : (
                groupActivitiesByDay(
                  typeFilter.length ? detailSummary.activities.filter((a) => typeFilter.includes(a.type)) : detailSummary.activities,
                ).map((group) => (
                  <div key={group.key} className="mb-4">
                    <div className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-400">{group.label}</div>
                    <div className="space-y-2">
                      {group.items.map((activity) => {
                        const meta = ACTIVITY_TYPE_META[activity.type] || ACTIVITY_TYPE_META.OTHER;
                        const detail = describeActivity(activity);
                        return (
                          <div key={activity.id}>
                          <div className="flex gap-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5">
                            <div className="flex-shrink-0">
                              <span className={["flex h-7 w-7 items-center justify-center rounded-full border text-xs", meta.tint].join(" ")}>
                                <span aria-hidden="true">{meta.icon}</span>
                              </span>
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-semibold text-gray-900">{meta.label}</span>
                                <span className="text-xs text-gray-500">{formatDateTime(activity.createdAt)}</span>
                              </div>
                              {detail ? <div className="mt-0.5 text-xs text-gray-600">{detail}</div> : null}
                              <ActivityPhotos activity={activity} size="h-16 w-16" className="mt-1.5" />
                              {activity.recordedBy?.name || activity.recordedBy?.email ? (
                                <div className="mt-0.5 text-[11px] text-gray-400">
                                  Logged by {activity.recordedBy?.name || activity.recordedBy?.email}
                                </div>
                              ) : null}
                            </div>
                            <div className="flex shrink-0 items-start gap-1">
                              <button
                                type="button"
                                onClick={() => { setActionError(""); setEditing(activity); }}
                                className="rounded-md border border-gray-200 bg-white px-2 py-1 text-[11px] font-semibold text-blue-700 hover:bg-blue-50"
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => { setActionError(""); setDeleting(activity); }}
                                className="rounded-md border border-red-200 bg-white px-2 py-1 text-[11px] font-semibold text-red-600 hover:bg-red-50"
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                            {deleting?.id === activity.id ? (
                              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                                <span>Delete this {(ACTIVITY_TYPE_META[deleting.type] || ACTIVITY_TYPE_META.OTHER).label.toLowerCase()} log from {formatDateTime(deleting.createdAt)}?</span>
                                <span className="flex gap-2">
                                  <button type="button" onClick={() => setDeleting(null)} className="rounded-md border border-gray-300 bg-white px-3 py-1 text-xs font-semibold text-gray-700">Cancel</button>
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      try {
                                        await apiJson(`/api/v1/activities/${deleting.id}`, { method: "DELETE" });
                                        onActivityDeleted(deleting.id);
                                        setDeleting(null);
                                      } catch (e) {
                                        setActionError(e.message || "Failed to delete the log");
                                      }
                                    }}
                                    className="rounded-md bg-red-600 px-3 py-1 text-xs font-bold text-white"
                                  >
                                    Delete
                                  </button>
                                </span>
                              </div>
                            ) : null}
                            {editing?.id === activity.id ? (
                              <EditLogForm
                                activity={editing}
                                onCancel={() => setEditing(null)}
                                onSaved={(updated) => {
                                  onActivityChanged(updated);
                                  setEditing(null);
                                }}
                                onError={setActionError}
                              />
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

// Edit a log from My Classroom: its time, the main details for its type, and notes.
function EditLogForm({ activity, onCancel, onSaved, onError }) {
  const details = activity.details && typeof activity.details === "object" ? activity.details : {};
  const [form, setForm] = useState(() => ({
    time: details.time || details.startTime || "",
    notes: activity.notes || "",
    amount: details.amount || "",
    consumed: details.consumed || "",
    quantity: details.quantity || "ALL",
    diaperType: details.diaperType || "W",
    toiletingType: details.toiletingType || "SUCCESS",
    startTime: details.startTime || "",
    endTime: details.endTime || "",
  }));
  const [saving, setSaving] = useState(false);
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const type = activity.type;
  const input = "mt-1 w-full rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm";

  async function save() {
    const next = { ...details };
    if (type === "NAP") {
      next.startTime = form.startTime;
      next.endTime = form.endTime;
      next.time = form.startTime || form.endTime || next.time;
    } else {
      if (form.time) next.time = form.time;
      if (type === "BOTTLE") {
        next.amount = form.amount;
        next.consumed = form.consumed;
      } else if (type === "MEAL" || type === "SNACK") {
        next.quantity = form.quantity;
      } else if (type === "DIAPER_CHANGE") {
        next.diaperType = form.diaperType;
      } else if (type === "TOILETING") {
        next.toiletingType = form.toiletingType;
      }
    }
    setSaving(true);
    onError("");
    try {
      const updated = await apiJson(`/api/v1/activities/${activity.id}`, {
        method: "PUT",
        body: JSON.stringify({ details: next, notes: form.notes || null }),
      });
      onSaved(updated);
    } catch (e) {
      onError(e.message || "Failed to save the log");
      setSaving(false);
    }
  }

  const meta = ACTIVITY_TYPE_META[type] || ACTIVITY_TYPE_META.OTHER;
  return (
    <div className="mt-3 rounded-xl border border-blue-200 bg-blue-50/60 p-3">
      <div className="text-sm font-extrabold text-[#0b2a5b]">Edit {meta.label} — {formatDateTime(activity.createdAt)}</div>
      <div className="mt-2 grid gap-2 sm:grid-cols-3">
        {type === "NAP" ? (
          <>
            <label className="text-xs font-semibold text-gray-700">Start<input type="time" value={form.startTime} onChange={(e) => set({ startTime: e.target.value })} className={input} /></label>
            <label className="text-xs font-semibold text-gray-700">End<input type="time" value={form.endTime} onChange={(e) => set({ endTime: e.target.value })} className={input} /></label>
          </>
        ) : (
          <label className="text-xs font-semibold text-gray-700">Time<input type="time" value={form.time} onChange={(e) => set({ time: e.target.value })} className={input} /></label>
        )}
        {type === "BOTTLE" ? (
          <>
            <label className="text-xs font-semibold text-gray-700">Offered (oz)<input value={form.amount} onChange={(e) => set({ amount: e.target.value })} className={input} /></label>
            <label className="text-xs font-semibold text-gray-700">Consumed (oz)<input value={form.consumed} onChange={(e) => set({ consumed: e.target.value })} className={input} /></label>
          </>
        ) : null}
        {type === "MEAL" || type === "SNACK" ? (
          <label className="text-xs font-semibold text-gray-700">
            Amount eaten
            <select value={form.quantity} onChange={(e) => set({ quantity: e.target.value })} className={input}>
              {Object.entries(QUANTITY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
        ) : null}
        {type === "DIAPER_CHANGE" ? (
          <label className="text-xs font-semibold text-gray-700">
            Diaper
            <select value={form.diaperType} onChange={(e) => set({ diaperType: e.target.value })} className={input}>
              {Object.entries(DIAPER_TYPE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
        ) : null}
        {type === "TOILETING" ? (
          <label className="text-xs font-semibold text-gray-700">
            Result
            <select value={form.toiletingType} onChange={(e) => set({ toiletingType: e.target.value })} className={input}>
              {Object.entries(TOILETING_TYPE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
        ) : null}
      </div>
      <label className="mt-2 block text-xs font-semibold text-gray-700">
        Notes
        <textarea rows={2} value={form.notes} onChange={(e) => set({ notes: e.target.value })} className={input} />
      </label>
      <div className="mt-2 flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700">Cancel</button>
        <button type="button" onClick={save} disabled={saving} className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-60">{saving ? "Saving..." : "Save"}</button>
      </div>
    </div>
  );
}

function RosterTable({ items, hasAttendance, attendanceByChildId, busyChildId, onCheckIn, onCheckOut, onOpenTransfer }) {
  return (
    <div className="mt-3 overflow-x-auto">
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="border-b border-gray-200 bg-slate-50 text-left text-[11px] font-bold uppercase tracking-wide text-gray-500">
            <th className="px-3 py-2">Child Name</th>
            <th className="px-3 py-2 text-center">Status</th>
            <th className="px-3 py-2 text-center">Check In</th>
            <th className="px-3 py-2 text-center">Check Out</th>
            <th className="px-3 py-2 text-center">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {items.map((child) => {
            const att = attendanceByChildId.get(child.id) || null;
            const checkedIn = !!att?.checkedIn;
            const busy = busyChildId === child.id;
            const flags = flagsForChild(child);
            return (
              <tr key={child.id} className="hover:bg-gray-50">
                <td className="px-3 py-2">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-100 text-[11px] font-extrabold text-gray-600">
                      {initials(child)}
                    </div>
                    <Link href={performanceHref(child.id)} className="font-extrabold text-[#0b2a5b] hover:text-blue-700 hover:underline">
                      {fullName(child)}
                    </Link>
                    {flags.map((f) => (
                      <span key={f.label} className={["rounded-md border px-1.5 py-0.5 text-[10px] font-semibold", f.color].join(" ")}>
                        {f.label}
                      </span>
                    ))}
                    {child.hasTemporaryClassRoomToday ? (
                      <span className="rounded-md border border-sky-200 bg-sky-50 px-1.5 py-0.5 text-[10px] font-semibold text-sky-700">Moved today</span>
                    ) : null}
                  </div>
                </td>
                <td className="px-3 py-2 text-center">
                  {checkedIn ? (
                    <span className="inline-flex rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">Checked In</span>
                  ) : (
                    <span className="inline-flex rounded-lg bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700">Not Checked In</span>
                  )}
                </td>
                <td className="px-3 py-2 text-center font-semibold text-[#0b2a5b]">{att?.checkedInAt ? formatTime(att.checkedInAt) : "—"}</td>
                <td className="px-3 py-2 text-center font-semibold text-[#0b2a5b]">{att?.checkedOutAt ? formatTime(att.checkedOutAt) : "—"}</td>
                <td className="px-3 py-2">
                  <div className="mx-auto flex w-28 flex-col gap-1">
                    <button
                      type="button"
                      onClick={() => (checkedIn ? onCheckOut(child.id) : onCheckIn(child.id))}
                      disabled={!hasAttendance || busy}
                      className={[
                        "rounded-md px-2 py-1 text-[11px] font-extrabold text-white disabled:opacity-60",
                        checkedIn ? "bg-slate-700 hover:bg-slate-800" : "bg-emerald-600 hover:bg-emerald-700",
                      ].join(" ")}
                    >
                      {busy ? "Saving..." : checkedIn ? "Check Out" : "Check In"}
                    </button>
                    {checkedIn ? (
                      <button
                        type="button"
                        onClick={() => onOpenTransfer(child)}
                        disabled={busy}
                        className="rounded-md border border-sky-200 bg-sky-50 px-2 py-1 text-[11px] font-bold text-sky-700 hover:bg-sky-100 disabled:opacity-60"
                      >
                        Move Today
                      </button>
                    ) : null}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function StatCard({ label, value, color, icon, onClick, active = false }) {
  const colors = {
    sky: "border-sky-200 bg-sky-50 text-sky-700",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
    gray: "border-gray-200 bg-gray-50 text-gray-600",
    rose: "border-rose-200 bg-rose-50 text-rose-700",
  };
  const valueColors = {
    sky: "text-sky-900",
    emerald: "text-emerald-900",
    gray: "text-gray-900",
    rose: "text-rose-900",
  };
  const Component = onClick ? "button" : "div";
  return (
    <Component
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={[
        "flex h-full flex-col justify-between rounded-xl border p-3 shadow-sm",
        colors[color] || colors.gray,
        onClick ? "text-left transition hover:-translate-y-0.5 hover:shadow-md" : "",
        active ? "ring-2 ring-offset-1 ring-sky-200" : "",
      ].join(" ")}
    >
      <div className="flex items-center justify-between">
        <div className="text-[11px] font-semibold uppercase tracking-wide">{label}</div>
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white/70 text-gray-600">
          {icon}
        </div>
      </div>
      <div className={["mt-1 text-2xl font-extrabold", valueColors[color] || "text-gray-900"].join(" ")}>{value}</div>
    </Component>
  );
}
