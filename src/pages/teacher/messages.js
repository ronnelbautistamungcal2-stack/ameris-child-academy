import TeacherLayout from "@/components/teacher/TeacherLayout";
import MessageInbox from "@/components/messages/MessageInbox";

export default function TeacherMessages() {
  return (
    <TeacherLayout title="Messages">
      <MessageInbox embedded />
    </TeacherLayout>
  );
}
