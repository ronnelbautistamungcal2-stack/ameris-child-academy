import TeacherLayout from "@/components/teacher/TeacherLayout";
import WeeklyLessonPlanner from "@/components/planning/WeeklyLessonPlanner";
import { apiJson } from "@/lib/api";
import { useEffect, useState } from "react";

export default function TeacherChecklists() {
  const [centers, setCenters] = useState([]);
  const [centerId, setCenterId] = useState("");
  const [children, setChildren] = useState([]);
  const [childId, setChildId] = useState("");
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkChildIds, setBulkChildIds] = useState([]);
  const [childSearch, setChildSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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

  useEffect(() => {
    (async () => {
      if (!centerId) {
        setChildren([]);
        setChildId("");
        setBulkMode(false);
        setBulkChildIds([]);
        setChildSearch("");
        return;
      }
      setLoading(true);
      setError("");
      try {
        const kids = await apiJson(`/api/v1/children?centerId=${encodeURIComponent(centerId)}`);
        const arr = Array.isArray(kids) ? kids : [];
        setChildren(arr);
        setChildId("");
        setBulkMode(false);
        setBulkChildIds([]);
        setChildSearch("");
      } catch (e) {
        setError(e.message || "Failed to load children");
        setChildren([]);
        setChildId("");
        setBulkMode(false);
        setBulkChildIds([]);
        setChildSearch("");
      } finally {
        setLoading(false);
      }
    })();
  }, [centerId]);

  const filteredChildren = children
    .slice()
    .sort((a, b) =>
      String(a.firstName || "").localeCompare(String(b.firstName || "")),
    )
    .filter((ch) => {
      const q = String(childSearch || "").trim().toLowerCase();
      if (!q) return true;
      const name = `${ch.firstName || ""} ${ch.lastName || ""}`.trim().toLowerCase();
      return name.includes(q);
    });

  function toggleBulkChild(id, next) {
    setBulkChildIds((cur) => {
      const set = new Set(cur);
      if (next) set.add(id);
      else set.delete(id);
      return [...set];
    });
  }

  function setAllBulk(next) {
    if (!next) {
      setBulkChildIds([]);
      return;
    }
    setBulkChildIds(filteredChildren.map((c) => c.id));
  }

  return (
    <TeacherLayout title="Checklists">
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <h2 className="text-base font-extrabold text-gray-900">Checklists</h2>
        <p className="mt-0.5 text-xs text-gray-600">
          View the weekly lesson plan created by admins. Optionally select a child to track completion.
        </p>

        {error ? (
          <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {error}
          </div>
        ) : null}

        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
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
              <option value="">Select a center...</option>
              {centers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
              Child (optional)
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
                .sort((a, b) =>
                  String(a.firstName || "").localeCompare(String(b.firstName || "")),
                )
                .map((ch) => (
                  <option key={ch.id} value={ch.id}>
                    {ch.firstName} {ch.lastName || ""}
                  </option>
                ))}
            </select>
          </label>
        </div>

        <div className="mt-3 rounded-xl border border-gray-200 bg-gray-50 p-3">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Bulk Update
              </div>
              <div className="mt-0.5 text-xs text-gray-600">
                Select multiple children, then click a lesson and use “Bulk mark” in the lesson guidance panel.
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
              <input
                type="checkbox"
                checked={bulkMode}
                onChange={(e) => {
                  const next = e.target.checked;
                  setBulkMode(next);
                  if (!next) setBulkChildIds([]);
                }}
                disabled={!centerId || loading}
              />
              Enable
            </label>
          </div>

          {bulkMode ? (
            <div className="mt-3">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <input
                  value={childSearch}
                  onChange={(e) => setChildSearch(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm md:max-w-sm"
                  placeholder="Search children..."
                />
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-100"
                    onClick={() => setAllBulk(true)}
                    disabled={!filteredChildren.length}
                  >
                    Select all
                  </button>
                  <button
                    type="button"
                    className="rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-100"
                    onClick={() => setAllBulk(false)}
                    disabled={!bulkChildIds.length}
                  >
                    Clear
                  </button>
                  <div className="text-xs font-semibold text-gray-600">
                    {bulkChildIds.length} selected
                  </div>
                </div>
              </div>

              <div className="mt-3 max-h-56 overflow-y-auto rounded-xl border border-gray-200 bg-white">
                {filteredChildren.length ? (
                  <ul className="divide-y divide-gray-100">
                    {filteredChildren.map((ch) => {
                      const checked = bulkChildIds.includes(ch.id);
                      const name = `${ch.firstName || ""} ${ch.lastName || ""}`.trim();
                      return (
                        <li key={ch.id} className="flex items-center justify-between gap-3 px-3 py-2">
                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold text-gray-900">
                              {name || "Child"}
                            </div>
                          </div>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => toggleBulkChild(ch.id, e.target.checked)}
                          />
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <div className="p-3 text-sm text-gray-600">
                    No children match the search.
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <div className="mt-4">
        {!centerId ? (
          <div className="rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-600">
            Select a center to view the weekly plan.
          </div>
        ) : (
          <WeeklyLessonPlanner
            centerId={centerId}
            mode="teacher"
            childId={childId}
            bulkChildIds={bulkMode ? bulkChildIds : []}
          />
        )}
      </div>
    </TeacherLayout>
  );
}
