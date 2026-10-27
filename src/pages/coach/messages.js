import CoachLayout from "@/components/coach/CoachLayout";
import MessagesWorkspace from "@/components/messages/MessagesWorkspace";

// Coach Messages (client mockup 13-02): messages, open points and requests.
export default function CoachMessages() {
  return (
    <CoachLayout title="Messages">
      <MessagesWorkspace variant="workflow" />
    </CoachLayout>
  );
}
