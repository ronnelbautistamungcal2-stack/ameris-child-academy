import StaffLayout from "@/components/staff/StaffLayout";
import ComingSoon from "@/components/shell/ComingSoon";

const ROLES = ["HR_STAFF"];

export default function ParentInvolvementPage() {
  return (
    <StaffLayout title="Parent Involvement" roles={ROLES}>
      <ComingSoon title="Parent Involvement" />
    </StaffLayout>
  );
}
