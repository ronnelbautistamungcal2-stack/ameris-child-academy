import StaffLayout from "@/components/staff/StaffLayout";
import EmployeeTimeOffPage from "@/components/timeoff/EmployeeTimeOffPage";

export default function StaffTimeOff() {
  return (
    <EmployeeTimeOffPage
      LayoutComponent={StaffLayout}
      title="My Time Off Request"
      description="Submit time-off requests and view your attendance summary."
      requestHelpText="Approvals are managed from Staff Management."
    />
  );
}
