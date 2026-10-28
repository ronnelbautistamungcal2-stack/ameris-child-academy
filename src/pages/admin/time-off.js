import AdminLayout from "@/components/admin/AdminLayout";
import EmployeeTimeOffPage from "@/components/timeoff/EmployeeTimeOffPage";

export default function AdminTimeOff() {
  return (
    <EmployeeTimeOffPage
      LayoutComponent={AdminLayout}
      title="My Time Off Request"
      description="Submit time-off requests and view your attendance summary."
      requestHelpText="Approvals are managed from Staff Management."
    />
  );
}
