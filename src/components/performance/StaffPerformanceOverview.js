import { NAVY } from "@/components/reports/reportUi";
import { useReportFilters } from "@/components/reports/ReportFilters";
import StaffPerformanceTable from "@/components/reports/StaffPerformanceTable";
import Skeleton from "@/components/ui/Skeleton";
import useSyncedCenterId from "@/hooks/useSyncedCenterId";
import { apiJson } from "@/lib/api";
import { useEffect, useState } from "react";

// Staff Performance Overview for coaches and HR (client mockup 22): every
// current staff member's grades, percentages and hours for a date range.
// Clicking a name opens that person's performance page (basePath/<id>).

const control = "mt-1 block rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800";

function dayKey(d) {
  return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, "0"), String(d.getDate()).padStart(2, "0")].join("-");
}

export default function StaffPerformanceOverview({ Layout, layoutProps = {}, basePath }) {
  const { staff: staffFilter } = useReportFilters();
  const [centers, setCenters] = useState([]);
  const [centerId, setCenterId] = useState("");
  const [range, setRange] = useState(() => {
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - 14);
    return { from: dayKey(from), to: dayKey(to) };
  });
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useSyncedCenterId(centerId, setCenterId, centers);

  useEffect(() => {
    apiJson("/api/v1/centers")
      .then((rows) => {
        const list = Array.isArray(rows) ? rows : [];
        setCenters(list);
        if (list.length === 1) setCenterId(list[0].id);
      })
      .catch((e) => setError(e.message || "Failed to load centers"));
  }, []);

  useEffect(() => {
    if (!centerId || range.from > range.to) return;
    setData(null);
    setError("");
    const params = { centerId, from: range.from, to: range.to, staffOnly: "1", ...(staffFilter === "ALL" ? { allStaff: "1" } : {}) };
    apiJson(`/api/v1/reports/center-performance?${new URLSearchParams(params)}`)
      .then(setData)
      .catch((e) => setError(e.message || "Failed to load staff performance"));
  }, [centerId, range, staffFilter]);

  return (
    <Layout title="Staff Performance" {...layoutProps}>
      <div className="space-y-4">
        <div>
          <h1 className={`text-3xl font-black ${NAVY}`}>Staff Performance</h1>
          <p className={`text-sm ${NAVY}`}>View and compare staff performance across key areas.</p>
        </div>
        {error ? <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          {!centerId ? (
            <select value={centerId} onChange={(e) => setCenterId(e.target.value)} className={control} aria-label="Center">
              <option value="">Select a center...</option>
              {centers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          ) : !data ? (
            <Skeleton count={8} />
          ) : (
            <StaffPerformanceTable staff={data.staff} viewHref={(row) => `${basePath}/${row.id}?${new URLSearchParams({ centerId, from: range.from, to: range.to })}`}>
              {centers.length > 1 ? (
                <label className={`text-sm font-semibold ${NAVY}`}>
                  Center
                  <select value={centerId} onChange={(e) => setCenterId(e.target.value)} className={`${control} w-48`}>
                    {centers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </label>
              ) : null}
              <div className={`text-sm font-semibold ${NAVY}`}>
                Date Range
                <div className="mt-1 flex items-center gap-2">
                  <input type="date" value={range.from} max={range.to} onChange={(e) => e.target.value && setRange({ ...range, from: e.target.value })} className={`${control} mt-0`} aria-label="Start date" />
                  <span className="text-gray-500">–</span>
                  <input type="date" value={range.to} min={range.from} onChange={(e) => e.target.value && setRange({ ...range, to: e.target.value })} className={`${control} mt-0`} aria-label="End date" />
                </div>
              </div>
            </StaffPerformanceTable>
          )}
        </div>
      </div>
    </Layout>
  );
}
