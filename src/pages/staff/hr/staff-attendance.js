import StaffAttendanceOverview from "@/components/attendance/StaffAttendanceOverview";
import StaffLayout from "@/components/staff/StaffLayout";

const ROLES = ["HR_STAFF"];

export default function HrStaffAttendancePage() {
  return <StaffAttendanceOverview Layout={StaffLayout} layoutProps={{ roles: ROLES }} />;
}
