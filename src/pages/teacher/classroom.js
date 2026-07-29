import TeacherLayout from "@/components/teacher/TeacherLayout";
import { SkeletonTable } from "@/components/ui/Skeleton";
import { formatAge } from "@/lib/ageUtils";
import { apiJson } from "@/lib/api";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

function byString(a, b) {
  return String(a || "").localeCompare(String(b || ""));
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

  const [selectedAttendanceChildIds, setSelectedAttendanceChildIds] = useState([]);

  const [attendanceHistory, setAttendanceHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const [busyChildId, setBusyChildId] = useState("");
  const [bulkBusy, setBulkBusy] = useState(false);
  const [transferChild, setTransferChild] = useState(null);
  const [transferClassRoomId, setTransferClassRoomId] = useState("");
  const [transferBusy, setTransferBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const selectAllRef = useRef(null);

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
      setSelectedAttendanceChildIds([]);
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
    setSelectedAttendanceChildIds([]);
  }, [classId]);

  useEffect(() => {
    setAttendanceFilter("all");
  }, [centerId, classId]);

  useEffect(() => {
    (async () => {
      if (!centerId) { setAttendanceHistory([]); return; }
      setHistoryLoading(true);
      try {
        const now = new Date();
        const from = new Date(now.getFullYear(), now.getMonth(), 1);
        const qs = new URLSearchParams({ centerId, from: from.toISOString() });
        const res = await apiJson(`/api/v1/attendance/history?${qs.toString()}`);
        setAttendanceHistory(Array.isArray(res) ? res : []);
      } catch { setAttendanceHistory([]); }
      finally { setHistoryLoading(false); }
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
      if (row?.child?.id && !map.has(row.child.id)) map.set(row.child.id, { checkedIn: false });
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

  useEffect(() => {
    const visible = new Set(filteredChildren.map((c) => c.id));
    setSelectedAttendanceChildIds((prev) => prev.filter((id) => visible.has(id)));
  }, [filteredChildren]);

  const selectedAttendanceSet = useMemo(() => {
    return new Set(selectedAttendanceChildIds);
  }, [selectedAttendanceChildIds]);

  const bulkEligible = useMemo(() => {
    let canCheckIn = 0;
    let canCheckOut = 0;
    for (const id of selectedAttendanceChildIds) {
      const att = attendanceByChildId.get(id) || null;
      if (att?.checkedIn) canCheckOut += 1;
      else canCheckIn += 1;
    }
    return { canCheckIn, canCheckOut };
  }, [selectedAttendanceChildIds, attendanceByChildId]);

  const allVisibleIds = useMemo(() => filteredChildren.map((c) => c.id), [filteredChildren]);

  const selectAllState = useMemo(() => {
    const selectedCount = selectedAttendanceChildIds.length;
    const total = allVisibleIds.length;
    const allSelected = total > 0 && selectedCount === total;
    const indeterminate = selectedCount > 0 && selectedCount < total;
    return { allSelected, indeterminate, selectedCount, total };
  }, [allVisibleIds.length, selectedAttendanceChildIds.length]);

  useEffect(() => {
    if (!selectAllRef.current) return;
    selectAllRef.current.indeterminate = selectAllState.indeterminate;
  }, [selectAllState.indeterminate]);

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

  const checkedInSidebarList = useMemo(() => {
    const rows = attendance?.checkedInChildren || [];
    return classId ? rows.filter((row) => row.child?.classRoomId === classId) : rows;
  }, [attendance, classId]);

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

  function toggleAttendanceSelected(childId) {
    if (!childId) return;
    setSelectedAttendanceChildIds((prev) => {
      if (prev.includes(childId)) return prev.filter((id) => id !== childId);
      return [...prev, childId];
    });
  }

  function setAllAttendanceSelected(checked) {
    if (!checked) {
      setSelectedAttendanceChildIds([]);
      return;
    }
    setSelectedAttendanceChildIds(allVisibleIds);
  }

  async function bulkAttendance(action) {
    if (!attendance) return;
    const ids = selectedAttendanceChildIds.slice();
    if (!ids.length) return;

    setBulkBusy(true);
    setError("");
    try {
      const endpoint =
        action === "CHECK_IN" ? "/api/v1/attendance/check-in" : "/api/v1/attendance/check-out";
      const candidateIds = ids.filter((id) => {
        const att = attendanceByChildId.get(id) || null;
        const checkedIn = !!att?.checkedIn;
        return action === "CHECK_IN" ? !checkedIn : checkedIn;
      });

      if (!candidateIds.length) return;

      const results = await Promise.allSettled(
        candidateIds.map((childId) =>
          apiJson(endpoint, {
            method: "POST",
            body: JSON.stringify({ childId }),
          }),
        ),
      );

      const failed = results.filter((r) => r.status === "rejected");
      await refreshAttendance();
      setSelectedAttendanceChildIds([]);

      if (failed.length) {
        setError(
          `Failed to ${action === "CHECK_IN" ? "check in" : "check out"} ${failed.length} of ${candidateIds.length} selected children.`,
        );
      }
    } catch (e) {
      setError(e.message || "Bulk attendance update failed");
    } finally {
      setBulkBusy(false);
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
              <p className="mt-1 text-sm text-gray-600">
                Manage attendance, view the roster, and monitor red flags at a glance.
              </p>
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
                {/* Class list */}
                <div className="rounded-2xl border border-gray-200 bg-white p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 pb-3">
                    <div className="flex items-center gap-3">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-600">
                        <IconUsers className="h-4 w-4" />
                      </span>
                      <h3 className="text-sm font-extrabold text-gray-900">
                        Class Roster
                      </h3>
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-600">
                        {filteredChildren.length}
                      </span>
                      {attendanceFilter !== "all" ? (
                        <span className="rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-xs font-semibold text-sky-700">
                          {attendanceFilterLabel}
                        </span>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-700">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                        {stats.checkedIn} in
                      </span>
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-2 py-0.5 font-semibold text-gray-600">
                        <span className="h-1.5 w-1.5 rounded-full bg-gray-400" />
                        {stats.checkedOut} out
                      </span>
                      {attendanceFilter !== "all" ? (
                        <button
                          type="button"
                          onClick={() => setAttendanceFilter("all")}
                          className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-2 py-0.5 font-semibold text-gray-600 hover:bg-gray-50"
                        >
                          <IconX className="h-3 w-3" />
                          Clear
                        </button>
                      ) : null}
                    </div>
                  </div>

                  {/* Bulk action bar */}
                  {selectAllState.selectedCount > 0 && (
                    <div className="sticky top-2 z-10 mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 shadow-sm">
                      <span className="text-xs font-semibold text-blue-800">
                        {selectAllState.selectedCount} selected
                        <span className="ml-2 text-[11px] font-medium text-blue-700/80">
                          ({bulkEligible.canCheckIn} can check in • {bulkEligible.canCheckOut} can check out)
                        </span>
                      </span>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => bulkAttendance("CHECK_IN")}
                          disabled={!attendance || bulkBusy || bulkEligible.canCheckIn === 0}
                          className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-extrabold text-white hover:bg-emerald-700 disabled:opacity-60"
                        >
                          <IconCheck className="h-4 w-4 text-white/90" />
                          {bulkBusy ? "Saving..." : `Check In (${bulkEligible.canCheckIn})`}
                        </button>
                        <button
                          type="button"
                          onClick={() => bulkAttendance("CHECK_OUT")}
                          disabled={!attendance || bulkBusy || bulkEligible.canCheckOut === 0}
                          className="inline-flex items-center gap-2 rounded-lg bg-gray-700 px-3 py-1.5 text-xs font-extrabold text-white hover:bg-gray-800 disabled:opacity-60"
                        >
                          <IconClock className="h-4 w-4 text-white/90" />
                          {bulkBusy ? "Saving..." : `Check Out (${bulkEligible.canCheckOut})`}
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelectedAttendanceChildIds([])}
                          disabled={bulkBusy}
                          className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                        >
                          <IconX className="h-4 w-4 text-gray-500" />
                          Clear
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Children list */}
                  <div className="mt-3 space-y-2">
                    {/* Select all header */}
                    <div className="flex items-center gap-3 rounded-lg bg-slate-50 px-2 py-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
                      <input
                        ref={selectAllRef}
                        type="checkbox"
                        checked={selectAllState.allSelected}
                        onChange={(e) => setAllAttendanceSelected(e.target.checked)}
                        disabled={!selectAllState.total || bulkBusy}
                        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-600 disabled:opacity-60"
                      />
                      <span className="flex-1">Child</span>
                      <span className="hidden w-24 text-center sm:block">Class</span>
                      <span className="w-28 text-right">Attendance</span>
                    </div>

                    {filteredChildren.length === 0 ? (
                      <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-center text-sm text-gray-600">
                        {attendanceFilter === "all"
                          ? "No children found for the current filters."
                          : `No ${attendanceFilterLabel.toLowerCase()} children found for the current filters.`}
                      </div>
                    ) : (
                      <RosterGroups
                        items={filteredChildren}
                        hasAttendance={!!attendance}
                        attendanceByChildId={attendanceByChildId}
                        selectedAttendanceSet={selectedAttendanceSet}
                        busyChildId={busyChildId}
                        bulkBusy={bulkBusy}
                        classNameById={classNameById}
                        onToggleSelect={toggleAttendanceSelected}
                        onCheckIn={checkIn}
                        onCheckOut={checkOut}
                        onOpenTransfer={openTransfer}
                      />
                    )}
                  </div>
                </div>

                {/* Red flags */}
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
                                href={`/teacher/children/${encodeURIComponent(c.id)}`}
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

                {/* Attendance Summary */}
                <AttendanceSummaryPanel
                  history={attendanceHistory}
                  loading={historyLoading}
                  children={filteredChildren}
                  attendanceByChildId={attendanceByChildId}
                  classNameById={classNameById}
                />
              </div>

              {/* Sidebar */}
              <aside className="min-w-0 space-y-4">
                {/* Checked-in list */}
                <div className="rounded-2xl border border-gray-200 bg-white p-4">
                  <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                    <h3 className="text-sm font-extrabold text-gray-900">
                      Checked In Today
                    </h3>
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-extrabold text-emerald-800">
                        {stats.checkedIn}
                      </span>
                      <Link
                        href="/teacher/logs"
                        className="text-xs font-semibold text-gray-500 hover:text-blue-700"
                      >
                        View logs
                      </Link>
                    </div>
                  </div>
                  {checkedInSidebarList.length ? (
                    <div className="mt-3 divide-y divide-gray-100 overflow-hidden rounded-lg border border-gray-100 bg-white/70">
                      {checkedInSidebarList.slice(0, 15).map((row) => (
                        <div
                          key={row.child?.id}
                          className="flex items-center gap-2.5 px-2 py-2 hover:bg-gray-50"
                        >
                          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-[10px] font-extrabold text-emerald-700">
                            {initials(row.child)}
                          </div>
                          <div className="min-w-0 flex-1">
                            {row.child?.id ? (
                              <Link
                                href={`/teacher/children/${encodeURIComponent(row.child.id)}`}
                                className="truncate text-sm font-semibold text-gray-900 hover:text-blue-700"
                              >
                                {fullName(row.child)}
                              </Link>
                            ) : (
                              <span className="truncate text-sm font-semibold text-gray-900">
                                {fullName(row.child)}
                              </span>
                            )}
                          </div>
                          <span className="shrink-0 text-[10px] text-gray-400">
                            {formatTime(row.checkedInAt)}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-3 rounded-xl border border-gray-200 bg-gray-50 p-3 text-center text-sm text-gray-500">
                      No children checked in yet.
                    </div>
                  )}
                </div>

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
                      href="/teacher/reports"
                      className="group flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-gradient-to-r from-white via-white to-slate-50 px-3 py-2.5 text-sm font-semibold text-gray-800 hover:border-indigo-200 hover:bg-indigo-50/40"
                    >
                      <div className="flex items-center gap-3">
                        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
                          <IconChart className="h-4 w-4" />
                        </span>
                        <div className="leading-tight">
                          <div className="text-sm font-semibold text-gray-900">Reports</div>
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

function AttendanceSummaryPanel({ history, loading, children, attendanceByChildId, classNameById }) {
  const byChild = useMemo(() => {
    const map = new Map();
    for (const r of history || []) {
      const cid = r.childId || r.child?.id;
      if (!cid) continue;
      if (!map.has(cid)) map.set(cid, { present: 0, absent: 0, late: 0, totalHours: 0, hoursCount: 0 });
      const entry = map.get(cid);
      if (r.checkedInAt) {
        entry.present += 1;
        const inTime = new Date(r.checkedInAt);
        if (inTime.getHours() >= 9) entry.late += 1;
        if (r.checkedOutAt) {
          const diff = (new Date(r.checkedOutAt) - inTime) / (1000 * 60 * 60);
          if (diff > 0 && diff < 24) { entry.totalHours += diff; entry.hoursCount += 1; }
        }
      } else {
        entry.absent += 1;
      }
    }
    return map;
  }, [history]);

  const rows = useMemo(() => {
    return (children || []).map((ch) => {
      const data = byChild.get(ch.id) || { present: 0, absent: 0, late: 0, totalHours: 0, hoursCount: 0 };
      const total = data.present + data.absent;
      const rate = total ? Math.round((data.present / total) * 100) : null;
      const avgHrs = data.hoursCount ? (data.totalHours / data.hoursCount).toFixed(1) : "-";
      const todayAtt = attendanceByChildId?.get(ch.id);
      const todayStatus = todayAtt?.checkedIn ? "In" : "Out";
      return {
        id: ch.id,
        name: fullName(ch),
        initials: initials(ch),
        className: classNameById?.[ch.classRoomId] || "Unassigned",
        present: data.present,
        absent: data.absent,
        late: data.late,
        total,
        rate,
        avgHrs,
        todayStatus,
        todayCheckedIn: !!todayAtt?.checkedIn,
      };
    }).sort((a, b) => (a.rate ?? 999) - (b.rate ?? 999));
  }, [children, byChild, attendanceByChildId, classNameById]);

  const overallStats = useMemo(() => {
    let present = 0, absent = 0, late = 0;
    for (const [, data] of byChild) {
      present += data.present;
      absent += data.absent;
      late += data.late;
    }
    const total = present + absent;
    const rate = total ? Math.round((present / total) * 100) : 0;
    return { present, absent, late, total, rate };
  }, [byChild]);

  const monthLabel = new Date().toLocaleDateString(undefined, { month: "long", year: "numeric" });

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-slate-600">
              <IconChart className="h-4 w-4" />
            </span>
            <h3 className="text-sm font-extrabold text-gray-900">Attendance Summary</h3>
          </div>
          <p className="mt-0.5 text-xs text-gray-500">{monthLabel} - all children in selected class/center</p>
        </div>
        {overallStats.total > 0 && (
          <div className="flex flex-wrap gap-2">
            <span className="rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">
              {overallStats.rate}% overall rate
            </span>
            <span className="rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700">
              {overallStats.late} late arrivals
            </span>
          </div>
        )}
      </div>

      {loading ? (
        <div className="mt-3 text-sm text-gray-600">Loading attendance history...</div>
      ) : rows.length === 0 ? (
        <div className="mt-3 rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm text-gray-600">
          No attendance data available.
        </div>
      ) : (
        <div className="mt-3 overflow-hidden rounded-xl border border-gray-200">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-3 py-2.5">Child</th>
                <th className="hidden px-3 py-2.5 sm:table-cell">Class</th>
                <th className="px-3 py-2.5 text-center">Today</th>
                <th className="px-3 py-2.5 text-center">Present</th>
                <th className="px-3 py-2.5 text-center">Absent</th>
                <th className="hidden px-3 py-2.5 text-center sm:table-cell">Late</th>
                <th className="px-3 py-2.5 text-center">Rate</th>
                <th className="hidden px-3 py-2.5 text-center md:table-cell">Avg Hrs</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((r) => (
                <tr key={r.id} className={r.rate !== null && r.rate < 75 ? "bg-rose-50/30" : ""}>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <div className={["flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-extrabold", r.todayCheckedIn ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-600"].join(" ")}>
                        {r.initials}
                      </div>
                      <Link
                        href={`/teacher/children/${encodeURIComponent(r.id)}`}
                        className="truncate text-sm font-semibold text-gray-900 hover:text-blue-700 hover:underline"
                      >
                        {r.name}
                      </Link>
                    </div>
                  </td>
                  <td className="hidden px-3 py-2.5 text-xs text-gray-500 sm:table-cell">{r.className}</td>
                  <td className="px-3 py-2.5 text-center">
                    <span className={["inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold", r.todayCheckedIn ? "bg-emerald-100 text-emerald-800" : "bg-gray-100 text-gray-600"].join(" ")}>
                      <span className={["h-1.5 w-1.5 rounded-full", r.todayCheckedIn ? "bg-emerald-500" : "bg-gray-400"].join(" ")} />
                      {r.todayStatus}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-center text-xs font-semibold text-emerald-700">{r.present}</td>
                  <td className="px-3 py-2.5 text-center text-xs font-semibold text-rose-700">{r.absent}</td>
                  <td className="hidden px-3 py-2.5 text-center text-xs font-semibold text-amber-700 sm:table-cell">{r.late}</td>
                  <td className="px-3 py-2.5 text-center">
                    {r.rate !== null ? (
                      <span className={["rounded-full px-2 py-0.5 text-[11px] font-semibold", r.rate >= 90 ? "bg-emerald-100 text-emerald-800" : r.rate >= 75 ? "bg-amber-100 text-amber-800" : "bg-rose-100 text-rose-800"].join(" ")}>
                        {r.rate}%
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400">-</span>
                    )}
                  </td>
                  <td className="hidden px-3 py-2.5 text-center text-xs text-gray-600 md:table-cell">{r.avgHrs}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function RosterGroups({
  items,
  hasAttendance,
  attendanceByChildId,
  selectedAttendanceSet,
  busyChildId,
  bulkBusy,
  classNameById,
  onToggleSelect,
  onCheckIn,
  onCheckOut,
  onOpenTransfer,
}) {
  if (!items?.length) {
    return (
      <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-center text-sm text-gray-600">
        No children in this list.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {items.map((ch) => (
        <RosterRow
          key={ch.id}
          child={ch}
          hasAttendance={hasAttendance}
          attendanceByChildId={attendanceByChildId}
          selectedAttendanceSet={selectedAttendanceSet}
          busyChildId={busyChildId}
          bulkBusy={bulkBusy}
          classNameById={classNameById}
          onToggleSelect={onToggleSelect}
          onCheckIn={onCheckIn}
          onCheckOut={onCheckOut}
          onOpenTransfer={onOpenTransfer}
        />
      ))}
    </div>
  );
}

function RosterRow({
  child,
  hasAttendance,
  attendanceByChildId,
  selectedAttendanceSet,
  busyChildId,
  bulkBusy,
  classNameById,
  onToggleSelect,
  onCheckIn,
  onCheckOut,
  onOpenTransfer,
}) {
  const att = attendanceByChildId.get(child.id) || null;
  const checkedIn = !!att?.checkedIn;
  const checkedInAt = att?.checkedInAt ? formatTime(att.checkedInAt) : "";
  const busy = busyChildId === child.id;
  const selected = selectedAttendanceSet.has(child.id);
  const flags = flagsForChild(child);
  const age = formatAge(child.birthDate);

  return (
    <div
      className={[
        "flex items-center gap-3 rounded-xl border p-3 shadow-sm transition hover:shadow-md",
        checkedIn
          ? "border-emerald-200 bg-emerald-50/40"
          : selected
            ? "border-blue-200 bg-blue-50/30"
            : "border-gray-200 bg-white hover:bg-gray-50",
      ].join(" ")}
    >
      <input
        type="checkbox"
        checked={selected}
        onChange={() => onToggleSelect(child.id)}
        disabled={bulkBusy}
        className="h-4 w-4 shrink-0 rounded border-gray-300 text-blue-600 focus:ring-blue-600 disabled:opacity-60"
      />

      {/* Avatar */}
      <div className={[
        "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-extrabold ring-1 ring-inset",
        checkedIn
          ? "bg-emerald-100 text-emerald-700 ring-emerald-200"
          : "bg-gray-100 text-gray-600 ring-gray-200",
      ].join(" ")}>
        {initials(child)}
      </div>

      {/* Name + flags */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <Link
            href={`/teacher/children/${encodeURIComponent(child.id)}`}
            className="truncate text-sm font-extrabold text-gray-900 hover:text-blue-700 hover:underline"
          >
            {fullName(child)}
          </Link>
          {age && (
            <span className="hidden shrink-0 text-[10px] text-gray-400 sm:inline">
              {age}
            </span>
          )}
        </div>
        {checkedIn && checkedInAt ? (
          <div className="mt-0.5 text-[11px] font-semibold text-emerald-700">
            Checked in at {checkedInAt}
          </div>
        ) : null}
        {(flags.length > 0 || child.hasTemporaryClassRoomToday) && (
          <div className="mt-1 flex flex-wrap gap-1">
            {flags.map((f) => (
              <span key={f.label} className={["rounded-md border px-1.5 py-0.5 text-[10px] font-semibold", f.color].join(" ")}>
                {f.label}
              </span>
            ))}
            {child.hasTemporaryClassRoomToday ? (
              <span className="rounded-md border border-sky-200 bg-sky-50 px-1.5 py-0.5 text-[10px] font-semibold text-sky-700">
                Moved today
              </span>
            ) : null}
          </div>
        )}
      </div>

      {/* Class */}
      <div className="hidden w-24 shrink-0 text-center text-xs text-gray-500 sm:block">
        {classNameById[child.classRoomId] || "Unassigned"}
      </div>

      {/* Attendance */}
      <div className="w-36 shrink-0 space-y-2 text-right">
        <button
          type="button"
          onClick={() => (checkedIn ? onCheckOut(child.id) : onCheckIn(child.id))}
          disabled={!hasAttendance || busy}
          className={[
            "inline-flex w-full items-center justify-center gap-2 rounded-lg px-3 py-1.5 text-xs font-extrabold text-white shadow-sm disabled:opacity-60",
            checkedIn ? "bg-gray-700 hover:bg-gray-800" : "bg-emerald-600 hover:bg-emerald-700",
          ].join(" ")}
        >
          {busy ? (
            <span className="inline-flex items-center gap-2">
              <span className="h-2 w-2 animate-pulse rounded-full bg-white/80" />
              Saving
            </span>
          ) : checkedIn ? (
            <>
              <IconClock className="h-3.5 w-3.5 text-white/90" />
              Check Out
            </>
          ) : (
            <>
              <IconCheck className="h-3.5 w-3.5 text-white/90" />
              Check In
            </>
          )}
        </button>
        {checkedIn ? (
          <button
            type="button"
            onClick={() => onOpenTransfer(child)}
            disabled={busy || bulkBusy}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-bold text-sky-700 hover:bg-sky-100 disabled:opacity-60"
          >
            <IconSwap className="h-3.5 w-3.5" />
            Move Today
          </button>
        ) : null}
      </div>
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
