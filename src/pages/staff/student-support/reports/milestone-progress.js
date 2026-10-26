import { MilestoneProgressReport } from "@/components/reports/MilestoneReports";
import StaffLayout from "@/components/staff/StaffLayout";

const ROLES = ["STUDENT_SUPPORT"];

export default function StudentSupportReportPage() {
  return (
    <StaffLayout title="Milestone Progress Report" roles={ROLES} contentMaxWidthClassName="max-w-[1440px]">
      <MilestoneProgressReport />
    </StaffLayout>
  );
}
