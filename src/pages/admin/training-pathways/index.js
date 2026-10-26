import AdminLayout from "@/components/admin/AdminLayout";
import StaffPDWorkspace from "@/components/training/StaffPDWorkspace";

export default function StaffProfessionalDevelopmentPage() {
  return (
    <AdminLayout title="Staff Professional Development">
      <StaffPDWorkspace detailHref={(id) => `/admin/training-pathways/${id}`} />
    </AdminLayout>
  );
}
