import DailyLogForm from "@/components/dailyLog/DailyLogForm";
import TeacherLayout from "@/components/teacher/TeacherLayout";
import useChecklistLinkVisit from "@/hooks/useChecklistLinkVisit";

export default function TeacherLogs() {
  useChecklistLinkVisit();
  return (
    <TeacherLayout title="Daily Log">
      <DailyLogForm />
    </TeacherLayout>
  );
}
