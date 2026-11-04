import AdminLayout from "@/components/admin/AdminLayout";
import CenterCalendar from "@/components/calendar/CenterCalendar";

export default function AdminCalendar() {
  return <CenterCalendar Layout={AdminLayout} canManage eyebrow="Admin Calendar" />;
}
