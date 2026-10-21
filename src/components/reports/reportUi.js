import { useCallback, useState } from "react";

// Pieces shared by the Student and Class Performance Reports.

export const NAVY = "text-[#0b2a5b] dark:text-blue-100";
export const card = "rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900";
export const dateInput = "mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800";

export function keyOf(date) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function shortDate(key) {
  const [y, m, d] = key.split("-").map(Number);
  return `${m}/${d}/${String(y).slice(2)}`;
}

/** A start/end date pair, defaulting to the last 30 days. */
export function useRange() {
  const [range, setRange] = useState(() => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 30);
    return { start: keyOf(start), end: keyOf(end) };
  });
  const inRange = useCallback((key) => key >= range.start && key <= range.end, [range]);
  return { range, setRange, inRange };
}

export function RangePicker({ range, setRange, label }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <label className={`text-sm font-bold ${NAVY}`}>
        Start Date
        <input type="date" value={range.start} max={range.end} onChange={(e) => e.target.value && setRange({ ...range, start: e.target.value })} aria-label={`${label} start date`} className={dateInput} />
      </label>
      <label className={`text-sm font-bold ${NAVY}`}>
        End Date
        <input type="date" value={range.end} min={range.start} onChange={(e) => e.target.value && setRange({ ...range, end: e.target.value })} aria-label={`${label} end date`} className={dateInput} />
      </label>
    </div>
  );
}

export function Heading({ icon, children }) {
  return (
    <h3 className={`mb-3 flex items-center gap-2 text-xl font-black ${NAVY}`}>
      <span aria-hidden className="text-2xl">{icon}</span>
      {children}
    </h3>
  );
}
