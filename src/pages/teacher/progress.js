import TeacherLayout from "@/components/teacher/TeacherLayout";
import ProgressionTracking from "@/components/sop/ProgressionTracking";

export default function TeacherProgress() {
  return (
    <TeacherLayout title="Progression Tracking">
      <ProgressionTracking profileHref={(id) => `/teacher/children/${id}`} />
    </TeacherLayout>
  );
}
