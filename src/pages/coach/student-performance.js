import CoachLayout from "@/components/coach/CoachLayout";
import StudentReportWorkspace from "@/components/reports/StudentReportWorkspace";

// Coach - Student Performance Report: the same report teachers see.
export default function StudentPerformancePage() {
  return (
    <CoachLayout title="Student Performance Report">
      <StudentReportWorkspace />
    </CoachLayout>
  );
}
