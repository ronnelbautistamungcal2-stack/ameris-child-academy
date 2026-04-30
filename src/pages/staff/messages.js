import MessageInbox from "@/components/messages/MessageInbox";
import StaffLayout from "@/components/staff/StaffLayout";

export default function StaffMessages() {
  return (
    <StaffLayout title="Messages">
      <MessageInbox embedded />
    </StaffLayout>
  );
}
