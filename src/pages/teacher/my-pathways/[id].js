import TeacherLayout from "@/components/teacher/TeacherLayout";
import LearnerPathway from "@/components/training/LearnerPathway";
import { useRouter } from "next/router";

export default function MyTrainingPathwayPage() {
  const router = useRouter();
  return (
    <TeacherLayout title="Training Pathway">
      <LearnerPathway pathwayId={typeof router.query.id === "string" ? router.query.id : ""} backHref="/teacher/training?tab=professional-development" />
    </TeacherLayout>
  );
}
