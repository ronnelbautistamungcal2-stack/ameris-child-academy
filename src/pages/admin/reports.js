import AdminLayout from "@/components/admin/AdminLayout";
import { apiJson } from "@/lib/api";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";

export default function AdminReports() {
  const router = useRouter();
  const [centers, setCenters] = useState([]);
  const [centerId, setCenterId] = useState("");
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError("");
      try {
        const c = await apiJson("/api/v1/centers");
        const centersArr = Array.isArray(c) ? c : [];
        setCenters(centersArr);
        const fromQuery =
          typeof router.query.centerId === "string" ? router.query.centerId : "";
        setCenterId(fromQuery || (centersArr.length === 1 ? centersArr[0].id : ""));
      } catch (e) {
        setError(e.message || "Failed to load centers");
      } finally {
        setLoading(false);
      }
    })();
  }, [router.query.centerId]);

  useEffect(() => {
    if (!centerId) {
      setReport(null);
      return;
    }
    (async () => {
      setLoading(true);
      setError("");
      try {
        const r = await apiJson(
          `/api/v1/reports/center-progress?centerId=${encodeURIComponent(centerId)}`,
        );
        setReport(r);
      } catch (e) {
        setError(e.message || "Failed to load report");
      } finally {
        setLoading(false);
      }
    })();
  }, [centerId]);

  const statusRows = useMemo(() => {
    const dist = report?.progressStatusCounts || {};
    const entries = Object.entries(dist);
    return entries.sort((a, b) => String(a[0]).localeCompare(String(b[0])));
  }, [report]);

  const goalRows = useMemo(() => {
    const rows = Array.isArray(report?.progressGoalIndexCounts)
      ? report.progressGoalIndexCounts
      : [];
    return [...rows].sort((a, b) => Number(a.goalIndex) - Number(b.goalIndex));
  }, [report]);

  return (
    <AdminLayout title="Reports">
      <div className="rounded-2xl border border-gray-200 bg-white p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-extrabold text-gray-900">Reports</h2>
            <p className="mt-1 text-sm text-gray-600">
              Overall center steps of progression (basic summary).
            </p>
          </div>

          <label className="block">
            <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Center
            </div>
            <select
              value={centerId}
              onChange={(e) => setCenterId(e.target.value)}
              className="mt-1 w-72 max-w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
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

        {error ? (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {error}
          </div>
        ) : null}

        {loading ? (
          <div className="mt-4 text-sm text-gray-600">Loading…</div>
        ) : !centerId ? (
          <div className="mt-4 text-sm text-gray-600">
            Choose a center to view reports.
          </div>
        ) : !report ? (
          <div className="mt-4 text-sm text-gray-600">No report available.</div>
        ) : (
          <div className="mt-5 space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Stat label="Children" value={report.childrenCount || 0} />
              <Stat label="Lessons" value={report.lessonsCount || 0} />
              <Stat label="Progress records" value={report.progressCount || 0} />
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-gray-200 bg-white p-4">
                <div className="text-sm font-extrabold text-gray-900">
                  Progress status distribution
                </div>
                <div className="mt-3 overflow-auto rounded-xl border border-gray-200">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                      <tr>
                        <th className="px-3 py-2 text-left">Status</th>
                        <th className="px-3 py-2 text-left">Count</th>
                      </tr>
                    </thead>
                    <tbody>
                      {statusRows.map(([status, count]) => (
                        <tr key={status} className="border-t border-gray-200">
                          <td className="px-3 py-2 font-semibold text-gray-900">
                            {status}
                          </td>
                          <td className="px-3 py-2 font-semibold text-gray-900">
                            {count}
                          </td>
                        </tr>
                      ))}
                      {statusRows.length === 0 ? (
                        <tr>
                          <td className="px-3 py-4 text-sm text-gray-600" colSpan={2}>
                            No progress records found.
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="rounded-2xl border border-gray-200 bg-white p-4">
                <div className="text-sm font-extrabold text-gray-900">
                  Steps of progression (goal index)
                </div>
                <div className="mt-2 text-sm text-gray-600">
                  Count of progress records by step number.
                </div>
                <div className="mt-3 overflow-auto rounded-xl border border-gray-200">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                      <tr>
                        <th className="px-3 py-2 text-left">Step</th>
                        <th className="px-3 py-2 text-left">Count</th>
                      </tr>
                    </thead>
                    <tbody>
                      {goalRows.map((row) => (
                        <tr
                          key={row.goalIndex}
                          className="border-t border-gray-200"
                        >
                          <td className="px-3 py-2 font-semibold text-gray-900">
                            {row.goalIndex}
                          </td>
                          <td className="px-3 py-2 font-semibold text-gray-900">
                            {row.count}
                          </td>
                        </tr>
                      ))}
                      {goalRows.length === 0 ? (
                        <tr>
                          <td
                            className="px-3 py-4 text-sm text-gray-600"
                            colSpan={2}
                          >
                            No progress records found.
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="rounded-2xl border border-gray-200 bg-white p-4">
                <div className="text-sm font-extrabold text-gray-900">
                  Top lessons by completions
                </div>
                <div className="mt-3 space-y-2">
                  {(report.topLessons || []).map((row) => (
                    <div
                      key={row.lessonId}
                      className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm"
                    >
                      <div className="min-w-0">
                        <div className="truncate font-semibold text-gray-900">
                          {row.lessonTitle || row.lessonId}
                        </div>
                      </div>
                      <div className="shrink-0 font-extrabold text-gray-900">
                        {row.completions}
                      </div>
                    </div>
                  ))}
                  {(report.topLessons || []).length === 0 ? (
                    <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm text-gray-600">
                      No completions found yet.
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}

function Stat({ label, value }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
        {label}
      </div>
      <div className="mt-2 text-2xl font-extrabold text-gray-900">
        {String(value)}
      </div>
    </div>
  );
}
