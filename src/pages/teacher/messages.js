import MessagesWorkspace from "@/components/messages/MessagesWorkspace";
import TeacherLayout from "@/components/teacher/TeacherLayout";

// Same layout as the parent Messages page (client request 2026-10-02).
export default function TeacherMessages() {
  return (
    <TeacherLayout title="Messages">
      <MessagesWorkspace variant="inbox" />
    </TeacherLayout>
  );
}
