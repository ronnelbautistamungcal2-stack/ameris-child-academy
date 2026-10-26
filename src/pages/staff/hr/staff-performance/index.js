import StaffPerformanceOverview from "@/components/performance/StaffPerformanceOverview";
import StaffLayout from "@/components/staff/StaffLayout";

const ROLES = ["HR_STAFF"];

export default function HrStaffPerformancePage() {
  return <StaffPerformanceOverview Layout={StaffLayout} layoutProps={{ roles: ROLES }} basePath="/staff/hr/staff-performance" />;
}
