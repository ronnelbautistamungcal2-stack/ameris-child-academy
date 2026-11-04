// Where a student's name links to: that role's Student Performance Report
// (client requests 2026-10-29).

export function studentReportHref(role, childId) {
  const id = encodeURIComponent(childId);
  switch (String(role || "").toUpperCase()) {
    case "TEACHER":
      return `/teacher/student-performance-report?childId=${id}`;
    case "COACH":
      return `/coach/student-performance?childId=${id}`;
    case "STUDENT_SUPPORT":
      return `/staff/student-support/student-performance?childId=${id}`;
    case "PARENT":
      return `/parent/children?childId=${id}`;
    default:
      return `/admin/reports/students?childId=${id}`;
  }
}
