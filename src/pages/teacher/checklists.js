import TeacherLayout from "@/components/teacher/TeacherLayout";
import { apiJson } from "@/lib/api";
import { useEffect, useMemo, useState } from "react";

export default function TeacherChecklists() {
  const [centers, setCenters] = useState([]);
  const [centerId, setCenterId] = useState("");
  const [children, setChildren] = useState([]);
  const [childId, setChildId] = useState("");
  const [checklists, setChecklists] = useState([]);
  const [completed, setCompleted] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadCenters() {
    setLoading(true);
    setError("");
    try {
      const c = await apiJson("/api/v1/centers");
      setCenters(Array.isArray(c) ? c : []);
      if (Array.isArray(c) && c.length === 1) setCenterId(c[0].id);
    } catch (e) {
      setError(e.message || "Failed to load centers");
    } finally {
      setLoading(false);
    }
  }

  async function loadForCenter(id) {
    if (!id) {
      setChildren([]);
      setChecklists([]);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const [kids, lists] = await Promise.all([
        apiJson(`/api/v1/children?centerId=${encodeURIComponent(id)}`),
        apiJson(`/api/v1/checklists?centerId=${encodeURIComponent(id)}`),
      ]);
      setChildren(Array.isArray(kids) ? kids : []);
      setChecklists(Array.isArray(lists) ? lists : []);
    } catch (e) {
      setError(e.message || "Failed to load checklists");
    } finally {
      setLoading(false);
    }
  }

  async function loadCompleted(id) {
    if (!id) {
      setCompleted([]);
      return;
    }
    try {
      const c = await apiJson(`/api/v1/child-tasks?childId=${encodeURIComponent(id)}`);
      setCompleted(Array.isArray(c) ? c : []);
    } catch {
      setCompleted([]);
    }
  }

  useEffect(() => {
    loadCenters();
  }, []);

  useEffect(() => {
    setChildId("");
    loadForCenter(centerId);
  }, [centerId]);

  useEffect(() => {
    loadCompleted(childId);
  }, [childId]);

  const completedSet = useMemo(() => {
    return new Set((completed || []).filter((c) => c.completedAt).map((c) => c.taskId));
  }, [completed]);

  const sortedChecklists = useMemo(() => {
    return [...checklists].sort((a, b) => (a.title || "").localeCompare(b.title || ""));
  }, [checklists]);

  async function toggle(taskId, next) {
    if (!childId) return;
    try {
      await apiJson("/api/v1/child-tasks", {
        method: "POST",
        body: JSON.stringify({ childId, taskId, completed: next }),
      });
      await loadCompleted(childId);
    } catch (e) {
      setError(e.message || "Failed to update completion");
    }
  }

  return (
    <TeacherLayout title="Daily/Weekly Checklists">
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="text-lg font-extrabold">Daily/Weekly Checklists</h2>
        <p className="mt-1 text-sm text-gray-600">
          Review checklist tasks and mark completion per child (teacher/admin only).
        </p>

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
              disabled={loading}
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
              Child (for completion tracking)
            </div>
            <select
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              value={childId}
              onChange={(e) => setChildId(e.target.value)}
              disabled={!centerId || loading}
            >
              <option value="">(view only)</option>
              {children
                .slice()
                .sort((a, b) => (a.firstName || "").localeCompare(b.firstName || ""))
                .map((ch) => (
                  <option key={ch.id} value={ch.id}>
                    {ch.firstName} {ch.lastName || ""}
                  </option>
                ))}
            </select>
          </label>
        </div>

        <div className="mt-4">
          {loading ? (
            <div className="text-sm text-gray-600">Loading…</div>
          ) : !centerId ? (
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
              Select a center to view checklists.
            </div>
          ) : sortedChecklists.length === 0 ? (
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
              No checklists found for this center.
            </div>
          ) : (
            <div className="space-y-3">
              {sortedChecklists.map((cl) => (
                <div key={cl.id} className="rounded-xl border border-gray-200 p-4">
                  <div className="flex flex-col gap-1">
                    <div className="text-base font-extrabold text-gray-900">
                      {cl.title}
                    </div>
                    <div className="text-sm text-gray-600">
                      {cl.description || "—"}
                    </div>
                  </div>

                  <div className="mt-3">
                    {Array.isArray(cl.tasks) && cl.tasks.length ? (
                      <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200">
                        {cl.tasks.map((t) => {
                          const done = completedSet.has(t.id);
                          return (
                            <li
                              key={t.id}
                              className="flex flex-col gap-2 px-3 py-3 md:flex-row md:items-center md:justify-between"
                            >
                              <div>
                                <div className="font-semibold text-gray-900">
                                  {t.title}
                                </div>
                                <div className="mt-1 flex flex-wrap gap-2 text-xs">
                                  {t.policyLink ? (
                                    <a
                                      href={t.policyLink}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="rounded-full bg-gray-100 px-2 py-1 text-gray-700 hover:bg-gray-200"
                                    >
                                      Policy
                                    </a>
                                  ) : null}
                                  {t.mediaLink ? (
                                    <a
                                      href={t.mediaLink}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="rounded-full bg-gray-100 px-2 py-1 text-gray-700 hover:bg-gray-200"
                                    >
                                      Training Media
                                    </a>
                                  ) : null}
                                </div>
                              </div>

                              <div className="flex items-center gap-3">
                                {childId ? (
                                  <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                                    <input
                                      type="checkbox"
                                      checked={done}
                                      onChange={(e) => toggle(t.id, e.target.checked)}
                                    />
                                    {done ? "Completed" : "Mark complete"}
                                  </label>
                                ) : (
                                  <span className="text-xs text-gray-500">
                                    Select a child to track completion
                                  </span>
                                )}
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    ) : (
                      <div className="text-sm text-gray-600">No tasks.</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </TeacherLayout>
  );
}

