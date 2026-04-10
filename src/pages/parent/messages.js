import ParentLayout from "@/components/parent/ParentLayout";
import MessageInbox from "@/components/messages/MessageInbox";

export default function ParentMessages() {
  return (
    <ParentLayout title="Messages">
      <MessageInbox embedded />
    </ParentLayout>
  );
}
