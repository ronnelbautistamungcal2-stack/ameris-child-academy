import StaffLayout from "@/components/staff/StaffLayout";
import ComingSoon from "@/components/shell/ComingSoon";

const ROLES = ["HR_STAFF"];

export default function ShiftSchedulesPage() {
  return (
    <StaffLayout title="Shift Schedules" roles={ROLES}>
      <ComingSoon title="Shift Schedules" />
    </StaffLayout>
  );
}
