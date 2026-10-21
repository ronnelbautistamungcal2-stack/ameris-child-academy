import StaffLayout from "@/components/staff/StaffLayout";
import StudentReportWorkspace from "@/components/reports/StudentReportWorkspace";

const ROLES = ["STUDENT_SUPPORT"];

// Student Support - Student Performance Report: the same report teachers see.
export default function StudentPerformancePage() {
  return (
    <StaffLayout title="Student Performance Report" roles={ROLES} contentMaxWidthClassName="max-w-[1440px]">
      <StudentReportWorkspace />
    </StaffLayout>
  );
}
