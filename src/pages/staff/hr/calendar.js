import CenterCalendar from "@/components/calendar/CenterCalendar";
import StaffLayout from "@/components/staff/StaffLayout";

const ROLES = ["HR_STAFF"];

function HrLayout(props) {
  return <StaffLayout {...props} roles={ROLES} />;
}

// HR sees the center calendar the admin keeps, read only.
export default function HrCalendar() {
  return <CenterCalendar Layout={HrLayout} />;
}
