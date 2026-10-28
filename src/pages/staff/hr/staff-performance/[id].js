import StaffMemberPerformance from "@/components/performance/StaffMemberPerformance";
import StaffLayout from "@/components/staff/StaffLayout";

const ROLES = ["HR_STAFF"];

export default function HrStaffMemberPerformancePage() {
  return <StaffMemberPerformance Layout={StaffLayout} layoutProps={{ roles: ROLES }} backHref="/staff/hr/staff-performance" />;
}
