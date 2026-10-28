import CoachLayout from "@/components/coach/CoachLayout";
import StaffPerformanceOverview from "@/components/performance/StaffPerformanceOverview";

export default function CoachStaffPerformancePage() {
  return <StaffPerformanceOverview Layout={CoachLayout} basePath="/coach/staff-performance" />;
}
