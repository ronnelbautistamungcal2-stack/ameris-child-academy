import StaffLayout from "@/components/staff/StaffLayout";
import ComingSoon from "@/components/shell/ComingSoon";

const ROLES = ["STUDENT_SUPPORT"];

export default function ProgressPlansPage() {
  return (
    <StaffLayout title="Individual Progress Plans" roles={ROLES}>
      <ComingSoon title="Individual Progress Plans" />
    </StaffLayout>
  );
}
