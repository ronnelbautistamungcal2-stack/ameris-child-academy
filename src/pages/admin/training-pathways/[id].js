import AdminLayout from "@/components/admin/AdminLayout";
import PathwayDetail from "@/components/training/PathwayDetail";
import { useRouter } from "next/router";

export default function TrainingPathwayPage() {
  const router = useRouter();
  return (
    <AdminLayout title="Training Pathway">
      <PathwayDetail pathwayId={typeof router.query.id === "string" ? router.query.id : ""} backHref="/admin/training-pathways" />
    </AdminLayout>
  );
}
