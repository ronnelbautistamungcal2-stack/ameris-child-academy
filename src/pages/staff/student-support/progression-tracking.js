import StaffLayout from "@/components/staff/StaffLayout";
import ProgressionTracking from "@/components/sop/ProgressionTracking";

const ROLES = ["STUDENT_SUPPORT"];

// Student Support - same as the teacher's Progression Tracking.
export default function StudentSupportProgressionTrackingPage() {
  return (
    <StaffLayout title="Progression Tracking" roles={ROLES} contentMaxWidthClassName="max-w-[1440px]">
      <ProgressionTracking />
    </StaffLayout>
  );
}
