import CoachLayout from "@/components/coach/CoachLayout";
import LearnerPathway from "@/components/training/LearnerPathway";
import { useRouter } from "next/router";

export default function MyTrainingPathwayPage() {
  const router = useRouter();
  return (
    <CoachLayout title="Training Pathway">
      <LearnerPathway pathwayId={typeof router.query.id === "string" ? router.query.id : ""} backHref="/coach/my-performance?tab=professional-development" />
    </CoachLayout>
  );
}
