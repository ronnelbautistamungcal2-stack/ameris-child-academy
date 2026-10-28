import DailyChecklistWorkspace from "@/components/checklists/DailyChecklistWorkspace";
import TeacherLayout from "@/components/teacher/TeacherLayout";

export default function TeacherChecklists() {
  return <DailyChecklistWorkspace Layout={TeacherLayout} mode="teacher" />;
}
