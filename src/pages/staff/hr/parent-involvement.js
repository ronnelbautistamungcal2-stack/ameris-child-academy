import InvolvementWorkspace from "@/components/involvement/InvolvementWorkspace";
import StaffLayout from "@/components/staff/StaffLayout";

const ROLES = ["HR_STAFF"];

// HR: same as admin without Volunteer Tracking (client sheet 16, B75).
export default function ParentInvolvementPage() {
  return (
    <StaffLayout title="Parent Involvement" roles={ROLES}>
      <InvolvementWorkspace showTracking={false} />
    </StaffLayout>
  );
}
