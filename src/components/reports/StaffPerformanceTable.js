import { NAVY } from "@/components/reports/reportUi";
import { roleLabel } from "@/lib/roles";
import Link from "next/link";
import { useMemo, useState } from "react";

// The Staff Performance Overview table (client mockups 22 and 33): role and
// teacher filters, Reset Filters, CSV Export, and a row per staff member whose
// name and View button open their performance page (viewHref(row)).

const control = "rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100";
const COLUMNS = ["Staff Name", "Position", "Overall Current Grade", "Overall Prior Grade", "Evaluation %", "Checklist %", "Average SOP %", "Class Citizenship %", "# Commendations", "# Citations", "Hours Worked", "Hours Scheduled", "# Hours Absence", "# Lates"];

const pct = (v) => (v == null ? "—" : `${Math.round(v)}%`);
const num = (v) => (v == null ? "—" : v);

export function gradeTone(value) {
  if (value == null) return "bg-gray-100 text-gray-500";
  if (value >= 90) return "bg-emerald-200 text-emerald-900";
  if (value >= 80) return "bg-green-100 text-green-800";
  if (value >= 70) return "bg-yellow-100 text-yellow-800";
  if (value >= 60) return "bg-orange-100 text-orange-800";
  return "bg-red-100 text-red-800";
}

function downloadCsv(rows) {
  const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const lines = [COLUMNS.map(esc).join(",")].concat(
    rows.map((r) => [r.name, r.position, r.currentGrade, r.priorGrade, r.evaluationPct, r.checklistPct, r.sopPct, r.citizenshipPct, r.commendations, r.citations, r.hoursWorked, r.hoursScheduled, r.hoursAbsence, r.lates].map(esc).join(",")),
  );
  const url = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/csv" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = "staff-performance-overview.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export default function StaffPerformanceTable({ staff, viewHref, children }) {
  const [filter, setFilter] = useState({ role: "", id: "" });
  const rows = useMemo(() => staff.filter((s) => (!filter.role || s.role === filter.role) && (!filter.id || s.id === filter.id)), [staff, filter]);
  const roles = useMemo(() => [...new Set(staff.map((s) => s.role))], [staff]);

  return (
    <div>
      <div className="flex flex-wrap items-end gap-3">
        {children}
        <label className={`text-sm font-semibold ${NAVY}`}>
          Filter by Role
          <select value={filter.role} onChange={(e) => setFilter({ ...filter, role: e.target.value })} className={`${control} mt-1 block w-48`}>
            <option value="">All Roles</option>
            {roles.map((r) => <option key={r} value={r}>{roleLabel(r)}</option>)}
          </select>
        </label>
        <label className={`text-sm font-semibold ${NAVY}`}>
          Filter by Teacher
          <select value={filter.id} onChange={(e) => setFilter({ ...filter, id: e.target.value })} className={`${control} mt-1 block w-56`}>
            <option value="">All Teachers</option>
            {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </label>
        <div className="ml-auto flex gap-2">
          <button type="button" onClick={() => setFilter({ role: "", id: "" })} className="rounded-lg border border-blue-600 px-4 py-2 text-sm font-semibold text-blue-700 dark:text-blue-300">Reset Filters</button>
          <button type="button" onClick={() => downloadCsv(rows)} disabled={!rows.length} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{"⬇"} Export</button>
        </div>
      </div>
      <div className="mt-3 overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
        <table className="w-full min-w-[1200px] text-center text-sm">
          <thead>
            <tr className={`bg-blue-50 text-xs font-bold dark:bg-gray-800 ${NAVY}`}>
              {[...COLUMNS, "Action"].map((h, i) => (
                <th key={h} className={`px-2 py-2 ${i < 2 ? "text-left" : ""}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => (
              <tr key={s.id} className="border-t border-gray-100 text-gray-700 dark:border-gray-800 dark:text-gray-300">
                <td className="px-2 py-1.5 text-left font-semibold">
                  <Link href={viewHref(s)} className="text-gray-900 hover:text-blue-700 hover:underline dark:text-gray-100">{s.name}</Link>
                </td>
                <td className="px-2 py-1.5 text-left">{s.position}</td>
                <td className="px-2 py-1.5"><span className={`inline-block min-w-[44px] rounded px-2 py-0.5 font-bold ${gradeTone(s.currentGrade)}`}>{num(s.currentGrade)}</span></td>
                <td className="px-2 py-1.5"><span className={`inline-block min-w-[44px] rounded px-2 py-0.5 font-bold ${gradeTone(s.priorGrade)}`}>{num(s.priorGrade)}</span></td>
                <td className="px-2 py-1.5">{pct(s.evaluationPct)}</td>
                <td className="px-2 py-1.5">{pct(s.checklistPct)}</td>
                <td className="px-2 py-1.5">{pct(s.sopPct)}</td>
                <td className="px-2 py-1.5">{pct(s.citizenshipPct)}</td>
                <td className="px-2 py-1.5">{s.commendations}</td>
                <td className="px-2 py-1.5">{s.citations}</td>
                <td className="px-2 py-1.5">{num(s.hoursWorked)}</td>
                <td className="px-2 py-1.5">{num(s.hoursScheduled)}</td>
                <td className="px-2 py-1.5">{num(s.hoursAbsence)}</td>
                <td className="px-2 py-1.5">{s.lates}</td>
                <td className="px-2 py-1.5">
                  <Link href={viewHref(s)} className="inline-block rounded border border-blue-600 px-4 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-50 dark:text-blue-300">View</Link>
                </td>
              </tr>
            ))}
            {!rows.length && (
              <tr><td colSpan={15} className="py-4 text-gray-500">No staff match.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-sm text-gray-500">Showing {rows.length} staff members</p>
    </div>
  );
}
