import StaffLayout from "@/components/staff/StaffLayout";
import ComingSoon from "@/components/shell/ComingSoon";

const ROLES = ["HR_STAFF"];

export default function CalendarPage() {
  return (
    <StaffLayout title="Calendar" roles={ROLES}>
      <ComingSoon title="Calendar" />
    </StaffLayout>
  );
}
