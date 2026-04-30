import StaffLayout from "@/components/staff/StaffLayout";
import EmployeeTimeOffPage from "@/components/timeoff/EmployeeTimeOffPage";

export default function StaffTimeOff() {
  return (
    <EmployeeTimeOffPage
      LayoutComponent={StaffLayout}
      title="Time Off"
      description="Submit and track your own time-off requests from the staff portal."
      requestHelpText="Approvals are managed by administrators from Staff Management."
    />
  );
}
