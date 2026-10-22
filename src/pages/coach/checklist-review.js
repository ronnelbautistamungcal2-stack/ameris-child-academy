import ChecklistReview from "@/components/checklists/ChecklistReview";
import CoachLayout from "@/components/coach/CoachLayout";

export default function CoachChecklistReviewPage() {
  return <ChecklistReview Layout={CoachLayout} messagesPath="/coach/messages" />;
}
