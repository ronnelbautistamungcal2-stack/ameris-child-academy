import StudentProfile from "@/components/children/StudentProfile";
import TeacherLayout from "@/components/teacher/TeacherLayout";
import { useRouter } from "next/router";

// Teacher Student Profile (client mockup 07-02): view only.
export default function TeacherStudentProfile() {
  const router = useRouter();
  const id = typeof router.query.id === "string" ? router.query.id : "";
  return (
    <TeacherLayout title="Student Profile">
      <StudentProfile childId={id} backHref="/teacher/classroom" backLabel="Back to My Classroom" hrefFor={(childId) => `/teacher/children/${childId}`} />
    </TeacherLayout>
  );
}
