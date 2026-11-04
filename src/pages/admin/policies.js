import AdminLayout from "@/components/admin/AdminLayout";
import DocumentsPage from "@/components/documents/DocumentsPage";

// Admin Policies & Procedures (client mockups 39-02 and 39-03). The parent FAQ
// panel was removed (client request 2026-10-29).
export default function AdminPolicies() {
  return (
    <AdminLayout title="Policies & Procedures">
      <DocumentsPage category="POLICY" />
    </AdminLayout>
  );
}
