import CoachLayout from "@/components/coach/CoachLayout";
import StaffPDWorkspace from "@/components/training/StaffPDWorkspace";

export default function StaffProfessionalDevelopmentPage() {
  return (
    <CoachLayout title="Staff Professional Development">
      <StaffPDWorkspace detailHref={(id) => `/coach/professional-development/${id}`} />
    </CoachLayout>
  );
}
