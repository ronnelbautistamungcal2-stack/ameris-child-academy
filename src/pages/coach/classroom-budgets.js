import ClassroomBudgetsWorkspace from "@/components/budgets/ClassroomBudgetsWorkspace";
import CoachLayout from "@/components/coach/CoachLayout";

export default function ClassroomBudgetsPage() {
  return (
    <CoachLayout title="Classroom Budgets">
      <ClassroomBudgetsWorkspace />
    </CoachLayout>
  );
}
