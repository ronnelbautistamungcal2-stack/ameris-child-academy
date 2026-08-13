import AdminLayout from "@/components/admin/AdminLayout";
import { SkeletonTable } from "@/components/ui/Skeleton";
import { apiJson } from "@/lib/api";
import { roleLabel } from "@/lib/roles";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

export default function AdminTeachers() {
  const [staff, setStaff] = useState([]);
  const [centers, setCenters] = useState([]);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [toast, setToast] = useState("");

  const [selectedTeacherId, setSelectedTeacherId] = useState("");
  const [selectedCenterIds, setSelectedCenterIds] = useState([]);
  const [selectedClassIds, setSelectedClassIds] = useState([]);
  const [saving, setSaving] = useState(false);

  async function refresh() {
    setError("");
    setLoading(true);
    try {
      const [s, c, cls] = await Promise.all([
        apiJson("/api/v1/teachers"),
        apiJson("/api/v1/centers"),
        apiJson("/api/v1/classes"),
      ]);
      setStaff(Array.isArray(s) ? s : []);
      setCenters(Array.isArray(c) ? c : []);
      setClasses(Array.isArray(cls) ? cls : []);
    } catch (e) {
      setError(e.message || "Failed to load staff");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  const staffById = useMemo(() => {
    return Object.fromEntries(staff.map((s) => [s.id, s]));
  }, [staff]);

  const selectedStaffMember = selectedTeacherId ? staffById[selectedTeacherId] : null;
  const selectedIsTeacher = (selectedStaffMember?.roles?.length
    ? selectedStaffMember.roles
    : [selectedStaffMember?.role]
  ).includes("TEACHER");

  useEffect(() => {
    if (!selectedStaffMember) {
      setSelectedCenterIds([]);
      setSelectedClassIds([]);
      return;
    }

    const staffRole = selectedStaffMember.roles?.length
      ? selectedStaffMember.roles[0]
      : selectedStaffMember.role;

    const staffCenters = (selectedStaffMember.centers || [])
      .filter((cu) => cu.role === staffRole)
      .map((cu) => cu.centerId);

    const staffClasses = (selectedStaffMember.teacherClasses || []).map((tc) => tc.classId);

    setSelectedCenterIds(staffCenters);
    setSelectedClassIds(staffClasses);
  }, [selectedTeacherId]);

  const sortedStaff = useMemo(() => {
    let list = [...staff].sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (s) =>
          (s.name || "").toLowerCase().includes(q) ||
          (s.email || "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [staff, search]);

  const availableClassIds = useMemo(() => {
    if (!selectedCenterIds.length) return [];
    const selectedCenterIdSet = new Set(selectedCenterIds);
    return classes
      .filter((c) => selectedCenterIdSet.has(c.centerId))
      .map((c) => c.id);
  }, [classes, selectedCenterIds]);

  const availableClasses = useMemo(() => {
    if (!availableClassIds.length) return [];
    const availableClassIdSet = new Set(availableClassIds);
    return classes.filter((c) => availableClassIdSet.has(c.id));
  }, [availableClassIds, classes]);

  useEffect(() => {
    setSelectedClassIds((current) => {
      if (!current.length) return current;
      const availableClassIdSet = new Set(availableClassIds);
      const next = current.filter((id) => availableClassIdSet.has(id));
      return next.length === current.length ? current : next;
    });
  }, [availableClassIds]);

  function toggleInList(list, id) {
    return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
  }

  const stats = useMemo(() => {
    const total = staff.length;
    const assigned = staff.filter((s) => (s.centers || []).length > 0).length;
    return { total, assigned, unassigned: total - assigned };
  }, [staff]);

  async function saveAssignments() {
    if (!selectedStaffMember) return;
    setSaving(true);
    setError("");
    try {
      await apiJson(`/api/v1/teachers/${selectedStaffMember.id}/assignments`, {
        method: "PUT",
        body: JSON.stringify({
          centerIds: selectedCenterIds,
          classIds: selectedClassIds,
        }),
      });
      await refresh();
      setToast("Assignments saved successfully!");
      setTimeout(() => setToast(""), 3000);
    } catch (e) {
      setError(e.message || "Failed to save assignments");
    } finally {
      setSaving(false);
    }
  }

  function getInitials(name) {
    if (!name) return "?";
    return name
      .split(" ")
      .map((w) => w[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  }

  function getStaffCenters(s) {
    return (s.centers || []).map((cu) => cu.center?.name || cu.centerId);
  }

  function getStaffClasses(s) {
    return (s.teacherClasses || []).map((tc) => tc.classRoom?.name || tc.classId);
  }

  function getStaffRoleLabel(s) {
    const role = s.roles?.length ? s.roles[0] : s.role;
    return roleLabel(role);
  }

  return (
    <AdminLayout title="Staff">
      {/* Toast */}
      {toast && (
        <div className="fixed right-6 top-6 z-50 flex items-center gap-2 rounded-2xl border border-green-200 bg-green-50 px-5 py-3 text-sm font-semibold text-green-800 shadow-lg animate-in fade-in">
          <CheckCircleIcon className="h-5 w-5 text-green-600" />
          {toast}
        </div>
      )}

      {/* Stats */}
      {!loading && (
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard
            label="Total Staff"
            value={stats.total}
            icon={<UsersIcon className="h-6 w-6 text-blue-600" />}
            bg="bg-blue-50"
          />
          <StatCard
            label="Assigned"
            value={stats.assigned}
            icon={<CheckCircleIcon className="h-6 w-6 text-emerald-600" />}
            bg="bg-emerald-50"
          />
          <StatCard
            label="Unassigned"
            value={stats.unassigned}
            icon={<AlertIcon className="h-6 w-6 text-amber-600" />}
            bg="bg-amber-50"
          />
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_420px]">
        {/* Staff list */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-extrabold text-gray-900">Staff</h2>
              <p className="mt-0.5 text-sm text-gray-500">
                Click a staff member to manage their assignments.
              </p>
            </div>
            <div className="relative">
              <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search staff…"
                className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2.5 pl-9 pr-4 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 sm:w-64"
              />
            </div>
          </div>

          {loading ? (
            <div className="mt-5">
              <SkeletonTable rows={4} cols={4} />
            </div>
          ) : sortedStaff.length === 0 ? (
            <div className="mt-8 flex flex-col items-center py-10 text-center">
              <div className="rounded-full bg-gray-100 p-4">
                <UsersIcon className="h-8 w-8 text-gray-400" />
              </div>
              <p className="mt-3 text-sm font-semibold text-gray-700">
                {search ? "No staff match your search" : "No staff found"}
              </p>
              <p className="mt-1 text-xs text-gray-500">
                {search
                  ? "Try a different search term."
                  : "Staff will appear here once they sign up."}
              </p>
            </div>
          ) : (
            <div className="mt-5 space-y-2">
              {sortedStaff.map((s) => {
                const sCenters = getStaffCenters(s);
                const sClasses = getStaffClasses(s);
                const isSelected = selectedTeacherId === s.id;
                const isUnassigned = sCenters.length === 0 && sClasses.length === 0;

                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSelectedTeacherId(s.id)}
                    className={[
                      "flex w-full items-center gap-4 rounded-xl border p-4 text-left transition",
                      isSelected
                        ? "border-blue-300 bg-blue-50 ring-2 ring-blue-100"
                        : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50",
                    ].join(" ")}
                  >
                    {/* Avatar */}
                    <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-800 to-sky-600 text-sm font-bold text-white">
                      {getInitials(s.name)}
                    </div>

                    {/* Info */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-bold text-gray-900">
                          {s.name || "Unnamed"}
                        </span>
                        <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-gray-600">
                          {getStaffRoleLabel(s)}
                        </span>
                        {isUnassigned && (
                          <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700">
                            Unassigned
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 truncate text-xs text-gray-500">
                        {s.email}
                      </div>
                      {(sCenters.length > 0 || sClasses.length > 0) && (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {sCenters.map((name, i) => (
                            <span
                              key={`c-${i}`}
                              className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-800"
                            >
                              {name}
                            </span>
                          ))}
                          {sClasses.map((name, i) => (
                            <span
                              key={`cl-${i}`}
                              className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800"
                            >
                              {name}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Chevron */}
                    <svg
                      className="h-5 w-5 flex-shrink-0 text-gray-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Assignment panel */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6">
          <h3 className="text-base font-extrabold text-gray-900">Assignments</h3>

          {!selectedStaffMember ? (
            <div className="mt-8 flex flex-col items-center py-10 text-center">
              <div className="rounded-full bg-gray-100 p-4">
                <svg
                  className="h-8 w-8 text-gray-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z"
                  />
                </svg>
              </div>
              <p className="mt-3 text-sm font-semibold text-gray-700">
                No staff member selected
              </p>
              <p className="mt-1 text-xs text-gray-500">
                Select a staff member from the list to manage their center and classroom assignments.
              </p>
            </div>
          ) : (
            <>
              {/* Selected staff header */}
              <div className="mt-4 flex items-center gap-3 rounded-xl bg-gray-50 p-3">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-800 to-sky-600 text-sm font-bold text-white">
                  {getInitials(selectedStaffMember.name)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-bold text-gray-900">
                    {selectedStaffMember.name || "Unnamed"}
                  </div>
                  <div className="truncate text-xs text-gray-500">
                    {selectedStaffMember.email}
                  </div>
                </div>
                {selectedIsTeacher && (
                  <Link
                    href={`/admin/teachers/${selectedStaffMember.id}`}
                    className="text-xs font-semibold text-blue-800 hover:text-blue-900"
                  >
                    View Profile →
                  </Link>
                )}
              </div>

              {/* Centers */}
              <div className="mt-5">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold uppercase tracking-wide text-gray-500">
                    Centers
                  </div>
                  {selectedCenterIds.length > 0 && (
                    <span className="text-xs font-semibold text-blue-700">
                      {selectedCenterIds.length} selected
                    </span>
                  )}
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {centers.map((c) => {
                    const active = selectedCenterIds.includes(c.id);
                    return (
                      <button
                        key={c.id}
                        type="button"
                        aria-pressed={active}
                        className={[
                          "inline-flex items-center gap-1.5 rounded-full border px-3 py-2 text-sm font-semibold transition",
                          active
                            ? "border-blue-300 bg-blue-50 text-blue-800"
                            : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50",
                        ].join(" ")}
                        onClick={() =>
                          setSelectedCenterIds((cur) => toggleInList(cur, c.id))
                        }
                      >
                        {active && (
                          <CheckCircleIcon className="h-4 w-4 text-blue-600" />
                        )}
                        {c.name}
                      </button>
                    );
                  })}
                  {centers.length === 0 && (
                    <p className="text-xs text-gray-500">No centers available.</p>
                  )}
                </div>
              </div>

              {/* Classrooms (teachers only) */}
              {selectedIsTeacher && (
                <div className="mt-5">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-bold uppercase tracking-wide text-gray-500">
                      Classrooms
                    </div>
                    {selectedClassIds.length > 0 && (
                      <span className="text-xs font-semibold text-emerald-700">
                        {selectedClassIds.length} selected
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-gray-400">
                    {selectedCenterIds.length
                      ? "Showing classrooms for selected centers."
                      : "Select centers above to filter classrooms."}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {availableClasses.map((cl) => {
                      const active = selectedClassIds.includes(cl.id);
                      return (
                        <button
                          key={cl.id}
                          type="button"
                          aria-pressed={active}
                          className={[
                            "inline-flex items-center gap-1.5 rounded-full border px-3 py-2 text-sm font-semibold transition",
                            active
                              ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                              : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50",
                          ].join(" ")}
                          onClick={() =>
                            setSelectedClassIds((cur) => toggleInList(cur, cl.id))
                          }
                        >
                          {active && (
                            <CheckCircleIcon className="h-4 w-4 text-emerald-600" />
                          )}
                          {cl.name}
                        </button>
                      );
                    })}
                    {selectedCenterIds.length === 0 ? (
                      <p className="text-xs text-gray-500">Select at least one center to choose classrooms.</p>
                    ) : availableClasses.length === 0 && (
                      <p className="text-xs text-gray-500">No classrooms available.</p>
                    )}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="mt-6 flex gap-2">
                <button
                  type="button"
                  className="flex-1 rounded-xl bg-gradient-to-r from-blue-800 to-sky-600 px-4 py-2.5 text-sm font-bold text-white hover:from-blue-900 hover:to-sky-700 disabled:opacity-60"
                  disabled={saving}
                  onClick={saveAssignments}
                >
                  {saving ? "Saving…" : "Save Assignments"}
                </button>
                <button
                  type="button"
                  className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                  disabled={saving}
                  onClick={() => setSelectedTeacherId("")}
                >
                  Done
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}

/* ── Helper Components ── */

function StatCard({ label, value, icon, bg }) {
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-gray-200 bg-white p-5">
      <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${bg}`}>
        {icon}
      </div>
      <div>
        <div className="text-2xl font-extrabold text-gray-900">{value}</div>
        <div className="text-xs font-semibold text-gray-500">{label}</div>
      </div>
    </div>
  );
}

/* ── Icons ── */

function SearchIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  );
}

function UsersIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
    </svg>
  );
}

function CheckCircleIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function AlertIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
    </svg>
  );
}
