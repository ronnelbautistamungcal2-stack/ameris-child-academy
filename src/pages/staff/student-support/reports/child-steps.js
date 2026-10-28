import { ChildStepsReport } from "@/components/reports/MilestoneReports";
import StaffLayout from "@/components/staff/StaffLayout";

const ROLES = ["STUDENT_SUPPORT"];

export default function StudentSupportReportPage() {
  return (
    <StaffLayout title="Child Steps of Progression Report" roles={ROLES} contentMaxWidthClassName="max-w-[1440px]">
      <ChildStepsReport />
    </StaffLayout>
  );
}
