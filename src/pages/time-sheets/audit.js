import PrintableReport, { reportTable, reportTd, reportTh } from "@/components/timesheets/PrintableReport";
import { apiJson } from "@/lib/api";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";

// Child / Employee Time Sheet Audit Report (client mockups 2026-10-02): every
// change or deletion made from the time sheet, ongoing (no date range), with
// the original times, what changed, when and by whom.

const date = (v) => (v ? new Date(v).toLocaleDateString() : "");
const time = (v) => (v ? new Date(v).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "");
const longDate = (v) => new Date(v).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });

function describeChange(entry) {
  if (entry.action === "DELETED") return "Record deleted";
  const field = entry.action === "CHECK_IN_CHANGED" ? "Check In" : "Check Out";
  return entry.newValue ? `${field} changed to ${time(entry.newValue)}` : `${field} cleared`;
}

export default function TimeSheetAuditPage() {
  const router = useRouter();
  const { kind, id } = router.query;
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [generatedAt, setGeneratedAt] = useState(null);

  useEffect(() => {
    if (!router.isReady || !kind || !id) return;
    apiJson(`/api/v1/time-sheets/${encodeURIComponent(kind)}/${encodeURIComponent(id)}/audit`)
      .then((result) => {
        setData(result);
        setGeneratedAt(new Date());
      })
      .catch((e) => setError(e.message || "Failed to load the audit report"));
  }, [router.isReady, kind, id]);

  if (error) return <div className="p-8 text-red-700">{error}</div>;
  if (!data) return <div className="p-8 text-gray-600">Loading audit report...</div>;

  const isChild = kind === "child";
  const subject = data.subject;

  return (
    <PrintableReport
      title={isChild ? "Child Time Sheet Audit Report" : "Employee Time Sheet Audit Report"}
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
      {data.entries.length === 0 ? (
        <p className="py-6 text-center text-black">No changes or deletions have been made to this time sheet.</p>
      ) : (
        <table className={reportTable}>
          <thead>
            <tr>
              <th className={reportTh}>Date</th>
              <th className={reportTh}>Original Check In Time</th>
              <th className={reportTh}>By</th>
              <th className={reportTh}>Original Check Out Time</th>
              <th className={reportTh}>By</th>
              <th className={reportTh}>Change Made</th>
              <th className={reportTh}>Date of Change</th>
              <th className={reportTh}>Made By</th>
            </tr>
          </thead>
          <tbody>
            {data.entries.map((entry) => (
              <tr key={entry.id}>
                <td className={reportTd}>{date(entry.day)}</td>
                <td className={reportTd}>{time(entry.originalIn)}</td>
                <td className={reportTd}>{entry.originalInBy || ""}</td>
                <td className={reportTd}>{time(entry.originalOut)}</td>
                <td className={reportTd}>{entry.originalOutBy || ""}</td>
                <td className={reportTd}>{describeChange(entry)}</td>
                <td className={reportTd}>{date(entry.changedAt)} {time(entry.changedAt)}</td>
                <td className={reportTd}>{entry.changedByInitials}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </PrintableReport>
  );
}

TimeSheetAuditPage.noPortalShell = true;
