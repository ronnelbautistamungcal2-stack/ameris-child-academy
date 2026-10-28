import AdminLayout from "@/components/admin/AdminLayout";
import LearnerPathway from "@/components/training/LearnerPathway";
import { useRouter } from "next/router";

export default function MyTrainingPathwayPage() {
  const router = useRouter();
  return (
    <AdminLayout title="Training Pathway">
      <LearnerPathway pathwayId={typeof router.query.id === "string" ? router.query.id : ""} backHref="/admin/my-performance?tab=professional-development" />
    </AdminLayout>
  );
}
