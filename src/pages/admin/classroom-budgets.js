import AdminLayout from "@/components/admin/AdminLayout";
import ClassroomBudgetsWorkspace from "@/components/budgets/ClassroomBudgetsWorkspace";

export default function ClassroomBudgets() {
  return (
    <AdminLayout title="Classroom Budgets">
      <ClassroomBudgetsWorkspace />
    </AdminLayout>
  );
}
