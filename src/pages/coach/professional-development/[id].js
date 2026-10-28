import CoachLayout from "@/components/coach/CoachLayout";
import PathwayDetail from "@/components/training/PathwayDetail";
import { useRouter } from "next/router";

export default function TrainingPathwayPage() {
  const router = useRouter();
  return (
    <CoachLayout title="Training Pathway">
      <PathwayDetail pathwayId={typeof router.query.id === "string" ? router.query.id : ""} backHref="/coach/professional-development" />
    </CoachLayout>
  );
}
