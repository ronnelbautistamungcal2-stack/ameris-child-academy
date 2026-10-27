import { createContext, useContext } from "react";

// Reports "Select Filter" (client mockup 15-01): all children or only the ones
// currently enrolled, and all staff or only the ones currently employed. The
// reports hub provides it; a report opened on its own uses the defaults.

export const DEFAULT_REPORT_FILTERS = { children: "ENROLLED", staff: "EMPLOYED" };

export const ReportFiltersContext = createContext(DEFAULT_REPORT_FILTERS);

export function useReportFilters() {
  return useContext(ReportFiltersContext);
}

/** Enrolled today: no enrollment end date, or one that hasn't passed. */
export function isCurrentlyEnrolled(child, today = new Date()) {
  if (!child) return false;
  if (child.enrolled !== undefined) return Boolean(child.enrolled);
  if (!child.enrollmentEndDate) return true;
  const end = new Date(child.enrollmentEndDate);
  end.setHours(23, 59, 59, 999);
  return end >= today;
}
