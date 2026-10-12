import StaffLayout from "@/components/staff/StaffLayout";
import ComingSoon from "@/components/shell/ComingSoon";

const ROLES = ["HR_STAFF"];

export default function StaffListPage() {
  return (
    <StaffLayout title="Staff List" roles={ROLES}>
      <ComingSoon title="Staff List" />
    </StaffLayout>
  );
}
