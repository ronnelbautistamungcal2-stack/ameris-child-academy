import AdminLayout from "@/components/admin/AdminLayout";
import AdminBillingWorkspace from "@/components/billing/AdminBillingWorkspace";

export default function AdminBilling() {
  return (
    <AdminLayout title="Billing">
      <AdminBillingWorkspace />
    </AdminLayout>
  );
}
