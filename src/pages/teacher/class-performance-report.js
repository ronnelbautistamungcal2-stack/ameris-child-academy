import ClassReportWorkspace from "@/components/reports/ClassReportWorkspace";
import TeacherLayout from "@/components/teacher/TeacherLayout";

export default function TeacherClassPerformanceReportPage() {
  return (
    <TeacherLayout title="Class Performance Report">
      <ClassReportWorkspace />
    </TeacherLayout>
  );
}
