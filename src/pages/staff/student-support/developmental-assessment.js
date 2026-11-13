import StaffLayout from "@/components/staff/StaffLayout";
import DevelopmentalAssessment from "@/components/sop/DevelopmentalAssessment";
import ProtectedContent from "@/components/ui/ProtectedContent";

const ROLES = ["STUDENT_SUPPORT"];

export default function DevelopmentalAssessmentPage() {
  return (
    <StaffLayout title="Initial Developmental Assessment" roles={ROLES} contentMaxWidthClassName="max-w-[1440px]">
      {/* Can't be copied, printed or screenshotted (client sheet 10-29 (8), rows 4/12). */}
      <ProtectedContent label="Assessment">
        <DevelopmentalAssessment />
      </ProtectedContent>
    </StaffLayout>
  );
}
