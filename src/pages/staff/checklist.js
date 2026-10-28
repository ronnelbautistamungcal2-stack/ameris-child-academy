import DailyChecklistWorkspace from "@/components/checklists/DailyChecklistWorkspace";
import StaffLayout from "@/components/staff/StaffLayout";

export default function StaffChecklistPage() {
  return <DailyChecklistWorkspace Layout={StaffLayout} mode="staff" />;
}
