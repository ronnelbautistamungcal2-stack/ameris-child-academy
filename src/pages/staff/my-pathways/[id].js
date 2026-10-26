import StaffLayout from "@/components/staff/StaffLayout";
import LearnerPathway from "@/components/training/LearnerPathway";
import { useRouter } from "next/router";

export default function MyTrainingPathwayPage() {
  const router = useRouter();
  return (
    <StaffLayout title="Training Pathway">
      <LearnerPathway pathwayId={typeof router.query.id === "string" ? router.query.id : ""} backHref="/staff/performance?tab=professional-development" />
    </StaffLayout>
  );
}
