import AdminLayout from "@/components/admin/AdminLayout";
import StaffTimeSheetList from "@/components/timesheets/StaffTimeSheetList";

export default function StaffListPage() {
  return (
    <AdminLayout title="Staff List">
      <StaffTimeSheetList />
    </AdminLayout>
  );
}
