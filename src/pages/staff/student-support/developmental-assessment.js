import StaffLayout from "@/components/staff/StaffLayout";
import DevelopmentalAssessment from "@/components/sop/DevelopmentalAssessment";

const ROLES = ["STUDENT_SUPPORT"];

export default function DevelopmentalAssessmentPage() {
  return (
    <StaffLayout title="Initial Developmental Assessment" roles={ROLES} contentMaxWidthClassName="max-w-[1440px]">
      <DevelopmentalAssessment />
    </StaffLayout>
  );
}
