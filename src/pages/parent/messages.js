import ParentLayout from "@/components/parent/ParentLayout";
import { ParentPageHeader } from "@/components/parent/ParentUI";
import MessageInbox from "@/components/messages/MessageInbox";

export default function ParentMessages() {
  return (
    <ParentLayout title="Messages">
      <div className="space-y-4">
        <ParentPageHeader
          eyebrow="Family communication"
          title="Message the center without losing context"
          description="Conversations, replies, unread items, and new threads all stay in one place so parents can move quickly."
          accent="sky"
          layout="split"
          stats={[
            { label: "Inbox", value: "Live", hint: "Real-time updates", tone: "emerald" },
            { label: "Reply flow", value: "Fast", hint: "No page switching needed", tone: "sky" },
            { label: "Contacts", value: "Shared", hint: "Teachers, admins, and staff", tone: "gray" },
            { label: "Use case", value: "Daily", hint: "Built for quick parent communication", tone: "amber" },
          ]}
        />
        <MessageInbox />
      </div>
    </ParentLayout>
  );
}
