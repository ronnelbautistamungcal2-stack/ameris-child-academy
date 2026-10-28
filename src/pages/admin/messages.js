import AdminLayout from "@/components/admin/AdminLayout";
import MessagesWorkspace from "@/components/messages/MessagesWorkspace";

// Admin Messages: same as the coach page (client request 2026-10-02).
export default function AdminMessages() {
  return (
    <AdminLayout title="Messages">
      <MessagesWorkspace variant="workflow" />
    </AdminLayout>
  );
}
