import AdminLayout from "@/components/admin/AdminLayout";
import DailyChecklistWorkspace from "@/components/checklists/DailyChecklistWorkspace";

export default function AdminMyChecklist() {
  return <DailyChecklistWorkspace Layout={AdminLayout} mode="personal" />;
}
