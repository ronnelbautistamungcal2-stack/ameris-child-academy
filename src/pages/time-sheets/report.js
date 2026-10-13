import PrintableReport, { reportTable, reportTd, reportTh } from "@/components/timesheets/PrintableReport";
import { apiJson } from "@/lib/api";
import { groupIntoWeeks } from "@/lib/timeSheetReport";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";

// Child Time Sheet Report / Employee Time Sheet Report for a date range
// (client mockups 2026-10-02), opened from the time sheet's Report button.

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const date = (v) => new Date(v).toLocaleDateString();
const time = (v) => (v ? new Date(v).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "");
const longDate = (v) => new Date(v).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
const localDay = (value) => new Date(`${value}T00:00`);

export default function TimeSheetReportPage() {
  const router = useRouter();
  const { kind, id, from, to } = router.query;
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [generatedAt, setGeneratedAt] = useState(null);

  useEffect(() => {
    if (!router.isReady || !kind || !id || !from || !to) return;
    const params = new URLSearchParams({ from, to });
    apiJson(`/api/v1/time-sheets/${encodeURIComponent(kind)}/${encodeURIComponent(id)}?${params}`)
      .then((result) => {
        setData(result);
        setGeneratedAt(new Date());
      })
      .catch((e) => setError(e.message || "Failed to load the report"));
  }, [router.isReady, kind, id, from, to]);

  if (error) return <div className="p-8 text-red-700">{error}</div>;
  if (!data) return <div className="p-8 text-gray-600">Loading report...</div>;

  const isChild = kind === "child";
  const { weeks, totalHours } = groupIntoWeeks(data.rows, localDay(from), localDay(to));
  const subject = data.subject;

  return (
    <PrintableReport
      title={isChild ? "Child Time Sheet Report" : "Employee Time Sheet Report"}
      subtitle={`${longDate(localDay(from))} – ${longDate(localDay(to))}`}
      generatedAt={generatedAt}
      header={
        isChild ? (
          <div className="flex flex-wrap justify-between gap-4">
            <div>
              <div><strong>Child Name:</strong> {subject.name}</div>
              {subject.birthDate ? <div><strong>Date of Birth:</strong> {longDate(subject.birthDate)}</div> : null}
            </div>
            {subject.parents?.length ? <div><strong>Parent:</strong> {subject.parents.join(" and ")}</div> : null}
          </div>
        ) : (
          <div><strong>Employee Name:</strong> {subject.name}</div>
        )
      }
    >
      {weeks.length === 0 ? <p className="py-6 text-center text-black">No time recorded in this date range.</p> : null}
      {weeks.map((week) => (
        <section key={week.start.toISOString()} className="mb-6 break-inside-avoid">
          <h2 className="mb-2 text-base font-bold text-black">
            {longDate(week.start)} {"–"} {longDate(week.end)}
          </h2>
          <table className={reportTable}>
            <thead>
              <tr>
                <th className={reportTh}>Date</th>
                <th className={reportTh}>Day</th>
                <th className={reportTh}>Time In</th>
                {isChild ? <th className={reportTh}>By</th> : null}
                {isChild ? null : <th className={reportTh}>Date Out</th>}
                <th className={reportTh}>Time Out</th>
                {isChild ? <th className={reportTh}>By</th> : null}
                <th className={reportTh}>Hours</th>
              </tr>
            </thead>
            <tbody>
              {week.rows.map((row) => (
                <tr key={row.id}>
                  <td className={reportTd}>{date(row.day)}</td>
                  <td className={reportTd}>{DAY_NAMES[new Date(row.day).getDay()]}</td>
                  <td className={reportTd}>{time(row.timeIn)}</td>
                  {isChild ? <td className={reportTd}>{row.inBy || ""}</td> : null}
                  {isChild ? null : <td className={reportTd}>{row.timeOut ? date(row.timeOut) : ""}</td>}
                  <td className={reportTd}>{time(row.timeOut)}</td>
                  {isChild ? <td className={reportTd}>{row.outBy || ""}</td> : null}
                  <td className={reportTd}>{row.hours.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-1 text-right text-sm font-bold text-black">
            {isChild ? "" : "Weekly Total Hours: "}
            {week.totalHours.toFixed(2)}
          </div>
        </section>
      ))}
      <div className="mt-4 flex justify-end border-t-2 border-gray-400 pt-3 text-lg font-bold text-black">
        Total Hours for Date Range: <span className="ml-3">{totalHours.toFixed(2)}</span>
      </div>
      {isChild ? null : (
        <div className="mt-10 grid grid-cols-[2fr_1fr] gap-8 text-sm text-black">
          <div className="border-t border-black pt-1">Employee Signature</div>
          <div className="border-t border-black pt-1">Date</div>
        </div>
      )}
    </PrintableReport>
  );
}

TimeSheetReportPage.noPortalShell = true;
