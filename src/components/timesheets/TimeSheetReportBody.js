import { reportTable, reportTd, reportTh } from "@/components/timesheets/PrintableReport";
import { groupIntoWeeks } from "@/lib/timeSheetReport";

// The tables of the Child / Employee Time Sheet Report: one per Monday–Sunday
// week, weekly totals, the range total and, for employees, the signature line
// (filled in once the employee e-signs that date range).

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const date = (v) => new Date(v).toLocaleDateString();
const time = (v) => (v ? new Date(v).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "");
export const longDate = (v) => new Date(v).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
export const localDay = (value) => new Date(`${value}T00:00`);

export default function TimeSheetReportBody({ kind, rows, from, to, signature = null }) {
  const isChild = kind === "child";
  const { weeks, totalHours } = groupIntoWeeks(rows, localDay(from), localDay(to));
  return (
    <>
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
          <div>
            <div className="min-h-[1.75rem] font-serif text-xl italic">{signature?.signatureName || ""}</div>
            <div className="border-t border-black pt-1">
              Employee Signature{signature ? " (signed electronically)" : ""}
            </div>
          </div>
          <div>
            <div className="min-h-[1.75rem]">{signature ? new Date(signature.signedAt).toLocaleDateString() : ""}</div>
            <div className="border-t border-black pt-1">Date</div>
          </div>
        </div>
      )}
    </>
  );
}
