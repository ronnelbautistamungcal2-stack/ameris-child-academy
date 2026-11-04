import AdminLayout from "@/components/admin/AdminLayout";
import StudentListWorkspace from "@/components/children/StudentListWorkspace";

export default function AdminChildren() {
  return <StudentListWorkspace Layout={AdminLayout} />;
}
