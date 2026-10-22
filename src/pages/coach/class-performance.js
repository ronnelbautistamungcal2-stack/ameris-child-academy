import CoachLayout from "@/components/coach/CoachLayout";
import ClassReportWorkspace from "@/components/reports/ClassReportWorkspace";

// Coach - Class Performance Report: click a class name to open its report.
export default function ClassPerformancePage() {
  return (
    <CoachLayout title="Class Performance Report">
      <ClassReportWorkspace />
    </CoachLayout>
  );
}
