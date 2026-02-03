import TeacherLayout from "@/components/teacher/TeacherLayout";
import { apiJson } from "@/lib/api";
import { useEffect, useState } from "react";

export default function TeacherMetrics() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError("");
      try {
        const m = await apiJson("/api/v1/metrics/me");
        setData(m);
      } catch (e) {
        setError(e.message || "Failed to load metrics");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <TeacherLayout title="Metrics & Reports">
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="text-lg font-extrabold">My Performance Metrics</h2>
        <p className="mt-1 text-sm text-gray-600">
          Basic metrics based on your activity logs (more reports can be added).
        </p>

        {error ? (
          <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {error}
          </div>
        ) : null}

        {loading ? (
          <div className="mt-4 text-sm text-gray-600">Loading…</div>
        ) : data ? (
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Metric label="Activities (Today)" value={data.activities?.today ?? 0} />
            <Metric label="Activities (This Week)" value={data.activities?.week ?? 0} />
            <Metric label="Activities (Last 30 Days)" value={data.activities?.last30Days ?? 0} />
            <Metric label="Centers Accessible" value={data.access?.centers ?? 0} />
            <Metric label="Children Accessible" value={data.access?.children ?? 0} />
          </div>
        ) : null}

        <div className="mt-5 rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">
          Want reports for classroom performance, training completion, and professional development?
          Tell me where you want those stored (DB models vs external LMS).
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

