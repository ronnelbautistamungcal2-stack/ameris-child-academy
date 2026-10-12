import StaffLayout from "@/components/staff/StaffLayout";
import ComingSoon from "@/components/shell/ComingSoon";

const ROLES = ["HR_STAFF"];

export default function StaffPerformancePage() {
  return (
    <StaffLayout title="Staff Performance Overview" roles={ROLES}>
      <ComingSoon title="Staff Performance Overview" />
    </StaffLayout>
  );
}
