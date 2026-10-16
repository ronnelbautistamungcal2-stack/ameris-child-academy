import StaffLayout from "@/components/staff/StaffLayout";
import InfantFeedingPlanReport from "@/components/reports/InfantFeedingPlanReport";

const ROLES = ["KITCHEN_STAFF"];

export default function InfantFeedingPlanPage() {
  return (
    <StaffLayout title="Infant Feeding Plan" roles={ROLES}>
      <InfantFeedingPlanReport />
    </StaffLayout>
  );
}
