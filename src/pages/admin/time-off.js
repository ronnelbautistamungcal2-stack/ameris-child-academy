import AdminLayout from "@/components/admin/AdminLayout";
import EmployeeTimeOffPage from "@/components/timeoff/EmployeeTimeOffPage";

export default function AdminTimeOff() {
  return (
    <EmployeeTimeOffPage
      LayoutComponent={AdminLayout}
      title="My Time Off"
      description="Submit and track your own time-off requests without leaving the admin workspace."
      requestHelpText="Administrative approvals for all staff still live in Staff Management."
    />
  );
}
