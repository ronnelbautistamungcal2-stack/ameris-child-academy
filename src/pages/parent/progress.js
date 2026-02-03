import ParentLayout from "@/components/parent/ParentLayout";
import { apiJson } from "@/lib/api";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";

export default function ParentProgress() {
  const router = useRouter();
  const childId = typeof router.query.childId === "string" ? router.query.childId : "";

  const [children, setChildren] = useState([]);
  const [selectedChildId, setSelectedChildId] = useState(childId);
  const [progress, setProgress] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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

  return (
    <ParentLayout title="Progress & Goals">
      <div className="rounded-2xl border border-gray-200 bg-white p-5">
        <h2 className="text-lg font-extrabold text-gray-900">Progress & Goals</h2>
        <p className="mt-1 text-sm text-gray-600">
          View milestones/goals and recent progress entries.
        </p>

        {error ? (
          <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {error}
          </div>
        ) : null}

        <div className="mt-4 max-w-lg">
          <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Child
          </div>
          <select
            className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
            value={selectedChildId}
            onChange={(e) => setSelectedChildId(e.target.value)}
            disabled={loading}
          >
            <option value="">Select a child…</option>
            {children
              .slice()
              .sort((a, b) => (a.firstName || "").localeCompare(b.firstName || ""))
              .map((ch) => (
                <option key={ch.id} value={ch.id}>
                  {ch.firstName} {ch.lastName || ""}
                </option>
              ))}
          </select>
        </div>

        <div className="mt-4">
          {loading ? (
            <div className="text-sm text-gray-600">Loading…</div>
          ) : !selectedChild ? (
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
              Select a child to view progress.
            </div>
          ) : progress.length === 0 ? (
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
              No progress records yet for {selectedChild.firstName}.
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-gray-200">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="px-4 py-3">Lesson</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Goal</th>
                    <th className="px-4 py-3">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {progress
                    .slice()
                    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
                    .slice(0, 25)
                    .map((p) => (
                      <tr key={p.id}>
                        <td className="px-4 py-3">
                          <div className="font-semibold text-gray-900">
                            {p.lesson?.title || p.lessonId}
                          </div>
                          <div className="text-xs text-gray-500">
                            {p.lesson?.description || "—"}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-800">
                            {p.status}
                          </span>
                        </td>
                        <td className="px-4 py-3">{p.goalIndex}</td>
                        <td className="px-4 py-3 text-gray-600">
                          {new Date(p.createdAt).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </ParentLayout>
  );
}

