import CoachLayout from "@/components/coach/CoachLayout";
import MessageInbox from "@/components/messages/MessageInbox";

export default function CoachMessages() {
  return (
    <CoachLayout title="Messages">
      <MessageInbox />
    </CoachLayout>
  );
}
