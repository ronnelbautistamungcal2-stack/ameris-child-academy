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


function flagsForChild(ch) {
  const flags = [];
  if (ch?.allergies) flags.push({ label: "Allergies", color: "border-red-200 bg-red-50 text-red-800" });
  if (!ch?.emergencyContact) flags.push({ label: "No emergency contact", color: "border-amber-200 bg-amber-50 text-amber-800" });
  if (!ch?.birthDate) flags.push({ label: "Missing DOB", color: "border-amber-200 bg-amber-50 text-amber-800" });
  return flags;
}

export default function TeacherClassroom() {
  const [centers, setCenters] = useState([]);
  const [centerId, setCenterId] = useState("");

  const [classes, setClasses] = useState([]);
  const [classId, setClassId] = useState("");
  const [search, setSearch] = useState("");

  const [children, setChildren] = useState([]);
  const [attendance, setAttendance] = useState(null);

  const [selectedAttendanceChildIds, setSelectedAttendanceChildIds] = useState([]);

  const [attendanceHistory, setAttendanceHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const [busyChildId, setBusyChildId] = useState("");
  const [bulkBusy, setBulkBusy] = useState(false);
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
      return;
    }
    try {
      const att = await apiJson(`/api/v1/attendance/today?centerId=${encodeURIComponent(id)}`);
      setAttendance(att);
    } catch {
      setAttendance(null);
    }
  }

  useEffect(() => {
    if (!centerId) {
      setClasses([]);
      setChildren([]);
      setClassId("");
      setAttendance(null);
      setSelectedAttendanceChildIds([]);
      return;
    }

    (async () => {
      setLoading(true);
      setError("");
      try {
        const [cls, kids] = await Promise.all([
          apiJson(`/api/v1/classes?centerId=${encodeURIComponent(centerId)}`),
          apiJson(`/api/v1/children?centerId=${encodeURIComponent(centerId)}`),
        ]);
        setClasses(Array.isArray(cls) ? cls : []);
        setChildren(Array.isArray(kids) ? kids : []);
        await refreshAttendance(centerId);
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

  const filteredChildren = useMemo(() => {
    const base = children || [];
    const byClass = classId ? base.filter((c) => c.classRoomId === classId) : base;
    const q = search.trim().toLowerCase();
    const searched = q
      ? byClass.filter((c) => fullName(c).toLowerCase().includes(q))
      : byClass;
    return searched.slice().sort((a, b) => byString(a.firstName, b.firstName));
  }, [children, classId, search]);

  useEffect(() => {
    const visible = new Set(filteredChildren.map((c) => c.id));
    setSelectedAttendanceChildIds((prev) => prev.filter((id) => visible.has(id)));
  }, [filteredChildren]);

  const selectedAttendanceSet = useMemo(() => {
    return new Set(selectedAttendanceChildIds);
  }, [selectedAttendanceChildIds]);

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
    const total = filteredChildren.length;
    let checkedIn = 0;
    for (const ch of filteredChildren) {
      const att = attendanceByChildId.get(ch.id);
      if (att?.checkedIn) checkedIn += 1;
    }
    return { total, checkedIn, checkedOut: total - checkedIn, flagged: redFlagged.length };
  }, [filteredChildren, attendanceByChildId, redFlagged.length]);

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

  return (
    <TeacherLayout title="My Classroom">
      <div className="space-y-4">
        {/* Header */}
        <div className="rounded-2xl border border-gray-200 bg-gradient-to-r from-sky-50 to-cyan-50 p-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-extrabold text-gray-900">My Classroom</h2>
              <p className="mt-1 text-sm text-gray-600">
                Manage attendance, view roster, and monitor red flags.
              </p>
            </div>

            <div className="flex flex-wrap items-end gap-3">
              <label className="block">
                <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Center
                </div>
                <select
                  value={centerId}
                  onChange={(e) => setCenterId(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm sm:w-52"
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
                  className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm sm:w-52"
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
            </div>
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
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatCard label="Total Children" value={stats.total} color="sky" />
              <StatCard label="Checked In" value={stats.checkedIn} color="emerald" />
              <StatCard label="Not Checked In" value={stats.checkedOut} color="gray" />
              <StatCard label="Red Flagged" value={stats.flagged} color="rose" />
            </div>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_340px]">
              {/* Main content */}
              <div className="min-w-0 space-y-4">
                {/* Class list */}
                <div className="rounded-2xl border border-gray-200 bg-white p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <h3 className="text-sm font-extrabold text-gray-900">
                        Class Roster
                      </h3>
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-600">
                        {filteredChildren.length}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => refreshAttendance()}
                        className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                      >
                        Refresh
                      </button>
                      <Link
                        href="/teacher/logs"
                        className="rounded-xl bg-blue-600 px-3 py-2 text-xs font-extrabold text-white hover:bg-blue-700"
                      >
                        Log Activity
                      </Link>
                    </div>
                  </div>

                  {/* Search */}
                  <div className="mt-3">
                    <input
                      type="text"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search by name..."
                      className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm focus:border-blue-300 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-300 sm:max-w-xs"
                    />
                  </div>

                  {/* Bulk action bar */}
                  {selectAllState.selectedCount > 0 && (
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2">
                      <span className="text-xs font-semibold text-blue-800">
                        {selectAllState.selectedCount} selected
                      </span>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => bulkAttendance("CHECK_IN")}
                          disabled={!attendance || bulkBusy}
                          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-extrabold text-white hover:bg-emerald-700 disabled:opacity-60"
                        >
                          {bulkBusy ? "Saving..." : "Check In All"}
                        </button>
                        <button
                          type="button"
                          onClick={() => bulkAttendance("CHECK_OUT")}
                          disabled={!attendance || bulkBusy}
                          className="rounded-lg bg-gray-700 px-3 py-1.5 text-xs font-extrabold text-white hover:bg-gray-800 disabled:opacity-60"
                        >
                          {bulkBusy ? "Saving..." : "Check Out All"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelectedAttendanceChildIds([])}
                          disabled={bulkBusy}
                          className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                        >
                          Clear
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Children list */}
                  <div className="mt-3 space-y-2">
                    {/* Select all header */}
                    <div className="flex items-center gap-3 px-1 text-xs font-semibold uppercase tracking-wide text-gray-400">
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
                      <span className="w-20 text-center">Status</span>
                      <span className="w-24 text-right">Action</span>
                    </div>

                    {filteredChildren.length === 0 ? (
                      <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-center text-sm text-gray-600">
                        No children found.
                      </div>
                    ) : filteredChildren.map((ch) => {
                      const att = attendanceByChildId.get(ch.id) || null;
                      const checkedIn = !!att?.checkedIn;
                      const busy = busyChildId === ch.id;
                      const selected = selectedAttendanceSet.has(ch.id);
                      const flags = flagsForChild(ch);
                      const age = formatAge(ch.birthDate);

                      return (
                        <div
                          key={ch.id}
                          className={[
                            "flex items-center gap-3 rounded-xl border p-3 transition",
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
                            onChange={() => toggleAttendanceSelected(ch.id)}
                            disabled={bulkBusy}
                            className="h-4 w-4 shrink-0 rounded border-gray-300 text-blue-600 focus:ring-blue-600 disabled:opacity-60"
                          />

                          {/* Avatar */}
                          <div className={[
                            "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-extrabold",
                            checkedIn
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-gray-100 text-gray-600",
                          ].join(" ")}>
                            {initials(ch)}
                          </div>

                          {/* Name + flags */}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <Link
                                href={`/teacher/children/${encodeURIComponent(ch.id)}`}
                                className="truncate text-sm font-extrabold text-gray-900 hover:text-blue-700 hover:underline"
                              >
                                {fullName(ch)}
                              </Link>
                              {age && (
                                <span className="hidden shrink-0 text-[10px] text-gray-400 sm:inline">
                                  {age}
                                </span>
                              )}
                            </div>
                            {flags.length > 0 && (
                              <div className="mt-1 flex flex-wrap gap-1">
                                {flags.map((f) => (
                                  <span key={f.label} className={["rounded-md border px-1.5 py-0.5 text-[10px] font-semibold", f.color].join(" ")}>
                                    {f.label}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Class */}
                          <div className="hidden w-24 shrink-0 text-center text-xs text-gray-500 sm:block">
                            {classNameById[ch.classRoomId] || "Unassigned"}
                          </div>

                          {/* Status */}
                          <div className="w-20 shrink-0 text-center">
                            {attendance ? (
                              checkedIn ? (
                                <div className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
                                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                  In
                                </div>
                              ) : (
                                <div className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-600">
                                  <span className="h-1.5 w-1.5 rounded-full bg-gray-400" />
                                  Out
                                </div>
                              )
                            ) : (
                              <span className="text-xs text-gray-400">--</span>
                            )}
                          </div>

                          {/* Action */}
                          <div className="w-24 shrink-0 text-right">
                            <button
                              type="button"
                              onClick={() => (checkedIn ? checkOut(ch.id) : checkIn(ch.id))}
                              disabled={!attendance || busy}
                              className={[
                                "rounded-lg px-3 py-1.5 text-xs font-extrabold text-white disabled:opacity-60",
                                checkedIn ? "bg-gray-600 hover:bg-gray-700" : "bg-emerald-600 hover:bg-emerald-700",
                              ].join(" ")}
                            >
                              {busy ? "..." : checkedIn ? "Check Out" : "Check In"}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Red flags */}
                {redFlagged.length > 0 && (
                  <div className="rounded-2xl border border-rose-200 bg-rose-50/50 p-4">
                    <div className="flex items-center gap-2">
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
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-extrabold text-gray-900">
                      Checked In Today
                    </h3>
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-extrabold text-emerald-800">
                      {stats.checkedIn}
                    </span>
                  </div>
                  {attendance?.checkedInChildren?.length ? (
                    <div className="mt-3 space-y-1.5">
                      {attendance.checkedInChildren.slice(0, 15).map((row) => (
                        <div
                          key={row.child?.id}
                          className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-gray-50"
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
                  <h3 className="text-sm font-extrabold text-gray-900">Quick Actions</h3>
                  <div className="mt-3 grid grid-cols-1 gap-2">
                    <Link
                      href="/teacher/logs"
                      className="rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-semibold text-gray-800 hover:bg-gray-50"
                    >
                      Log Activity
                    </Link>
                    <Link
                      href="/teacher/checklists"
                      className="rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-semibold text-gray-800 hover:bg-gray-50"
                    >
                      Checklists
                    </Link>
                    <Link
                      href="/teacher/reports"
                      className="rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-semibold text-gray-800 hover:bg-gray-50"
                    >
                      Reports
                    </Link>
                  </div>
                </div>
              </aside>
            </div>
          </>
        )}
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-extrabold text-gray-900">Attendance Summary</h3>
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

function StatCard({ label, value, color }) {
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
  return (
    <div className={["rounded-xl border p-3", colors[color] || colors.gray].join(" ")}>
      <div className="text-[11px] font-semibold uppercase tracking-wide">{label}</div>
      <div className={["mt-1 text-2xl font-extrabold", valueColors[color] || "text-gray-900"].join(" ")}>{value}</div>
    </div>
  );
}
