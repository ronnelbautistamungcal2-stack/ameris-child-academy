import TeacherLayout from "@/components/teacher/TeacherLayout";
import { apiJson } from "@/lib/api";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

function byString(a, b) {
  return String(a || "").localeCompare(String(b || ""));
}

function startOfDay(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfWeekMonday(date = new Date()) {
  const d = startOfDay(date);
  const day = d.getDay(); // 0=Sun
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

export default function TeacherTraining() {
  const [centers, setCenters] = useState([]);
  const [centerId, setCenterId] = useState("");

  const [metrics, setMetrics] = useState(null);
  const [plans, setPlans] = useState([]);

  const [loading, setLoading] = useState(true);
  const [loadingPlans, setLoadingPlans] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError("");
      try {
        const [c, m] = await Promise.all([
          apiJson("/api/v1/centers"),
          apiJson("/api/v1/metrics/me").catch(() => null),
        ]);
        const arr = Array.isArray(c) ? c : [];
        setCenters(arr);
        if (arr.length === 1) setCenterId(arr[0].id);
        setMetrics(m);
      } catch (e) {
        setError(e.message || "Failed to load training data");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      if (!centerId) {
        setPlans([]);
        return;
      }
      setLoadingPlans(true);
      setError("");
      try {
        const today = startOfDay(new Date());
        const week = startOfWeekMonday(new Date());
        const [daily, weekly] = await Promise.all([
          apiJson(
            `/api/v1/milestone-checklists?centerId=${encodeURIComponent(centerId)}&period=DAY&start=${encodeURIComponent(
              today.toISOString(),
            )}`,
          ).catch(() => []),
          apiJson(
            `/api/v1/milestone-checklists?centerId=${encodeURIComponent(centerId)}&period=WEEK&start=${encodeURIComponent(
              week.toISOString(),
            )}`,
          ).catch(() => []),
        ]);
        const merged = [
          ...(Array.isArray(daily) ? daily : []),
          ...(Array.isArray(weekly) ? weekly : []),
        ];
        setPlans(merged);
      } catch (e) {
        setError(e.message || "Failed to load training pathway");
      } finally {
        setLoadingPlans(false);
      }
    })();
  }, [centerId]);

  const sortedPlans = useMemo(() => {
    return (plans || [])
      .slice()
      .sort((a, b) => {
        const cmpPeriod = byString(a.period, b.period);
        if (cmpPeriod !== 0) return cmpPeriod;
        return new Date(a.periodStart).getTime() - new Date(b.periodStart).getTime();
      })
      .slice(0, 6);
  }, [plans]);

  return (
    <TeacherLayout title="My Performance & Training">
      <div className="space-y-4">
        <div className="rounded-2xl border border-gray-200 bg-white p-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-extrabold text-gray-900">
                My Performance & Training
              </h2>
              <p className="mt-1 text-sm text-gray-600">
                Teacher metrics and a training pathway view.
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

          {error ? (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              {error}
            </div>
          ) : null}

          {loading ? (
            <div className="mt-4 text-sm text-gray-600">Loading…</div>
          ) : (
            <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-gray-200 bg-white p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Teacher metrics
                </div>
                <p className="mt-1 text-sm text-gray-600">
                  Based on your activity logs (more metrics can be added).
                </p>

                {metrics ? (
                  <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Metric label="Activities (Today)" value={metrics.activities?.today ?? 0} />
                    <Metric label="Activities (This Week)" value={metrics.activities?.week ?? 0} />
                    <Metric label="Activities (Last 30 Days)" value={metrics.activities?.last30Days ?? 0} />
                    <Metric label="Children Accessible" value={metrics.access?.children ?? 0} />
                  </div>
                ) : (
                  <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm text-gray-600">
                    Metrics not available.
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-gray-200 bg-white p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Training pathway
                </div>
                <p className="mt-1 text-sm text-gray-600">
                  Daily/weekly pathway items linked to policies, procedures, videos, and lessons.
                </p>

                <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <Link
                    href="/teacher/lessons"
                    className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
                  >
                    Lesson Plans & Media
                  </Link>
                  <Link
                    href="/teacher/milestone-checklists"
                    className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
                  >
                    Training Pathway View
                  </Link>
                </div>

                {!centerId ? (
                  <div className="mt-3 rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm text-gray-600">
                    Select a center to preview today’s training pathway.
                  </div>
                ) : loadingPlans ? (
                  <div className="mt-3 text-sm text-gray-600">Loading…</div>
                ) : sortedPlans.length ? (
                  <div className="mt-3 space-y-2">
                    {sortedPlans.map((p) => (
                      <div key={p.id} className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                        <div className="text-sm font-extrabold text-gray-900">
                          {p.title}
                        </div>
                        <div className="mt-1 text-xs text-gray-600">
                          {p.period} • {new Date(p.periodStart).toLocaleDateString()} •{" "}
                          {(p.items || []).length} items
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-3 rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm text-gray-600">
                    No pathway plans found for today/this week.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </TeacherLayout>
  );
}

function Metric({ label, value }) {
  return (
    <div className="rounded-xl border border-gray-200 p-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
        {label}
      </div>
      <div className="mt-1 text-2xl font-extrabold text-gray-900">{value}</div>
    </div>
  );
}

