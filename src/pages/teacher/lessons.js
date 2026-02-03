import TeacherLayout from "@/components/teacher/TeacherLayout";
import { apiJson } from "@/lib/api";
import { useEffect, useMemo, useState } from "react";

export default function TeacherLessons() {
  const [centers, setCenters] = useState([]);
  const [centerId, setCenterId] = useState("");
  const [lessons, setLessons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
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
    })();
  }, []);

  useEffect(() => {
    (async () => {
      if (!centerId) {
        setLessons([]);
        return;
      }
      setLoading(true);
      setError("");
      try {
        const l = await apiJson(`/api/v1/lessons?centerId=${encodeURIComponent(centerId)}`);
        setLessons(Array.isArray(l) ? l : []);
      } catch (e) {
        setError(e.message || "Failed to load lessons");
      } finally {
        setLoading(false);
      }
    })();
  }, [centerId]);

  const sorted = useMemo(() => {
    return [...lessons].sort((a, b) => (a.title || "").localeCompare(b.title || ""));
  }, [lessons]);

  return (
    <TeacherLayout title="Lessons & Media">
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="text-lg font-extrabold">Lesson Plans & Training Media</h2>
        <p className="mt-1 text-sm text-gray-600">
          View lesson plans and linked media for your center.
        </p>

        {error ? (
          <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {error}
          </div>
        ) : null}

        <div className="mt-4">
          <label className="block max-w-lg">
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
        </div>

        <div className="mt-4">
          {loading ? (
            <div className="text-sm text-gray-600">Loading…</div>
          ) : sorted.length === 0 ? (
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
              No lessons found.
            </div>
          ) : (
            <div className="space-y-3">
              {sorted.map((l) => (
                <div key={l.id} className="rounded-xl border border-gray-200 p-4">
                  <div className="flex flex-col gap-1">
                    <div className="text-base font-extrabold text-gray-900">
                      {l.title}
                    </div>
                    <div className="text-sm text-gray-600">
                      {l.description || "—"}
                    </div>
                  </div>

                  <div className="mt-3">
                    <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Media
                    </div>
                    {Array.isArray(l.media) && l.media.length ? (
                      <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
                        {l.media.map((m) => (
                          <li key={m}>
                            <a
                              href={m}
                              target="_blank"
                              rel="noreferrer"
                              className="text-blue-600 hover:text-blue-700"
                            >
                              {m}
                            </a>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <div className="mt-1 text-sm text-gray-600">—</div>
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

