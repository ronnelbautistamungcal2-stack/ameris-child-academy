import CoachLayout from "@/components/coach/CoachLayout";
import StaffMemberPerformance from "@/components/performance/StaffMemberPerformance";

export default function CoachStaffMemberPerformancePage() {
  return <StaffMemberPerformance Layout={CoachLayout} backHref="/coach/staff-performance" />;
}
