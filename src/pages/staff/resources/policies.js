import StaffLayout from "@/components/staff/StaffLayout";
import DocumentsPage from "@/components/documents/DocumentsPage";

export default function DocumentsRolePage() {
  return (
    <StaffLayout title="Policies & Procedures">
      <DocumentsPage category="POLICY" />
    </StaffLayout>
  );
}
