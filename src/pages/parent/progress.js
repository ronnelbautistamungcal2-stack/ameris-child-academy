import ParentLayout from "@/components/parent/ParentLayout";
import ProgressEntryTimeline from "@/components/progression/ProgressEntryTimeline";
import { apiJson } from "@/lib/api";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";

const STATUS_BADGE = {
  NOT_STARTED: "bg-gray-100 text-gray-700",
  IN_PROGRESS: "bg-amber-100 text-amber-800",
  COMPLETED: "bg-emerald-100 text-emerald-800",
  PASSED: "bg-emerald-100 text-emerald-800",
  FAILED: "bg-red-100 text-red-800",
};

const STATUS_LABEL = {
  NOT_STARTED: "Not Started",
  IN_PROGRESS: "In Progress",
  COMPLETED: "Completed",
  PASSED: "Passed",
  FAILED: "Failed",
};

function formatDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString();
}

export default function ParentProgress() {
  const router = useRouter();
  const childId = typeof router.query.childId === "string" ? router.query.childId : "";

  const [children, setChildren] = useState([]);
  const [selectedChildId, setSelectedChildId] = useState(childId);
  const [progress, setProgress] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState({});
  const [categoryFilter, setCategoryFilter] = useState("");
  const [noteForm, setNoteForm] = useState({});
  const [savingNote, setSavingNote] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError("");
      try {
        const kids = await apiJson("/api/v1/children");
        const kidsArr = Array.isArray(kids) ? kids : [];
        setChildren(kidsArr);
        if (!selectedChildId) setSelectedChildId(kidsArr[0]?.id || "");
      } catch (e) {
        setError(e.message || "Failed to load children");
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedChildId) {
      setProgress([]);
      return;
    }
    (async () => {
      setLoading(true);
      setError("");
      try {
        const p = await apiJson(`/api/v1/progress?childId=${encodeURIComponent(selectedChildId)}`);
        setProgress(Array.isArray(p) ? p : []);
      } catch (e) {
        setError(e.message || "Failed to load progress");
      } finally {
        setLoading(false);
      }
    })();
  }, [selectedChildId]);

  const selectedChild = useMemo(
    () => children.find((c) => c.id === selectedChildId) || null,
    [children, selectedChildId],
  );

  const categories = useMemo(() => {
    const set = new Set();
    for (const p of progress) {
      const name = p.lesson?.category?.name;
      if (name) set.add(name);
    }
    return [...set].sort();
  }, [progress]);

  const filteredProgress = useMemo(() => {
    let rows = progress.slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    if (categoryFilter) {
      rows = rows.filter((p) => (p.lesson?.category?.name || "") === categoryFilter);
    }
    return rows;
  }, [progress, categoryFilter]);

  // Stats
  const stats = useMemo(() => {
    const total = progress.length;
    const passed = progress.filter((p) => p.status === "PASSED" || p.status === "COMPLETED").length;
    const failed = progress.filter((p) => p.status === "FAILED").length;
    const inProgress = progress.filter((p) => p.status === "IN_PROGRESS").length;
    return { total, passed, failed, inProgress };
  }, [progress]);

  async function submitNote(progressId) {
    const notes = noteForm[progressId];
    if (!notes?.trim()) return;
    setSavingNote(progressId);
    try {
      await apiJson(`/api/v1/progress/${encodeURIComponent(progressId)}/entries`, {
        method: "POST",
        body: JSON.stringify({ status: "IN_PROGRESS", notes }),
      });
      setNoteForm((prev) => ({ ...prev, [progressId]: "" }));
      // Re-expand to show the new note
      setExpanded((prev) => ({ ...prev, [progressId]: Date.now() }));
    } catch (e) {
      setError(e.message || "Failed to add note");
    } finally {
      setSavingNote("");
    }
  }

  return (
    <ParentLayout title="Progress & Goals">
      <div className="space-y-4">
        <div className="rounded-2xl border border-gray-200 bg-white p-5">
          <h2 className="text-lg font-extrabold text-gray-900">Progress & Goals</h2>
          <p className="mt-1 text-sm text-gray-600">
            Track your child&apos;s developmental milestones and goals. Add notes to collaborate with teachers.
          </p>

          {error && (
            <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>
          )}

          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
            <label className="block">
              <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">Child</div>
              <select
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                value={selectedChildId}
                onChange={(e) => setSelectedChildId(e.target.value)}
                disabled={loading}
              >
                <option value="">Select a child...</option>
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
            <label className="block">
              <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">Category</div>
              <select
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
              >
                <option value="">All categories</option>
                {categories.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </label>
          </div>
        </div>

        {/* Stats */}
        {selectedChild && progress.length > 0 && (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <div className="rounded-2xl border border-gray-200 bg-white p-4 text-center">
              <div className="text-2xl font-extrabold text-gray-900">{stats.total}</div>
              <div className="text-xs text-gray-500">Total Goals</div>
            </div>
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-center">
              <div className="text-2xl font-extrabold text-emerald-700">{stats.passed}</div>
              <div className="text-xs text-emerald-600">Completed</div>
            </div>
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-center">
              <div className="text-2xl font-extrabold text-amber-700">{stats.inProgress}</div>
              <div className="text-xs text-amber-600">In Progress</div>
            </div>
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-center">
              <div className="text-2xl font-extrabold text-red-700">{stats.failed}</div>
              <div className="text-xs text-red-600">Needs Attention</div>
            </div>
          </div>
        )}

        {/* Progress list */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5">
          {loading ? (
            <div className="text-sm text-gray-600">Loading...</div>
          ) : !selectedChild ? (
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
              Select a child to view progress.
            </div>
          ) : filteredProgress.length === 0 ? (
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
              No progress records yet for {selectedChild.firstName}.
            </div>
          ) : (
            <div className="space-y-3">
              {filteredProgress.map((p) => {
                const isExpanded = expanded[p.id];
                return (
                  <div key={p.id} className={`rounded-xl border p-4 ${p.status === "FAILED" ? "border-red-200 bg-red-50/20" : "border-gray-200"}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-gray-900">
                          {p.lesson?.title || "Unknown Lesson"}
                        </div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                          {p.lesson?.category?.name && (
                            <span className="rounded-full bg-sky-100 px-2 py-0.5 text-sky-700">
                              {p.lesson.category.name}
                            </span>
                          )}
                          <span>Step {p.goalIndex}</span>
                          <span>&middot; {formatDate(p.createdAt)}</span>
                        </div>
                      </div>
                      <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_BADGE[p.status] || STATUS_BADGE.NOT_STARTED}`}>
                        {STATUS_LABEL[p.status] || p.status}
                      </span>
                    </div>

                    <div className="mt-2 flex items-center gap-3">
                      <button
                        type="button"
                        className="text-xs font-semibold text-blue-600 hover:text-blue-700"
                        onClick={() => setExpanded((prev) => ({ ...prev, [p.id]: prev[p.id] ? null : Date.now() }))}
                      >
                        {isExpanded ? "Hide Details" : "View Details"}
                      </button>
                    </div>

                    {isExpanded && (
                      <div className="mt-3 space-y-3">
                        <ProgressEntryTimeline key={isExpanded} progressId={p.id} />

                        {/* Add note form */}
                        <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                          <div className="mb-1 text-xs font-semibold text-gray-500">Add a Note</div>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm"
                              placeholder="Share a note with the teacher..."
                              value={noteForm[p.id] || ""}
                              onChange={(e) => setNoteForm((prev) => ({ ...prev, [p.id]: e.target.value }))}
                              disabled={savingNote === p.id}
                            />
                            <button
                              type="button"
                              className="shrink-0 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                              onClick={() => submitNote(p.id)}
                              disabled={savingNote === p.id || !(noteForm[p.id] || "").trim()}
                            >
                              {savingNote === p.id ? "Sending..." : "Send"}
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </ParentLayout>
  );
}
