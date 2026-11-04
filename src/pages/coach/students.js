import StudentListWorkspace from "@/components/children/StudentListWorkspace";
import CoachLayout from "@/components/coach/CoachLayout";

// Same Student List as the admin's; a name opens the Student Performance Report.
export default function CoachStudents() {
  return <StudentListWorkspace Layout={CoachLayout} profileHref={(id) => `/coach/student-performance?childId=${encodeURIComponent(id)}`} />;
}
