import StaffLayout from "@/components/staff/StaffLayout";
import ComingSoon from "@/components/shell/ComingSoon";

const ROLES = ["STUDENT_SUPPORT"];

export default function StudentPerformancePage() {
  return (
    <StaffLayout title="Student Performance Report" roles={ROLES}>
      <ComingSoon title="Student Performance Report" />
    </StaffLayout>
  );
}
