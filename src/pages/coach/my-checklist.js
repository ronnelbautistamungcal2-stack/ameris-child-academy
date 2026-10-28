import CoachLayout from "@/components/coach/CoachLayout";
import DailyChecklistWorkspace from "@/components/checklists/DailyChecklistWorkspace";

export default function CoachMyChecklistPage() {
  return <DailyChecklistWorkspace Layout={CoachLayout} mode="personal" />;
}
