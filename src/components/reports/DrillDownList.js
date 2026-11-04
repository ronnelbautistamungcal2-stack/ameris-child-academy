import { NAVY } from "@/components/reports/reportUi";
import { studentReportHref } from "@/lib/reportLinks";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { useMemo, useState } from "react";

// Who makes up a chart bar or colour (client requests 2026-10-29): the
// students, each opening to what the teacher logged. entries: [{ id, childId,
// name, date, notes, loggedBy, level }] for logs, or [{ childId, name, detail }].

const shortDate = (key) => (key ? new Date(`${String(key).slice(0, 10)}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "");

export default function DrillDownList({ title, entries, onClose }) {
  const { data: session } = useSession();
  const role = session?.user?.role || "";
  const [openId, setOpenId] = useState("");
  const students = useMemo(() => {
    const map = new Map();
    for (const e of entries) {
      const entry = map.get(e.childId) || { childId: e.childId, name: e.name || "Student", items: [], detail: e.detail };
      if (e.id) entry.items.push(e);
      map.set(e.childId, entry);
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [entries]);

  return (
    <div className="mt-3 rounded-xl border border-blue-100 bg-blue-50/40 p-3 dark:border-gray-700 dark:bg-gray-800/60" aria-live="polite">
      <div className="flex items-center justify-between gap-2">
        <h4 className={`text-sm font-black ${NAVY}`}>
          {title} <span className="font-semibold text-gray-500">({students.length} student{students.length === 1 ? "" : "s"})</span>
        </h4>
        <button type="button" onClick={onClose} aria-label="Close list" className="text-lg text-gray-500">&times;</button>
      </div>
      <ul className="mt-2 divide-y divide-gray-200 dark:divide-gray-700">
        {students.map((s) => {
          const open = openId === s.childId;
          return (
            <li key={s.childId} className="py-1.5">
              <div className="flex items-center justify-between gap-2 text-sm">
                {s.items.length ? (
                  <button type="button" onClick={() => setOpenId(open ? "" : s.childId)} aria-expanded={open} className="flex items-center gap-2 text-left font-semibold text-blue-800 hover:underline dark:text-blue-200">
                    <span aria-hidden className={`text-xs transition ${open ? "rotate-90" : ""}`}>›</span>
                    {s.name}
                    <span className="text-xs font-normal text-gray-500">{s.items.length} entr{s.items.length === 1 ? "y" : "ies"}</span>
                  </button>
                ) : (
                  <span className="font-semibold text-gray-800 dark:text-gray-100">{s.name}</span>
                )}
                <span className="flex items-center gap-3">
                  {s.detail ? <span className="text-xs text-gray-500">{s.detail}</span> : null}
                  {s.childId ? (
                    <Link href={studentReportHref(role, s.childId)} className="text-xs font-semibold text-blue-700 hover:underline dark:text-blue-300">
                      Report
                    </Link>
                  ) : null}
                </span>
              </div>
              {open ? (
                <ul className="mt-1.5 space-y-1.5 pl-5">
                  {s.items.map((item) => (
                    <li key={item.id} className="rounded-lg bg-white px-3 py-2 text-sm text-gray-700 shadow-sm dark:bg-gray-900 dark:text-gray-200">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
                        <span>{shortDate(item.date)}</span>
                        {item.level ? <span className="rounded bg-rose-100 px-1.5 font-bold text-rose-700">Level {item.level}</span> : null}
                        {item.loggedBy ? <span>Logged by {item.loggedBy}</span> : null}
                      </div>
                      <div className="mt-0.5">{item.notes || "No description was logged."}</div>
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          );
        })}
        {!students.length ? <li className="py-2 text-sm text-gray-500">No students.</li> : null}
      </ul>
    </div>
  );
}
