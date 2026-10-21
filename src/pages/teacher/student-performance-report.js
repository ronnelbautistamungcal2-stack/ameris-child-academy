import StudentReportWorkspace from "@/components/reports/StudentReportWorkspace";
import TeacherLayout from "@/components/teacher/TeacherLayout";

export default function TeacherStudentPerformanceReportPage() {
  return (
    <TeacherLayout title="Student Performance Report">
      <StudentReportWorkspace profileHref={(id) => `/teacher/children/${id}`} />
    </TeacherLayout>
  );
}
