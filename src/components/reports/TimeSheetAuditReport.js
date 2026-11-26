import { CenterSelect, ReportControls, ReportMessage, input, monthRange, useReportCenters } from "@/components/reports/ReportSheet";
import { localDay, longDate } from "@/components/timesheets/TimeSheetReportBody";
import { apiJson } from "@/lib/api";
import { useEffect, useState } from "react";

// Student / Staff Audit Report (client sheet 10-29 (11), rows 59/60): every
// child or employee with anything on their time sheet audit for the dates,
// with each change or deletion.

const date = (v) => (v ? new Date(v).toLocaleDateString() : "");
const time = (v) => (v ? new Date(v).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "");

function describeChange(entry) {
  if (entry.action === "DELETED") return "Record deleted";
  const field = entry.action === "CHECK_IN_CHANGED" ? "Check In" : "Check Out";
  return entry.newValue ? `${field} changed to ${time(entry.newValue)}` : `${field} cleared`;
}

const th = "border border-gray-300 bg-[#f3f4f6] px-2 py-1.5 text-center font-semibold text-black";
const td = "border border-gray-300 px-2 py-1 text-center text-black";

export default function TimeSheetAuditReport({ kind = "child" }) {
  const { centers, centerId, setCenterId } = useReportCenters();
  const [range, setRange] = useState(() => monthRange());
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const isChild = kind === "child";
  const title = isChild ? "Student Audit Report" : "Staff Audit Report";

  useEffect(() => {
    if (!centerId) return;
    setData(null);
    setError("");
    apiJson(`/api/v1/reports/time-sheet-audits?${new URLSearchParams({ kind, centerId, from: range.from, to: range.to })}`)
      .then(setData)
      .catch((e) => setError(e.message || "Failed to load the report"));
  }, [kind, centerId, range]);

  return (
    <div className="space-y-4">
      <ReportControls title={title} onPrint={false}>
        <CenterSelect centers={centers} centerId={centerId} setCenterId={setCenterId} />
        <label className="block text-sm font-bold">
          From
          <input type="date" value={range.from} max={range.to} onChange={(e) => e.target.value && setRange((r) => ({ ...r, from: e.target.value }))} className={input} />
        </label>
        <label className="block text-sm font-bold">
          To
          <input type="date" value={range.to} min={range.from} onChange={(e) => e.target.value && setRange((r) => ({ ...r, to: e.target.value }))} className={input} />
        </label>
      </ReportControls>
      {error ? <ReportMessage tone="red">{error}</ReportMessage> : null}
      {!centerId ? (
        <ReportMessage>Choose a center to generate the report.</ReportMessage>
      ) : !data ? (
        <ReportMessage>Loading…</ReportMessage>
      ) : !data.people.length ? (
        <ReportMessage>No {isChild ? "student" : "staff"} time sheets were changed for these dates.</ReportMessage>
      ) : (
        <div className="space-y-6">
          <div className="text-center">
            {data.center?.name ? <div className="text-lg font-bold text-[#0b2a5b] dark:text-blue-100">{data.center.name}</div> : null}
            <div className="text-xl font-black text-[#0b2a5b] dark:text-blue-100">{title}</div>
            <div className="text-sm text-gray-600">{longDate(localDay(data.from))} – {longDate(localDay(data.to))} · {data.people.length} {isChild ? "students" : "staff"}</div>
          </div>
          {data.people.map((p) => (
            <section key={p.id} className="break-inside-avoid rounded-2xl border border-gray-200 bg-white p-4 text-black dark:border-gray-700">
              <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                <div className="font-bold">
                  {isChild ? "Child Name" : "Employee Name"}: {p.name}
                </div>
                <div className="text-sm text-gray-600">{p.entries.length} change{p.entries.length === 1 ? "" : "s"}</div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr>
                      {["Date", "Original Check In", "By", "Original Check Out", "By", "Change Made", "Date of Change", "Made By"].map((h, i) => (
                        <th key={i} className={th}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {p.entries.map((e) => (
                      <tr key={e.id}>
                        <td className={td}>{date(e.day)}</td>
                        <td className={td}>{time(e.originalIn)}</td>
                        <td className={td}>{e.originalInBy || ""}</td>
                        <td className={td}>{time(e.originalOut)}</td>
                        <td className={td}>{e.originalOutBy || ""}</td>
                        <td className={td}>{describeChange(e)}</td>
                        <td className={td}>{date(e.changedAt)} {time(e.changedAt)}</td>
                        <td className={td}>{e.changedByInitials}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
