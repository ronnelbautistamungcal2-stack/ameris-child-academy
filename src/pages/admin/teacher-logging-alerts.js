import AdminLayout from "@/components/admin/AdminLayout";
import { apiJson } from "@/lib/api";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";

export default function TeacherLoggingAlerts() {
  const router = useRouter();
  const [centers, setCenters] = useState([]);
  const [centerId, setCenterId] = useState("");

  const [summary, setSummary] = useState(null);
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
      setSummary(null);
      return;
    }
    (async () => {
      setLoading(true);
      setError("");
      try {
        const s = await apiJson(
          `/api/v1/compliance/summary?centerId=${encodeURIComponent(centerId)}`,
        );
        setSummary(s);
      } catch (e) {
        setError(e.message || "Failed to load compliance summary");
      } finally {
        setLoading(false);
      }
    })();
  }, [centerId]);

  const teachers = useMemo(() => {
    const arr = Array.isArray(summary?.teachers) ? summary.teachers : [];
    return [...arr].sort((a, b) => (a.email || "").localeCompare(b.email || ""));
  }, [summary]);

  const flagged = useMemo(() => {
    return teachers.filter((t) => (t?.logs?.last24Hours || 0) === 0);
  }, [teachers]);

  return (
    <AdminLayout title="Teacher Logging Alerts">
      <div className="rounded-2xl border border-gray-200 bg-white p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-extrabold text-gray-900">
              Teacher logging alerts
            </h2>
            <p className="mt-1 text-sm text-gray-600">
              Alerts for missing activity logs (last 24 hours + last 7 days).
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
            Choose a center to view teacher logging alerts.
          </div>
        ) : (
          <>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Stat label="Flagged (24h = 0)" value={flagged.length} />
              <Stat label="Total teachers" value={teachers.length} />
            </div>

            <div className="mt-5 overflow-auto rounded-2xl border border-gray-200">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="px-4 py-3 text-left">Teacher</th>
                    <th className="px-4 py-3 text-left">Last 24 hours</th>
                    <th className="px-4 py-3 text-left">Last 7 days</th>
                    <th className="px-4 py-3 text-left">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {teachers.map((t) => {
                    const last24 = t?.logs?.last24Hours || 0;
                    const last7 = t?.logs?.last7Days || 0;
                    const isFlagged = last24 === 0;
                    return (
                      <tr key={t.id} className="border-t border-gray-200">
                        <td className="px-4 py-3">
                          <div className="font-semibold text-gray-900">
                            {t.name || t.email}
                          </div>
                          <div className="text-xs text-gray-500">{t.email}</div>
                        </td>
                        <td className="px-4 py-3 font-semibold text-gray-900">
                          {last24}
                        </td>
                        <td className="px-4 py-3 font-semibold text-gray-900">
                          {last7}
                        </td>
                        <td className="px-4 py-3">
                          {isFlagged ? (
                            <span className="inline-flex rounded-full bg-amber-100 px-2 py-1 text-xs font-extrabold text-amber-800">
                              Missing logs
                            </span>
                          ) : (
                            <span className="inline-flex rounded-full bg-emerald-100 px-2 py-1 text-xs font-extrabold text-emerald-800">
                              OK
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {teachers.length === 0 ? (
                    <tr>
                      <td className="px-4 py-6 text-sm text-gray-600" colSpan={4}>
                        No teachers found.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </>
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

