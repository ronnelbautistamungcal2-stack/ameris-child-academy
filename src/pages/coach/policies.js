import CoachLayout from "@/components/coach/CoachLayout";
import DocumentsPage from "@/components/documents/DocumentsPage";

export default function DocumentsRolePage() {
  return (
    <CoachLayout title="Policies & Procedures">
      <DocumentsPage category="POLICY" />
    </CoachLayout>
  );
}
