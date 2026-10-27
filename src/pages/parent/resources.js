import ParentLayout from "@/components/parent/ParentLayout";
import DocumentsPage from "@/components/documents/DocumentsPage";

export default function DocumentsRolePage() {
  return (
    <ParentLayout title="Additional Resources">
      <DocumentsPage category="RESOURCE" />
    </ParentLayout>
  );
}
