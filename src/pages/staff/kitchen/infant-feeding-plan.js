import StaffLayout from "@/components/staff/StaffLayout";
import ComingSoon from "@/components/shell/ComingSoon";

const ROLES = ["KITCHEN_STAFF"];

export default function InfantFeedingPlanPage() {
  return (
    <StaffLayout title="Infant Feeding Plan" roles={ROLES}>
      <ComingSoon title="Infant Feeding Plan" />
    </StaffLayout>
  );
}
