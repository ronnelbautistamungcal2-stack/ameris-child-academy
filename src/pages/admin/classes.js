import AdminLayout from "@/components/admin/AdminLayout";
import ClassroomListPage from "@/components/classes/ClassroomListPage";

// Same Classroom List as the coach's, under Program Setup (client sheet 2026-11-07).
export default function AdminClassroomList() {
  return <ClassroomListPage Layout={AdminLayout} />;
}
