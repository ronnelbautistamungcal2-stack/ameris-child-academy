import StaffLayout from "@/components/staff/StaffLayout";
import ComingSoon from "@/components/shell/ComingSoon";

const ROLES = ["HR_STAFF"];

export default function StaffAttendancePage() {
  return (
    <StaffLayout title="Staff Attendance Overview" roles={ROLES}>
      <ComingSoon title="Staff Attendance Overview" />
    </StaffLayout>
  );
}
