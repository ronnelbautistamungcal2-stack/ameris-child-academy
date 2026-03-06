import AdminLayout from "@/components/admin/AdminLayout";
import { SkeletonTable } from "@/components/ui/Skeleton";
import { apiJson } from "@/lib/api";
import { useEffect, useMemo, useState } from "react";

export default function AdminTeachers() {
  const [teachers, setTeachers] = useState([]);
  const [centers, setCenters] = useState([]);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [selectedTeacherId, setSelectedTeacherId] = useState("");
  const [selectedCenterIds, setSelectedCenterIds] = useState([]);
  const [selectedClassIds, setSelectedClassIds] = useState([]);
  const [saving, setSaving] = useState(false);

  async function refresh() {
    setError("");
    setLoading(true);
    try {
      const [t, c, cls] = await Promise.all([
        apiJson("/api/v1/teachers"),
        apiJson("/api/v1/centers"),
        apiJson("/api/v1/classes"),
      ]);
      setTeachers(Array.isArray(t) ? t : []);
      setCenters(Array.isArray(c) ? c : []);
      setClasses(Array.isArray(cls) ? cls : []);
    } catch (e) {
      setError(e.message || "Failed to load teachers");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  const teacherById = useMemo(() => {
    return Object.fromEntries(teachers.map((t) => [t.id, t]));
  }, [teachers]);

  const selectedTeacher = selectedTeacherId ? teacherById[selectedTeacherId] : null;

  useEffect(() => {
    if (!selectedTeacher) {
      setSelectedCenterIds([]);
      setSelectedClassIds([]);
      return;
    }

    const teacherCenters = (selectedTeacher.centers || [])
      .filter((cu) => cu.role === "TEACHER")
      .map((cu) => cu.centerId);

    const teacherClasses = (selectedTeacher.teacherClasses || []).map((tc) => tc.classId);

    setSelectedCenterIds(teacherCenters);
    setSelectedClassIds(teacherClasses);
  }, [selectedTeacherId]);

  const sortedTeachers = useMemo(() => {
    return [...teachers].sort((a, b) => (a.email || "").localeCompare(b.email || ""));
  }, [teachers]);

  const availableClasses = useMemo(() => {
    if (!selectedCenterIds.length) return classes;
    const set = new Set(selectedCenterIds);
    return classes.filter((c) => set.has(c.centerId));
  }, [classes, selectedCenterIds]);

  function toggleInList(list, id) {
    return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
  }

  async function saveAssignments() {
    if (!selectedTeacher) return;
    setSaving(true);
    setError("");
    try {
      await apiJson(`/api/v1/teachers/${selectedTeacher.id}/assignments`, {
        method: "PUT",
        body: JSON.stringify({
          centerIds: selectedCenterIds,
          classIds: selectedClassIds,
        }),
      });
      await refresh();
    } catch (e) {
      setError(e.message || "Failed to save assignments");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminLayout title="Teachers">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_420px]">
        <div className="rounded-2xl border border-gray-200 bg-white p-5">
          <h2 className="text-lg font-extrabold text-gray-900">Teachers</h2>
          <p className="mt-1 text-sm text-gray-500">
            Assign teachers to centers and classrooms to enforce access limits.
          </p>

          {error ? (
            <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              {error}
            </div>
          ) : null}

          {loading ? (
            <div className="mt-4"><SkeletonTable rows={4} cols={4} /></div>
          ) : (
            <div className="mt-4 overflow-hidden rounded-xl border border-gray-200">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500">Email</th>
                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500">Name</th>
                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500">Assigned Centers</th>
                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500">Assigned Classes</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedTeachers.map((t) => (
                    <tr
                      key={t.id}
                      className={[
                        "cursor-pointer border-b border-gray-100 transition",
                        selectedTeacherId === t.id ? "bg-blue-50" : "hover:bg-gray-50",
                      ].join(" ")}
                      onClick={() => setSelectedTeacherId(t.id)}
                    >
                      <td className="px-3 py-2.5 align-top">{t.email}</td>
                      <td className="px-3 py-2.5 align-top">{t.name || "—"}</td>
                      <td className="px-3 py-2.5 align-top">
                        {(t.centers || [])
                          .filter((cu) => cu.role === "TEACHER")
                          .map((cu) => cu.center?.name || cu.centerId)
                          .join(", ") || "—"}
                      </td>
                      <td className="px-3 py-2.5 align-top">
                        {(t.teacherClasses || [])
                          .map((tc) => tc.classRoom?.name || tc.classId)
                          .join(", ") || "—"}
                      </td>
                    </tr>
                  ))}
                  {sortedTeachers.length === 0 ? (
                    <tr>
                      <td className="px-3 py-2.5 text-gray-500" colSpan={4}>
                        No teachers found.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5">
          <h3 className="text-base font-extrabold text-gray-900">Assignments</h3>
          {!selectedTeacher ? (
            <p className="mt-2 text-sm text-gray-500">Select a teacher to edit assignments.</p>
          ) : (
            <>
              <div className="mt-2 text-sm font-bold text-gray-900">
                {selectedTeacher.email}
              </div>
              <div className="mt-1 text-xs text-gray-500">
                These assignments control which centers/classrooms a teacher can access.
              </div>

              <div className="mt-4">
                <div className="text-xs font-bold uppercase tracking-wide text-gray-500">Centers</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {centers.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      className={[
                        "rounded-full border px-3 py-2 text-sm font-bold text-gray-900 transition",
                        selectedCenterIds.includes(c.id)
                          ? "border-blue-200 bg-blue-50"
                          : "border-gray-200 bg-white hover:bg-gray-50",
                      ].join(" ")}
                      onClick={() => setSelectedCenterIds((cur) => toggleInList(cur, c.id))}
                    >
                      {c.name}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-4">
                <div className="text-xs font-bold uppercase tracking-wide text-gray-500">Classrooms</div>
                <div className="mt-1 text-xs text-gray-500">
                  Filtered to selected centers when centers are selected.
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {availableClasses.map((cl) => (
                    <button
                      key={cl.id}
                      type="button"
                      className={[
                        "rounded-full border px-3 py-2 text-sm font-bold text-gray-900 transition",
                        selectedClassIds.includes(cl.id)
                          ? "border-blue-200 bg-blue-50"
                          : "border-gray-200 bg-white hover:bg-gray-50",
                      ].join(" ")}
                      onClick={() => setSelectedClassIds((cur) => toggleInList(cur, cl.id))}
                    >
                      {cl.name}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  className="rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-60"
                  disabled={saving}
                  onClick={saveAssignments}
                >
                  {saving ? "Saving…" : "Save Assignments"}
                </button>
                <button
                  type="button"
                  className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
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
