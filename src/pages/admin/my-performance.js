import AdminLayout from "@/components/admin/AdminLayout";
import StaffPerformanceWorkspace from "@/components/staff/StaffPerformanceWorkspace";

export default function AdminMyPerformance() {
  return (
    <StaffPerformanceWorkspace
      Layout={AdminLayout}
      title="My Performance"
      description="Your own activity, attendance, evaluations, and training hours."
    />
  );
}
