import PrintableReport from "@/components/timesheets/PrintableReport";
import TimeSheetReportBody, { localDay, longDate } from "@/components/timesheets/TimeSheetReportBody";
import { apiJson } from "@/lib/api";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";

// Child Time Sheet Report / Employee Time Sheet Report for a date range
// (client mockups 2026-10-02), opened from the time sheet's Report button.
// An employee's report shows their e-signature when they signed that range.

export default function TimeSheetReportPage() {
  const router = useRouter();
  const { kind, id, from, to } = router.query;
  const [data, setData] = useState(null);
  const [signature, setSignature] = useState(null);
  const [error, setError] = useState("");
  const [generatedAt, setGeneratedAt] = useState(null);

  useEffect(() => {
    if (!router.isReady || !kind || !id || !from || !to) return;
    const params = new URLSearchParams({ from, to });
    Promise.all([
      apiJson(`/api/v1/time-sheets/${encodeURIComponent(kind)}/${encodeURIComponent(id)}?${params}`),
      kind === "staff"
        ? apiJson(`/api/v1/time-sheets/signatures?${new URLSearchParams({ userId: id, from, to })}`).catch(() => [])
        : Promise.resolve([]),
    ])
      .then(([result, signatures]) => {
        setData(result);
        setSignature(signatures[0] || null);
        setGeneratedAt(new Date());
      })
      .catch((e) => setError(e.message || "Failed to load the report"));
  }, [router.isReady, kind, id, from, to]);

  if (error) return <div className="p-8 text-red-700">{error}</div>;
  if (!data) return <div className="p-8 text-gray-600">Loading report...</div>;

  const isChild = kind === "child";
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
      <TimeSheetReportBody kind={kind} rows={data.rows} from={from} to={to} signature={signature} />
    </PrintableReport>
  );
}

TimeSheetReportPage.noPortalShell = true;
