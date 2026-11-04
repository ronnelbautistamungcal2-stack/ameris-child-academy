import { CenterSelect, ReportControls, ReportMessage, input, monthRange, useReportCenters } from "@/components/reports/ReportSheet";
import TimeSheetReportBody, { localDay, longDate } from "@/components/timesheets/TimeSheetReportBody";
import { apiJson } from "@/lib/api";
import { exportToExcel } from "@/lib/exportTable";
import { hoursBetween, roundHours } from "@/lib/timeSheetReport";
import { useEffect, useState } from "react";

// Student / Staff Time Sheets (every time sheet in one printable report) and
// Student / Staff Time Overview (hours signed in per person) for a date range
// (client requests 2026-10-29). Print > Save as PDF gives the PDF.

const time = (v) => (v ? new Date(v).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "");

export default function TimeSheetReports({ kind = "child", mode = "sheets" }) {
  const { centers, centerId, setCenterId } = useReportCenters();
  const [range, setRange] = useState(() => monthRange());
  const [population, setPopulation] = useState("CURRENT");
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const isChild = kind === "child";
  const who = isChild ? "Student" : "Staff";

  useEffect(() => {
    if (!centerId) return;
    setData(null);
    setError("");
    const qs = new URLSearchParams({ kind, mode, centerId, from: range.from, to: range.to, population });
    apiJson(`/api/v1/reports/time-sheets?${qs}`)
      .then(setData)
      .catch((e) => setError(e.message || "Failed to load the report"));
  }, [kind, mode, centerId, range, population]);

  function exportExcel() {
    if (!data) return;
    const name = mode === "overview" ? `${who} Time Overview` : `${who} Time Sheets`;
    const sheets =
      mode === "overview"
        ? [{ name, headers: [isChild ? "Student" : "Employee", "Days Signed In", "Hours"], rows: data.people.map((p) => [p.name, p.days, p.hours]) }]
        : [
            {
              name,
              headers: [isChild ? "Student" : "Employee", "Date", "Time In", "Time Out", "Hours"],
              rows: data.people.flatMap((p) =>
                p.rows.map((r) => [p.name, new Date(r.day).toLocaleDateString(), time(r.timeIn), time(r.timeOut), roundHours(hoursBetween(r.timeIn, r.timeOut))]),
              ),
            },
          ];
    exportToExcel(`${name.toLowerCase().replace(/\s+/g, "-")}-${range.from}-to-${range.to}`, sheets).catch((e) => setError(e.message || "Export failed"));
  }

  const title = mode === "overview" ? `${who} Time Overview` : `${who} Time Sheets`;
  return (
    <div className="space-y-4">
      <ReportControls
        title={title}
        actions={
          <button type="button" onClick={exportExcel} disabled={!data} className="rounded-lg border border-emerald-600 px-4 py-2 text-sm font-bold text-emerald-700 hover:bg-emerald-50 disabled:opacity-50">
            Export to Excel
          </button>
        }
      >
        <CenterSelect centers={centers} centerId={centerId} setCenterId={setCenterId} />
        <label className="block text-sm font-bold">
          From
          <input type="date" value={range.from} max={range.to} onChange={(e) => e.target.value && setRange((r) => ({ ...r, from: e.target.value }))} className={input} />
        </label>
        <label className="block text-sm font-bold">
          To
          <input type="date" value={range.to} min={range.from} onChange={(e) => e.target.value && setRange((r) => ({ ...r, to: e.target.value }))} className={input} />
        </label>
        {mode === "sheets" ? (
          <label className="block text-sm font-bold">
            {isChild ? "Children" : "Staff"}
            <select value={population} onChange={(e) => setPopulation(e.target.value)} className={input}>
              <option value="CURRENT">{isChild ? "Enrolled children" : "Currently employed staff"}</option>
              <option value="ALL">{isChild ? "All children" : "All staff"}</option>
            </select>
          </label>
        ) : null}
      </ReportControls>
      {error ? <ReportMessage tone="red">{error}</ReportMessage> : null}
      {!centerId ? (
        <ReportMessage>Choose a center to generate the report.</ReportMessage>
      ) : !data ? (
        <ReportMessage>Loading…</ReportMessage>
      ) : mode === "overview" ? (
        <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
          <div className="mb-3 text-center">
            <div className="text-xl font-black text-[#0b2a5b] dark:text-blue-100">{title}</div>
            <div className="text-sm text-gray-600">{longDate(localDay(data.from))} – {longDate(localDay(data.to))}</div>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-blue-50 text-left font-bold text-[#0b2a5b] dark:bg-gray-800 dark:text-blue-100">
                <th className="px-3 py-2">{isChild ? "Student" : "Employee"}</th>
                <th className="px-3 py-2 text-right">Days Signed In</th>
                <th className="px-3 py-2 text-right">Hours</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {data.people.map((p) => (
                <tr key={p.id}>
                  <td className="px-3 py-1.5">
                    {p.name}
                    {p.current ? null : <span className="ml-2 rounded bg-gray-100 px-1.5 text-xs text-gray-600">{isChild ? "No longer attending" : "No longer employed"}</span>}
                  </td>
                  <td className="px-3 py-1.5 text-right">{p.days}</td>
                  <td className="px-3 py-1.5 text-right font-semibold">{p.hours.toFixed(2)}</td>
                </tr>
              ))}
              {!data.people.length ? <tr><td colSpan={3} className="px-3 py-6 text-center text-gray-500">No one was signed in during these dates.</td></tr> : null}
            </tbody>
            {data.people.length ? (
              <tfoot>
                <tr className="border-t-2 border-gray-300 font-bold">
                  <td className="px-3 py-2">Total</td>
                  <td className="px-3 py-2 text-right">{data.people.reduce((s, p) => s + p.days, 0)}</td>
                  <td className="px-3 py-2 text-right">{roundHours(data.people.reduce((s, p) => s + p.hours, 0)).toFixed(2)}</td>
                </tr>
              </tfoot>
            ) : null}
          </table>
        </div>
      ) : (
        <div className="space-y-6">
          {data.people.map((p) => (
            <section key={p.id} className="break-after-page rounded-2xl border border-gray-200 bg-white p-5 text-black dark:border-gray-700 print:break-after-page">
              <div className="mb-3 text-center">
                <div className="text-xl font-bold">{isChild ? "Child Time Sheet Report" : "Employee Time Sheet Report"}</div>
                <div className="text-sm">{longDate(localDay(data.from))} – {longDate(localDay(data.to))}</div>
              </div>
              <div className="mb-3 flex flex-wrap justify-between gap-3 border-b border-gray-300 pb-2 text-sm">
                <div>
                  <strong>{isChild ? "Child Name" : "Employee Name"}:</strong> {p.name}
                  {p.birthDate ? <div><strong>Date of Birth:</strong> {longDate(p.birthDate)}</div> : null}
                </div>
                {p.parents?.length ? <div><strong>Parent:</strong> {p.parents.join(" and ")}</div> : null}
              </div>
              <TimeSheetReportBody kind={kind} rows={p.rows} from={data.from} to={data.to} />
            </section>
          ))}
          {!data.people.length ? <ReportMessage>No {isChild ? "children" : "staff"} found.</ReportMessage> : null}
          {data.truncated ? <ReportMessage>Only the first 400 are shown; narrow the filter.</ReportMessage> : null}
        </div>
      )}
    </div>
  );
}
