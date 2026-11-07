// Child enrollment status (Student List > Enrollment Status, client sheet
// 2026-11-07). Each entry is dated; the latest one decides whether the child
// is still enrolled, kept on Child.enrollmentEndDate so lists can filter on it.
// Shared by the browser and the server, so no imports.

export const ENROLLMENT_STATUSES = [
  { value: "ENROLLED", label: "Enrolled", active: true },
  { value: "RE_ENROLLED", label: "Re-Enrolled", active: true },
  { value: "ON_HOLD", label: "On Hold", active: false },
  { value: "WITHDRAWN", label: "Withdrawn", active: false },
  { value: "GRADUATED", label: "Graduated", active: false },
  { value: "OTHER", label: "Other", active: true },
];

export function isEnrollmentStatus(value) {
  return ENROLLMENT_STATUSES.some((s) => s.value === value);
}

export function enrollmentStatusLabel(value) {
  return ENROLLMENT_STATUSES.find((s) => s.value === value)?.label || value || "";
}

/** Whether a status keeps the child enrolled. */
export function isActiveEnrollment(value) {
  return ENROLLMENT_STATUSES.find((s) => s.value === value)?.active ?? true;
}

/** The latest entry (by date, then entry time), or null. */
export function latestEnrollmentEntry(entries = []) {
  const sorted = entries
    .slice()
    .sort((a, b) => new Date(a.date) - new Date(b.date) || new Date(a.createdAt || 0) - new Date(b.createdAt || 0));
  return sorted.length ? sorted[sorted.length - 1] : null;
}

/** Enrolled today: started (or no start date) and not ended before today. */
export function isEnrolledNow(child, today = new Date()) {
  const day = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const end = child?.enrollmentEndDate ? new Date(child.enrollmentEndDate) : null;
  return !end || end >= day;
}
