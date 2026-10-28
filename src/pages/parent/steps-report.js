import { ChildStepsReport } from "@/components/reports/MilestoneReports";
import ParentLayout from "@/components/parent/ParentLayout";

export default function ParentStepsReport() {
  return (
    <ParentLayout title="Steps of Progression Report">
      <ChildStepsReport parent />
    </ParentLayout>
  );
}
