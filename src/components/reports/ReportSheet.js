import useSyncedCenterId from "@/hooks/useSyncedCenterId";
import { apiJson } from "@/lib/api";
import { COPYRIGHT } from "@/lib/foodReports";
import { useEffect, useState } from "react";

// Shared frame for the printable reports added 2026-10-23 (milestone, infant
// feeding, meal production, meal claim): filter bar, title block, the sheet
// that prints on its own, and the copyright line.

export const NAVY = "text-[#0b2a5b] dark:text-blue-100";
export const input = "mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100";

export function monthRange(date = new Date()) {
  const pad = (n) => String(n).padStart(2, "0");
  const ym = `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
  const last = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  return { from: `${ym}-01`, to: `${ym}-${pad(last)}` };
}

export function longDate(value) {
  if (!value) return "—";
  const d = typeof value === "string" && value.length === 10 ? new Date(`${value}T00:00:00`) : new Date(value);
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

export function shortDate(value) {
  if (!value) return "—";
  const d = typeof value === "string" && value.length === 10 ? new Date(`${value}T00:00:00`) : new Date(value);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/** The centers the user can pick, remembered per portal. */
export function useReportCenters() {
  const [centers, setCenters] = useState([]);
  const [centerId, setCenterId] = useState("");
  useSyncedCenterId(centerId, setCenterId, centers);
  useEffect(() => {
    apiJson("/api/v1/centers")
      .then((rows) => {
        const list = Array.isArray(rows) ? rows : [];
        setCenters(list);
        if (list.length === 1) setCenterId(list[0].id);
      })
      .catch(() => setCenters([]));
  }, []);
  return { centers, centerId, setCenterId };
}

export function CenterSelect({ centers, centerId, setCenterId }) {
  return (
    <label className="block text-sm font-bold">
      Center
      <select value={centerId} onChange={(e) => setCenterId(e.target.value)} className={input}>
        <option value="">Select a center...</option>
        {centers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
    </label>
  );
}

export function ReportControls({ title, children, onPrint = true, actions = null }) {
  return (
    <div className="no-print space-y-3 rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className={`text-2xl font-black ${NAVY}`}>{title}</h1>
        <div className="flex flex-wrap gap-2">
          {actions}
          {onPrint ? (
            <button type="button" onClick={() => window.print()} className="rounded-lg border border-blue-300 px-4 py-2 text-sm font-bold text-blue-700 hover:bg-blue-50">
              🖨 Print
            </button>
          ) : null}
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{children}</div>
    </div>
  );
}

export function ReportMessage({ children, tone = "gray" }) {
  const cls = tone === "red" ? "border-red-200 bg-red-50 text-red-800" : "border-gray-200 bg-white text-gray-600 dark:border-gray-700 dark:bg-gray-900";
  return <div className={`no-print rounded-2xl border p-6 text-center text-sm ${cls}`}>{children}</div>;
}

/** The printable sheet: a navy title block, optional facts box, the body and the copyright. */
export function ReportSheet({ heading = "Ameris Academy", title, subtitle, meta = [], copyright = false, children }) {
  return (
    <div id="report-print-sheet" className="overflow-hidden rounded-2xl border border-gray-200 bg-white text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100">
      <div className="flex flex-wrap items-start justify-between gap-4 px-6 pb-4 pt-5">
        <div className="flex-1 text-center">
          <div className={`text-2xl font-black ${NAVY}`} style={{ fontFamily: "Georgia, serif" }}>{heading}</div>
          <div className={`text-2xl font-black ${NAVY}`} style={{ fontFamily: "Georgia, serif" }}>{title}</div>
          {subtitle ? <div className={`text-base font-bold ${NAVY}`}>{subtitle}</div> : null}
        </div>
        {meta.length ? (
          <dl className="grid grid-cols-[auto_auto] gap-x-4 gap-y-0.5 rounded-xl border border-blue-200 bg-blue-50/60 px-4 py-2 text-xs dark:border-gray-700 dark:bg-gray-800">
            {meta.map(([label, value]) => (
              <div key={label} className="contents">
                <dt className="font-bold">{label}:</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        ) : null}
      </div>
      <div className="overflow-x-auto">{children}</div>
      {copyright ? <div className="border-t border-gray-200 px-6 py-3 text-center text-xs text-gray-600 dark:border-gray-700 dark:text-gray-400">{COPYRIGHT}</div> : null}
      <style jsx global>{`
        @media print {
          @page {
            size: landscape;
            margin: 8mm;
          }
          body * {
            visibility: hidden;
          }
          #report-print-sheet,
          #report-print-sheet * {
            visibility: visible;
          }
          #report-print-sheet {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            border: none;
          }
          #report-print-sheet .overflow-x-auto {
            overflow: visible !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}
