// Employment Status (Staff List pop-up, client mockup 2026-10-02). Each entry
// is dated; the latest one is the person's status, copied onto
// User.employmentStatus so lists can filter on it. Staff who aren't
// "Currently Employed" drop off Staff Positions, shift schedules and
// attendance lists.

export const EMPLOYMENT_STATUSES = [
  { value: "CURRENTLY_EMPLOYED", label: "Currently Employed" },
  { value: "QUIT", label: "Quit" },
  { value: "FIRED", label: "Fired" },
  { value: "LAID_OFF", label: "Laid Off" },
  { value: "LEAVE_OF_ABSENCE", label: "Leave of Absence" },
  { value: "OTHER", label: "Other" },
];

export const CURRENTLY_EMPLOYED = "CURRENTLY_EMPLOYED";

/** Prisma `where` fragment for staff who are currently employed. */
export const EMPLOYED_WHERE = { employmentStatus: CURRENTLY_EMPLOYED };

export function isEmploymentStatus(value) {
  return EMPLOYMENT_STATUSES.some((s) => s.value === value);
}

export function employmentStatusLabel(value) {
  return EMPLOYMENT_STATUSES.find((s) => s.value === value)?.label || value || "";
}

/** The latest entry's status (by date, then entry time); employed when there are none. */
export function latestEmploymentStatus(entries = []) {
  const sorted = entries
    .slice()
    .sort((a, b) => new Date(a.date) - new Date(b.date) || new Date(a.createdAt || 0) - new Date(b.createdAt || 0));
  return sorted.length ? sorted[sorted.length - 1].status : CURRENTLY_EMPLOYED;
}
