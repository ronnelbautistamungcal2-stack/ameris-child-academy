import AdminLayout from "@/components/admin/AdminLayout";
import MenuPlanner from "@/components/menus/MenuPlanner";

export default function AdminMenus() {
  return (
    <AdminLayout title="Menus" contentMaxWidthClassName="max-w-[1440px]">
      <MenuPlanner editable title="Menu Planner (Admin)" />
    </AdminLayout>
  );
}
