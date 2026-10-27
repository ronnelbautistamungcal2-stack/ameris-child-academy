import ParentLayout from "@/components/parent/ParentLayout";
import MessagesWorkspace from "@/components/messages/MessagesWorkspace";

export default function ParentMessagesPage() {
  return (
    <ParentLayout title="Messages">
      <MessagesWorkspace variant="inbox" />
    </ParentLayout>
  );
}
