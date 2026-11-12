import { CenterSelect, ReportControls, ReportMessage, ReportSheet, input, longDate, monthRange, useReportCenters } from "@/components/reports/ReportSheet";
import { apiJson } from "@/lib/api";
import { useEffect, useMemo, useState } from "react";

// Milestone Change Log (client request 2026-10-29): every change to a child's
// milestone level, from what to what and who made it, for a date range and
// optionally one child. Prints portrait.

export default function MilestoneChangeLog() {
  const { centers, centerId, setCenterId, centerName } = useReportCenters();
  const [range, setRange] = useState(() => monthRange());
  const [childId, setChildId] = useState("");
  const [childSearch, setChildSearch] = useState("");
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!centerId) return;
    setData(null);
    setError("");
    const qs = new URLSearchParams({ centerId, from: range.from, to: range.to, ...(childId ? { childId } : {}) });
    apiJson(`/api/v1/reports/milestone-changes?${qs}`)
      .then(setData)
      .catch((e) => setError(e.message || "Failed to load the report"));
  }, [centerId, range, childId]);

  const children = useMemo(() => {
    const q = childSearch.trim().toLowerCase();
    return (data?.children || []).filter((c) => !q || c.name.toLowerCase().includes(q) || c.id === childId);
  }, [data, childSearch, childId]);

  return (
    <div className="space-y-4">
      <ReportControls title="Milestone Change Log">
        <CenterSelect centers={centers} centerId={centerId} setCenterId={(id) => { setCenterId(id); setChildId(""); }} />
        <label className="block text-sm font-bold">
          From
          <input type="date" value={range.from} max={range.to} onChange={(e) => e.target.value && setRange((r) => ({ ...r, from: e.target.value }))} className={input} />
        </label>
        <label className="block text-sm font-bold">
          To
          <input type="date" value={range.to} min={range.from} onChange={(e) => e.target.value && setRange((r) => ({ ...r, to: e.target.value }))} className={input} />
        </label>
        <label className="block text-sm font-bold">
          Child
          <input value={childSearch} onChange={(e) => setChildSearch(e.target.value)} placeholder="Search child..." className={input} />
          <select value={childId} onChange={(e) => setChildId(e.target.value)} aria-label="Child" className={input}>
            <option value="">All children</option>
            {children.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
      </ReportControls>
      {error ? <ReportMessage tone="red">{error}</ReportMessage> : null}
      {!centerId ? (
        <ReportMessage>Choose a center to generate the report.</ReportMessage>
      ) : !data ? (
        <ReportMessage>Loading…</ReportMessage>
      ) : (
        <ReportSheet heading={centerName} title="Milestone Change Log" subtitle={`${longDate(data.from)} – ${longDate(data.to)}`} orientation="portrait" copyright>
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-[#16305e] text-left text-white">
                {["Date", "Child", "Milestone", "Changed From", "Changed To", "Changed By"].map((h) => <th key={h} className="px-3 py-2 text-xs font-bold">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r) => (
                <tr key={r.id} className="odd:bg-white even:bg-blue-50/60 dark:odd:bg-gray-900 dark:even:bg-gray-800">
                  <td className="whitespace-nowrap px-3 py-1.5">{new Date(r.date).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}</td>
                  <td className="px-3 py-1.5">{r.child}</td>
                  <td className="px-3 py-1.5">
                    {r.milestone}
                    <div className="text-xs text-gray-500">{r.category}</div>
                  </td>
                  <td className="px-3 py-1.5">{r.from}</td>
                  <td className="px-3 py-1.5 font-semibold">{r.to}</td>
                  <td className="px-3 py-1.5">{r.changedBy}</td>
                </tr>
              ))}
              {!data.rows.length ? <tr><td colSpan={6} className="px-3 py-6 text-center text-gray-500">No milestone changes in these dates.</td></tr> : null}
            </tbody>
          </table>
        </ReportSheet>
      )}
    </div>
  );
}
