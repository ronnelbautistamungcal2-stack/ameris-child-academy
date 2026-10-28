import MessagesWorkspace from "@/components/messages/MessagesWorkspace";
import StaffLayout from "@/components/staff/StaffLayout";

// Other Staff, HR, Kitchen and Student Support: the parent Messages layout
// (client request 2026-10-02).
export default function StaffMessages() {
  return (
    <StaffLayout title="Messages">
      <MessagesWorkspace variant="inbox" />
    </StaffLayout>
  );
}
