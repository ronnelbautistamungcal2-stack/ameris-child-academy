import CoachLayout from "@/components/coach/CoachLayout";
import DocumentsPage from "@/components/documents/DocumentsPage";

export default function DocumentsRolePage() {
  return (
    <CoachLayout title="Additional Resources">
      <DocumentsPage category="RESOURCE" />
    </CoachLayout>
  );
}
