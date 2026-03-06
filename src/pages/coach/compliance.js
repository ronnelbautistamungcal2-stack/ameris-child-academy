import CoachLayout from "@/components/coach/CoachLayout";
import { SkeletonTable } from "@/components/ui/Skeleton";
import { apiJson } from "@/lib/api";
import { useEffect, useMemo, useState } from "react";

export default function CoachCompliance() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError("");
      try {
        const res = await apiJson("/api/v1/compliance/summary");
        setData(res);
      } catch (e) {
        setError(e.message || "Failed to load compliance summary");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const rows = useMemo(() => {
    const teachers = data?.teachers || [];
    return teachers
      .slice()
      .sort((a, b) => (b.logs?.last7Days || 0) - (a.logs?.last7Days || 0));
  }, [data]);

  return (
    <CoachLayout title="Compliance">
      <div className="rounded-2xl border border-gray-200 bg-white p-5">
        <h2 className="text-lg font-extrabold text-gray-900">Logging & Compliance</h2>
        <p className="mt-1 text-sm text-gray-600">
          Quick summary of teacher logging based on activity logs.
        </p>

        {error ? (
          <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {error}
          </div>
        ) : null}

        {loading ? (
          <div className="mt-4"><SkeletonTable rows={5} cols={4} /></div>
        ) : !rows.length ? (
          <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
            No teacher data available.
          </div>
        ) : (
          <div className="mt-4 overflow-hidden rounded-2xl border border-gray-200">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-3">Teacher</th>
                  <th className="px-4 py-3">Logs (24h)</th>
                  <th className="px-4 py-3">Logs (7d)</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((t) => {
                  const last24 = t.logs?.last24Hours || 0;
                  const last7 = t.logs?.last7Days || 0;
                  const ok = last24 > 0;
                  return (
                    <tr key={t.id}>
                      <td className="px-4 py-3">
                        <div className="font-extrabold text-gray-900">
                          {t.name || t.email}
                        </div>
                        <div className="text-xs text-gray-500">{t.email}</div>
                      </td>
                      <td className="px-4 py-3 font-semibold text-gray-900">{last24}</td>
                      <td className="px-4 py-3 font-semibold text-gray-900">{last7}</td>
                      <td className="px-4 py-3">
                        <span
                          className={[
                            "rounded-full px-2 py-1 text-xs font-extrabold",
                            ok
                              ? "bg-green-50 text-green-700"
                              : "bg-amber-50 text-amber-700",
                          ].join(" ")}
                        >
                          {ok ? "OK" : "Needs follow-up"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </CoachLayout>
  );
}
