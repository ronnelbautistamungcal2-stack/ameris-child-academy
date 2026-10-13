import StaffLayout from "@/components/staff/StaffLayout";
import ComingSoon from "@/components/shell/ComingSoon";

const ROLES = ["STUDENT_SUPPORT"];

export default function DevelopmentalAssessmentPage() {
  return (
    <StaffLayout title="Initial Developmental Assessment" roles={ROLES}>
      <ComingSoon title="Initial Developmental Assessment" />
    </StaffLayout>
  );
}
