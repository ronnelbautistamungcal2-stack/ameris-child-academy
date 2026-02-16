import TeacherLayout from "@/components/teacher/TeacherLayout";
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

function formatTime(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString();
}

export default function TeacherClassroom() {
  const [centers, setCenters] = useState([]);
  const [centerId, setCenterId] = useState("");

  const [classes, setClasses] = useState([]);
  const [classId, setClassId] = useState("");

  const [children, setChildren] = useState([]);
  const [attendance, setAttendance] = useState(null);

  const [selectedChildId, setSelectedChildId] = useState("");
  const [selectedAttendanceChildIds, setSelectedAttendanceChildIds] = useState([]);
  const [progress, setProgress] = useState([]);
  const [loadingProgress, setLoadingProgress] = useState(false);

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
      setSelectedChildId("");
      setSelectedAttendanceChildIds([]);
      setProgress([]);
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
    setSelectedChildId("");
    setSelectedAttendanceChildIds([]);
    setProgress([]);
  }, [classId]);

  useEffect(() => {
    (async () => {
      if (!selectedChildId) {
        setProgress([]);
        return;
      }
      setLoadingProgress(true);
      try {
        const p = await apiJson(`/api/v1/progress?childId=${encodeURIComponent(selectedChildId)}`);
        setProgress(Array.isArray(p) ? p : []);
      } catch {
        setProgress([]);
      } finally {
        setLoadingProgress(false);
      }
    })();
  }, [selectedChildId]);

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
    return byClass.slice().sort((a, b) => byString(a.firstName, b.firstName));
  }, [children, classId]);

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

  const activeGoals = useMemo(() => {
    const rows = Array.isArray(progress) ? progress : [];
    const active = rows.filter((p) => ["NOT_STARTED", "IN_PROGRESS"].includes(p?.status));
    return active
      .slice()
      .sort((a, b) => {
        const cmpTitle = byString(a?.lesson?.title, b?.lesson?.title);
        if (cmpTitle !== 0) return cmpTitle;
        return Number(a?.goalIndex || 0) - Number(b?.goalIndex || 0);
      })
      .slice(0, 6);
  }, [progress]);

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
        <div className="rounded-2xl border border-gray-200 bg-white p-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-extrabold text-gray-900">My Classroom</h2>
              <p className="mt-1 text-sm text-gray-600">
                Roster, clock-in/out, red flags, and active goals.
              </p>
            </div>

            <div className="grid w-full gap-3 sm:w-auto sm:grid-cols-2">
              <label className="block">
                <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Center
                </div>
                <select
                  value={centerId}
                  onChange={(e) => setCenterId(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm sm:w-64"
                >
                  <option value="">Select a center…</option>
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
                  className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm sm:w-64"
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

          {error ? (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              {error}
            </div>
          ) : null}

          {loading ? (
            <div className="mt-4 text-sm text-gray-600">Loading…</div>
          ) : !centerId ? (
            <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
              Select a center to view your classroom roster.
            </div>
          ) : (
            <div className="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-[1fr_360px]">
              <div className="min-w-0 space-y-4">
                <div className="rounded-2xl border border-gray-200 bg-white p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                        Class list
                      </div>
                      <div className="mt-1 text-sm text-gray-700">
                        {filteredChildren.length} children
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => refreshAttendance()}
                        className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-extrabold text-gray-800 hover:bg-gray-50"
                      >
                        Refresh attendance
                      </button>
                      <Link
                        href="/teacher/logs"
                        className="rounded-xl bg-blue-600 px-3 py-2 text-xs font-extrabold text-white hover:bg-blue-700"
                      >
                        Log activity
                      </Link>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs">
                    <div className="font-semibold text-gray-700">
                      {selectAllState.selectedCount
                        ? `${selectAllState.selectedCount} selected`
                        : "Select children to bulk check-in/out"}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => bulkAttendance("CHECK_IN")}
                        disabled={!attendance || bulkBusy || !selectAllState.selectedCount}
                        className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-extrabold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {bulkBusy ? "Savingâ€¦" : "Check in selected"}
                      </button>
                      <button
                        type="button"
                        onClick={() => bulkAttendance("CHECK_OUT")}
                        disabled={!attendance || bulkBusy || !selectAllState.selectedCount}
                        className="rounded-xl bg-gray-700 px-3 py-2 text-xs font-extrabold text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {bulkBusy ? "Savingâ€¦" : "Check out selected"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedAttendanceChildIds([])}
                        disabled={!selectAllState.selectedCount || bulkBusy}
                        className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-extrabold text-gray-800 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Clear
                      </button>
                    </div>
                  </div>

                  <div className="mt-3 overflow-hidden rounded-xl border border-gray-200">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-500">
                        <tr>
                          <th className="px-4 py-3">
                            <input
                              ref={selectAllRef}
                              type="checkbox"
                              checked={selectAllState.allSelected}
                              onChange={(e) => setAllAttendanceSelected(e.target.checked)}
                              disabled={!selectAllState.total || bulkBusy}
                              aria-label="Select all children in table"
                              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-600 disabled:cursor-not-allowed disabled:opacity-60"
                            />
                          </th>
                          <th className="px-4 py-3">Child</th>
                          <th className="px-4 py-3">Class</th>
                          <th className="px-4 py-3">Clocked In</th>
                          <th className="px-4 py-3">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {filteredChildren.map((ch) => {
                          const att = attendanceByChildId.get(ch.id) || null;
                          const checkedIn = !!att?.checkedIn;
                          const busy = busyChildId === ch.id;
                          const selected = selectedAttendanceSet.has(ch.id);
                          return (
                            <tr key={ch.id}>
                              <td className="px-4 py-3">
                                <input
                                  type="checkbox"
                                  checked={selected}
                                  onChange={() => toggleAttendanceSelected(ch.id)}
                                  disabled={bulkBusy}
                                  aria-label={`Select ${fullName(ch)}`}
                                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-600 disabled:cursor-not-allowed disabled:opacity-60"
                                />
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  <div className="min-w-0">
                                    <Link
                                      href={`/teacher/children/${encodeURIComponent(ch.id)}`}
                                      className="truncate font-semibold text-blue-700 hover:underline"
                                    >
                                      {fullName(ch)}
                                    </Link>
                                    <div className="mt-1 flex flex-wrap gap-2 text-xs">
                                      {ch.allergies ? (
                                        <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-1 font-semibold text-amber-900">
                                          Allergies
                                        </span>
                                      ) : null}
                                      {!ch.birthDate ? (
                                        <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-1 font-semibold text-amber-900">
                                          Missing DOB
                                        </span>
                                      ) : null}
                                      {!ch.emergencyContact ? (
                                        <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-1 font-semibold text-amber-900">
                                          Missing emergency contact
                                        </span>
                                      ) : null}
                                    </div>
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-gray-700">
                                {classNameById[ch.classRoomId] || ch.classRoomId || "—"}
                              </td>
                              <td className="px-4 py-3">
                                {attendance ? (
                                  checkedIn ? (
                                    <div className="text-sm font-semibold text-emerald-700">
                                      Yes <span className="text-xs font-normal text-emerald-700/70">({formatTime(att?.checkedInAt)})</span>
                                    </div>
                                  ) : (
                                    <div className="text-sm font-semibold text-gray-700">No</div>
                                  )
                                ) : (
                                  <div className="text-sm text-gray-600">—</div>
                                )}
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex flex-wrap gap-2">
                                  <button
                                    type="button"
                                    onClick={() => (checkedIn ? checkOut(ch.id) : checkIn(ch.id))}
                                    disabled={!attendance || busy}
                                    className={[
                                      "rounded-xl px-3 py-2 text-xs font-extrabold text-white disabled:cursor-not-allowed disabled:opacity-60",
                                      checkedIn ? "bg-gray-700 hover:bg-gray-800" : "bg-emerald-600 hover:bg-emerald-700",
                                    ].join(" ")}
                                  >
                                    {busy ? "Saving…" : checkedIn ? "Check out" : "Check in"}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setSelectedChildId(ch.id)}
                                    className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-extrabold text-gray-800 hover:bg-gray-50"
                                  >
                                    View goals
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                        {filteredChildren.length === 0 ? (
                          <tr>
                            <td className="px-4 py-3 text-gray-600" colSpan={5}>
                              No children found for this filter.
                            </td>
                          </tr>
                        ) : null}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="rounded-2xl border border-gray-200 bg-white p-4">
                  <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Redflagged
                  </div>
                  {redFlagged.length ? (
                    <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {redFlagged.slice(0, 8).map((c) => (
                        <div
                          key={c.id}
                          className="rounded-xl border border-amber-200 bg-amber-50 p-3"
                        >
                          <Link
                            href={`/teacher/children/${encodeURIComponent(c.id)}`}
                            className="font-semibold text-amber-900 hover:underline"
                          >
                            {fullName(c)}
                          </Link>
                          <div className="mt-1 text-xs text-amber-900/80">
                            {[c.allergies ? "Allergies" : null, !c.birthDate ? "Missing DOB" : null, !c.emergencyContact ? "Missing emergency contact" : null]
                              .filter(Boolean)
                              .join(" • ")}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-3 rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm text-gray-600">
                      No red flags detected for the current roster.
                    </div>
                  )}
                </div>
              </div>

              <aside className="min-w-0 space-y-4">
                <div className="rounded-2xl border border-gray-200 bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                        Child progress / goals
                      </div>
                      <div className="mt-1 text-sm text-gray-700">
                        Active goals only (showing up to 6)
                      </div>
                    </div>
                    <Link
                      href="/teacher/progress"
                      className="shrink-0 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-extrabold text-gray-800 hover:bg-gray-50"
                    >
                      Full progress
                    </Link>
                  </div>

                  <label className="mt-3 block">
                    <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Child
                    </div>
                    <select
                      value={selectedChildId}
                      onChange={(e) => setSelectedChildId(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
                    >
                      <option value="">Select a child…</option>
                      {filteredChildren.map((c) => (
                        <option key={c.id} value={c.id}>
                          {fullName(c)}
                        </option>
                      ))}
                    </select>
                  </label>

                  {!selectedChildId ? (
                    <div className="mt-3 rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm text-gray-600">
                      Select a child to view active goals.
                    </div>
                  ) : loadingProgress ? (
                    <div className="mt-3 text-sm text-gray-600">Loading…</div>
                  ) : activeGoals.length ? (
                    <div className="mt-3 space-y-2">
                      {activeGoals.map((p) => (
                        <div key={p.id} className="rounded-xl border border-gray-200 bg-white p-3">
                          <div className="text-sm font-extrabold text-gray-900">
                            {p.lesson?.title || "Lesson"}
                          </div>
                          <div className="mt-1 text-xs text-gray-600">
                            Step {p.goalIndex || 1} • {p.status}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-3 rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm text-gray-600">
                      No active goals found for this child.
                    </div>
                  )}
                </div>

                <div className="rounded-2xl border border-gray-200 bg-white p-4">
                  <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Children clocked in
                  </div>
                  {attendance?.checkedInChildren?.length ? (
                    <ul className="mt-3 space-y-2">
                      {attendance.checkedInChildren.slice(0, 10).map((row) => (
                        <li
                          key={row.child?.id}
                          className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm"
                        >
                          {row.child?.id ? (
                            <Link
                              href={`/teacher/children/${encodeURIComponent(row.child.id)}`}
                              className="min-w-0 truncate font-semibold text-blue-700 hover:underline"
                            >
                              {fullName(row.child)}
                            </Link>
                          ) : (
                            <span className="min-w-0 truncate font-semibold text-gray-900">
                              {fullName(row.child)}
                            </span>
                          )}
                          <span className="shrink-0 text-xs text-gray-500">
                            {formatTime(row.checkedInAt)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="mt-3 rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm text-gray-600">
                      No checked-in children yet.
                    </div>
                  )}
                </div>
              </aside>
            </div>
          )}
        </div>
      </div>
    </TeacherLayout>
  );
}
