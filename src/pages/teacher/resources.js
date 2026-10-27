import TeacherLayout from "@/components/teacher/TeacherLayout";
import DocumentsPage from "@/components/documents/DocumentsPage";

export default function DocumentsRolePage() {
  return (
    <TeacherLayout title="Additional Resources">
      <DocumentsPage category="RESOURCE" />
    </TeacherLayout>
  );
}
