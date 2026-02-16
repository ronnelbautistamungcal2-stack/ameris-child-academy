import TeacherLayout from "@/components/teacher/TeacherLayout";
import { apiJson } from "@/lib/api";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

const ACTIVITY_TYPES = [
  "DIAPER_CHANGE",
  "NAP",
  "BOTTLE",
  "MEAL",
  "SNACK",
  "ACTIVITY",
  "TASK_CHECKLIST",
  "BEHAVIOR",
  "OTHER",
];

function fullName(child) {
  if (!child) return "";
  return `${child.firstName || ""}${child.lastName ? ` ${child.lastName}` : ""}`.trim();
}

function formatDateTime(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

export default function TeacherChildren() {
  const [centers, setCenters] = useState([]);
  const [classes, setClasses] = useState([]);
  const [children, setChildren] = useState([]);
  const [centerId, setCenterId] = useState("");
  const [classId, setClassId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedChild, setSelectedChild] = useState(null);
  const [logs, setLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsError, setLogsError] = useState("");
  const [logsSuccess, setLogsSuccess] = useState("");
  const [editingLogId, setEditingLogId] = useState("");
  const [editType, setEditType] = useState("OTHER");
  const [editNotes, setEditNotes] = useState("");
  const [savingLogId, setSavingLogId] = useState("");
  const [deletingLogId, setDeletingLogId] = useState("");

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

  async function loadLogs(child) {
    if (!child?.id) {
      setLogs([]);
      return;
    }
    setLogsLoading(true);
    setLogsError("");
    setLogsSuccess("");
    try {
      const rows = await apiJson(
        `/api/v1/activities?childId=${encodeURIComponent(child.id)}`,
      );
      setLogs(Array.isArray(rows) ? rows : []);
    } catch (e) {
      setLogsError(e.message || "Failed to load logs");
      setLogs([]);
    } finally {
      setLogsLoading(false);
    }
  }

  async function openManageLogs(child) {
    setSelectedChild(child);
    setEditingLogId("");
    setEditType("OTHER");
    setEditNotes("");
    await loadLogs(child);
  }

  function closeManageLogs() {
    setSelectedChild(null);
    setLogs([]);
    setLogsLoading(false);
    setLogsError("");
    setLogsSuccess("");
    setEditingLogId("");
    setEditType("OTHER");
    setEditNotes("");
    setSavingLogId("");
    setDeletingLogId("");
  }

  function startEditLog(log) {
    setEditingLogId(log.id);
    setEditType(log.type || "OTHER");
    setEditNotes(log.notes || "");
    setLogsError("");
    setLogsSuccess("");
  }

  function cancelEditLog() {
    setEditingLogId("");
    setEditType("OTHER");
    setEditNotes("");
  }

  async function saveLog(logId) {
    if (!logId) return;
    setSavingLogId(logId);
    setLogsError("");
    setLogsSuccess("");
    try {
      const updated = await apiJson(`/api/v1/activities/${encodeURIComponent(logId)}`, {
        method: "PUT",
        body: JSON.stringify({ type: editType, notes: editNotes }),
      });
      setLogs((cur) => cur.map((row) => (row.id === logId ? updated : row)));
      setLogsSuccess("Log updated.");
      cancelEditLog();
    } catch (e) {
      setLogsError(e.message || "Failed to update log");
    } finally {
      setSavingLogId("");
    }
  }

  async function deleteLog(logId) {
    if (!logId) return;
    if (!confirm("Delete this log entry?")) return;
    setDeletingLogId(logId);
    setLogsError("");
    setLogsSuccess("");
    try {
      await apiJson(`/api/v1/activities/${encodeURIComponent(logId)}`, {
        method: "DELETE",
      });
      setLogs((cur) => cur.filter((row) => row.id !== logId));
      setLogsSuccess("Log removed.");
      if (editingLogId === logId) cancelEditLog();
    } catch (e) {
      setLogsError(e.message || "Failed to delete log");
    } finally {
      setDeletingLogId("");
    }
  }

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
                        <div className="flex flex-wrap gap-2">
                          <Link
                            href={`/teacher/logs?centerId=${encodeURIComponent(
                              centerId || "",
                            )}&childId=${encodeURIComponent(ch.id)}`}
                            className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700"
                          >
                            Log Activity
                          </Link>
                          <button
                            type="button"
                            onClick={() => openManageLogs(ch)}
                            className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-800 hover:bg-gray-50"
                          >
                            Manage Logs
                          </button>
                        </div>
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

      {selectedChild ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeManageLogs();
          }}
        >
          <div className="max-h-[85vh] w-full max-w-4xl overflow-auto rounded-xl border border-gray-200 bg-white p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-extrabold text-gray-900">
                  Manage Logs: {fullName(selectedChild)}
                </h3>
                <div className="text-sm text-gray-600">
                  Edit type/notes or remove log entries.
                </div>
              </div>
              <button
                type="button"
                onClick={closeManageLogs}
                className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-800 hover:bg-gray-50"
              >
                Close
              </button>
            </div>

            {logsError ? (
              <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                {logsError}
              </div>
            ) : null}

            {logsSuccess ? (
              <div className="mt-3 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">
                {logsSuccess}
              </div>
            ) : null}

            <div className="mt-4">
              {logsLoading ? (
                <div className="text-sm text-gray-600">Loading logs…</div>
              ) : logs.length === 0 ? (
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
                  No logs found for this child.
                </div>
              ) : (
                <div className="overflow-hidden rounded-xl border border-gray-200">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-500">
                      <tr>
                        <th className="px-4 py-3">Time</th>
                        <th className="px-4 py-3">Type</th>
                        <th className="px-4 py-3">Notes</th>
                        <th className="px-4 py-3">Recorded By</th>
                        <th className="px-4 py-3">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {logs.map((log) => {
                        const isEditing = editingLogId === log.id;
                        const isSaving = savingLogId === log.id;
                        const isDeleting = deletingLogId === log.id;
                        return (
                          <tr key={log.id}>
                            <td className="px-4 py-3 text-gray-700">
                              {formatDateTime(log.createdAt)}
                            </td>
                            <td className="px-4 py-3">
                              {isEditing ? (
                                <select
                                  value={editType}
                                  onChange={(e) => setEditType(e.target.value)}
                                  className="w-full rounded-lg border border-gray-200 px-2 py-1 text-xs"
                                  disabled={isSaving || isDeleting}
                                >
                                  {ACTIVITY_TYPES.map((t) => (
                                    <option key={t} value={t}>
                                      {t}
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                <span className="font-semibold text-gray-900">{log.type}</span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              {isEditing ? (
                                <input
                                  value={editNotes}
                                  onChange={(e) => setEditNotes(e.target.value)}
                                  className="w-full rounded-lg border border-gray-200 px-2 py-1 text-xs"
                                  placeholder="Notes"
                                  disabled={isSaving || isDeleting}
                                />
                              ) : (
                                <span className="text-gray-700">{log.notes || "—"}</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-gray-600">
                              {log.recordedBy?.name || log.recordedBy?.email || "—"}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex flex-wrap gap-2">
                                {isEditing ? (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => saveLog(log.id)}
                                      disabled={isSaving || isDeleting}
                                      className="rounded-lg bg-blue-600 px-2 py-1 text-xs font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                      {isSaving ? "Saving…" : "Save"}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={cancelEditLog}
                                      disabled={isSaving || isDeleting}
                                      className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs font-semibold text-gray-800 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                      Cancel
                                    </button>
                                  </>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => startEditLog(log)}
                                    disabled={isDeleting}
                                    className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs font-semibold text-gray-800 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                                  >
                                    Edit
                                  </button>
                                )}

                                <button
                                  type="button"
                                  onClick={() => deleteLog(log.id)}
                                  disabled={isSaving || isDeleting}
                                  className="rounded-lg bg-red-600 px-2 py-1 text-xs font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  {isDeleting ? "Removing…" : "Remove"}
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </TeacherLayout>
  );
}
