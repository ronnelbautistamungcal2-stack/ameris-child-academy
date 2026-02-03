import TeacherLayout from "@/components/teacher/TeacherLayout";
import { apiJson } from "@/lib/api";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

export default function TeacherChildren() {
  const [centers, setCenters] = useState([]);
  const [classes, setClasses] = useState([]);
  const [children, setChildren] = useState([]);
  const [centerId, setCenterId] = useState("");
  const [classId, setClassId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setError("");
    setLoading(true);
    try {
      const c = await apiJson("/api/v1/centers");
      setCenters(Array.isArray(c) ? c : []);
    } catch (e) {
      setError(e.message || "Failed to load centers");
    } finally {
      setLoading(false);
    }
  }

  async function loadForCenter(id) {
    if (!id) {
      setClasses([]);
      setChildren([]);
      return;
    }
    setError("");
    setLoading(true);
    try {
      const [cls, kids] = await Promise.all([
        apiJson(`/api/v1/classes?centerId=${encodeURIComponent(id)}`),
        apiJson(`/api/v1/children?centerId=${encodeURIComponent(id)}`),
      ]);
      setClasses(Array.isArray(cls) ? cls : []);
      setChildren(Array.isArray(kids) ? kids : []);
    } catch (e) {
      setError(e.message || "Failed to load center data");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    setClassId("");
    loadForCenter(centerId);
  }, [centerId]);

  const filtered = useMemo(() => {
    const base = children || [];
    const byClass = classId
      ? base.filter((c) => c.classRoomId === classId)
      : base;
    return [...byClass].sort((a, b) =>
      (a.firstName || "").localeCompare(b.firstName || ""),
    );
  }, [children, classId]);

  return (
    <TeacherLayout title="Children">
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-extrabold">Children</h2>
          <p className="text-sm text-gray-600">
            Limited to centers you’re assigned to (admins see all).
          </p>
        </div>

        {error ? (
          <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {error}
          </div>
        ) : null}

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
          <label className="block">
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
              Center
            </div>
            <select
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              value={centerId}
              onChange={(e) => setCenterId(e.target.value)}
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
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
              Classroom
            </div>
            <select
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              value={classId}
              onChange={(e) => setClassId(e.target.value)}
              disabled={!centerId}
            >
              <option value="">All classrooms</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-4">
          {loading ? (
            <div className="text-sm text-gray-600">Loading…</div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-gray-200">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="px-4 py-3">Child</th>
                    <th className="px-4 py-3">Class</th>
                    <th className="px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filtered.map((ch) => (
                    <tr key={ch.id}>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-gray-900">
                          {ch.firstName} {ch.lastName || ""}
                        </div>
                        <div className="text-xs text-gray-500">{ch.id}</div>
                      </td>
                      <td className="px-4 py-3 text-gray-700">
                        {ch.classRoomId || "—"}
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/teacher/logs?centerId=${encodeURIComponent(
                            centerId || "",
                          )}&childId=${encodeURIComponent(ch.id)}`}
                          className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700"
                        >
                          Log Activity
                        </Link>
                      </td>
                    </tr>
                  ))}
                  {!centerId ? (
                    <tr>
                      <td className="px-4 py-3 text-gray-600" colSpan={3}>
                        Select a center to view children.
                      </td>
                    </tr>
                  ) : filtered.length === 0 ? (
                    <tr>
                      <td className="px-4 py-3 text-gray-600" colSpan={3}>
                        No children found.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </TeacherLayout>
  );
}

