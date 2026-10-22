import AdminLayout from "@/components/admin/AdminLayout";
import CenterPerformance from "@/components/reports/CenterPerformance";

export default function CenterPerformancePage() {
  return (
    <AdminLayout title="Center Performance Overview">
      <CenterPerformance />
    </AdminLayout>
  );
}
