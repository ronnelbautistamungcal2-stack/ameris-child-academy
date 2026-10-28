import AdminLayout from "@/components/admin/AdminLayout";
import StudentProfile from "@/components/children/StudentProfile";
import { useRouter } from "next/router";

// Admin Student Profile: the teacher's page plus Edit Profile (client 07-03).
export default function AdminStudentProfile() {
  const router = useRouter();
  const id = typeof router.query.id === "string" ? router.query.id : "";
  return (
    <AdminLayout title="Student Profile">
      <StudentProfile childId={id} backHref="/admin/children" backLabel="Back to Children" hrefFor={(childId) => `/admin/children/${childId}`} />
    </AdminLayout>
  );
}
