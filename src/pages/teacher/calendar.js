import TeacherCalendarPanel from "@/components/teacher/TeacherCalendarPanel";
import TeacherLayout from "@/components/teacher/TeacherLayout";

export default function TeacherCalendarPage() {
  return (
    <TeacherLayout title="Calendar">
      <div style={{ maxWidth: 1000, margin: "0 auto", padding: 16 }}>
        <TeacherCalendarPanel />
      </div>
    </TeacherLayout>
  );
}
