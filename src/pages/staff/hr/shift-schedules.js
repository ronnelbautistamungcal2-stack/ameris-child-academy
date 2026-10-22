import ShiftSchedulesWorkspace from "@/components/shifts/ShiftSchedulesWorkspace";
import StaffLayout from "@/components/staff/StaffLayout";

const ROLES = ["HR_STAFF"];

export default function HrShiftSchedulesPage() {
  return <ShiftSchedulesWorkspace Layout={StaffLayout} layoutProps={{ roles: ROLES }} />;
}
