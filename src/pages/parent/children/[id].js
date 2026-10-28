import ParentLayout from "@/components/parent/ParentLayout";
import StudentProfile from "@/components/children/StudentProfile";
import { useRouter } from "next/router";

export default function ParentChildProfile() {
  const router = useRouter();
  const id = typeof router.query.id === "string" ? router.query.id : "";
  return (
    <ParentLayout title="Child Profile">
      <StudentProfile childId={id} title="Child Profile" backHref="/parent/children" backLabel="Back to Children" hrefFor={(childId) => `/parent/children/${childId}`} />
    </ParentLayout>
  );
}
