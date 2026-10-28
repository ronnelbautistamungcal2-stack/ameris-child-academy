import AdminLayout from "@/components/admin/AdminLayout";
import DocumentsPage from "@/components/documents/DocumentsPage";

export default function DocumentsRolePage() {
  return (
    <AdminLayout title="Additional Resources">
      <DocumentsPage category="RESOURCE" />
    </AdminLayout>
  );
}
