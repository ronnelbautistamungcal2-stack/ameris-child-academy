import { CenterSelect, ReportControls, ReportMessage, input, monthRange, useReportCenters } from "@/components/reports/ReportSheet";
import { apiJson } from "@/lib/api";
import { useEffect, useMemo, useState } from "react";

// Staff Training Report (client request 2026-10-29): each staff member's
// trainings for a date range, one staff member (search by name) or all of
// them at once, printable and exportable.

const fmtDate = (v) => (v ? new Date(v).toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric", timeZone: "UTC" }) : "—");
const fmtHours = (v) => (v == null ? "—" : Number(v).toFixed(2).replace(/\.00$/, ""));

export default function StaffTrainingReport() {
  const { centers, centerId, setCenterId } = useReportCenters();
  const [range, setRange] = useState(() => monthRange());
  const [search, setSearch] = useState("");
  const [staffId, setStaffId] = useState("ALL");
  const [rows, setRows] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!centerId) return;
    setRows(null);
    setError("");
    const qs = new URLSearchParams({ centerId, from: range.from, to: range.to, includeLogs: "1" });
    apiJson(`/api/v1/training/hours?${qs}`)
      .then((list) => setRows(Array.isArray(list) ? list : []))
      .catch((e) => setError(e.message || "Failed to load training"));
  }, [centerId, range]);

  const matches = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (rows || []).filter((r) => !q || r.name.toLowerCase().includes(q));
  }, [rows, search]);
  const shown = staffId === "ALL" ? matches : matches.filter((r) => r.id === staffId);
  const centerName = centers.find((c) => c.id === centerId)?.name || "";

  return (
    <div className="space-y-4">
      {/* Print and Export are the Reports page's buttons at the top (client sheet 2026-11-07). */}
      <ReportControls title="Staff Training Report" onPrint={false}>
        <CenterSelect centers={centers} centerId={centerId} setCenterId={setCenterId} />
        <label className="block text-sm font-bold">
          From
          <input type="date" value={range.from} max={range.to} onChange={(e) => e.target.value && setRange((r) => ({ ...r, from: e.target.value }))} className={input} />
        </label>
        <label className="block text-sm font-bold">
          To
          <input type="date" value={range.to} min={range.from} onChange={(e) => e.target.value && setRange((r) => ({ ...r, to: e.target.value }))} className={input} />
        </label>
        <label className="block text-sm font-bold">
          Staff Name
          <input value={search} onChange={(e) => { setSearch(e.target.value); setStaffId("ALL"); }} placeholder="Search staff..." className={input} />
          <select value={staffId} onChange={(e) => setStaffId(e.target.value)} aria-label="Staff member" className={input}>
            <option value="ALL">All staff ({matches.length})</option>
            {matches.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </label>
      </ReportControls>
      {error ? <ReportMessage tone="red">{error}</ReportMessage> : null}
      {!centerId ? (
        <ReportMessage>Choose a center to generate the report.</ReportMessage>
      ) : !rows ? (
        <ReportMessage>Loading…</ReportMessage>
      ) : (
        <div className="space-y-4">
          {shown.map((s) => (
            <section key={s.id} className="break-inside-avoid rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900 print:break-after-page">
              <div className="text-center">
                {centerName ? <div className="text-xl font-black text-[#0b2a5b] dark:text-blue-100">{centerName}</div> : null}
                <div className="text-sm text-gray-600">Training Report · {fmtDate(`${range.from}T00:00:00Z`)} – {fmtDate(`${range.to}T00:00:00Z`)}</div>
              </div>
              <div className="mt-3 flex flex-wrap justify-between gap-2 text-sm">
                <div><b>{s.name}</b> · {s.position}</div>
                <div>Date Hired: {fmtDate(s.hireDate)}</div>
              </div>
              <table className="mt-2 w-full text-sm">
                <thead>
                  <tr className="bg-blue-50 text-left font-bold text-[#0b2a5b] dark:bg-gray-800 dark:text-blue-100">
                    {["Topic", "Source of Training", "Date Completed", "Non Interactive Time (Hours)", "Interactive Time (Hours)"].map((h) => <th key={h} className="px-3 py-2">{h}</th>)}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {(s.logs || []).map((l) => (
                    <tr key={l.id}>
                      <td className="px-3 py-1.5">{l.topic}</td>
                      <td className="px-3 py-1.5">{l.source || "—"}</td>
                      <td className="px-3 py-1.5">{fmtDate(l.date)}</td>
                      <td className="px-3 py-1.5 text-center">{fmtHours(l.nonInteractiveHours)}</td>
                      <td className="px-3 py-1.5 text-center">{fmtHours(l.interactiveHours)}</td>
                    </tr>
                  ))}
                  {!(s.logs || []).length ? <tr><td colSpan={5} className="px-3 py-4 text-center text-gray-500">No training in these dates.</td></tr> : null}
                </tbody>
              </table>
              <div className="mt-2 flex flex-wrap gap-6 text-sm">
                <span>Total Hours: <b>{fmtHours(s.hours)}</b></span>
                <span>Non-Interactive: <b>{fmtHours(s.nonInteractiveHours)}</b></span>
                <span>Interactive: <b>{fmtHours(s.interactiveHours)}</b></span>
              </div>
            </section>
          ))}
          {!shown.length ? <ReportMessage>No staff match.</ReportMessage> : null}
        </div>
      )}
    </div>
  );
}
