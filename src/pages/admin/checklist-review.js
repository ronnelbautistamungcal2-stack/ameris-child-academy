import AdminLayout from "@/components/admin/AdminLayout";
import ChecklistReview from "@/components/checklists/ChecklistReview";

export default function AdminChecklistReviewPage() {
  return <ChecklistReview Layout={AdminLayout} messagesPath="/admin/messages" />;
}
