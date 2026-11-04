import CenterCalendar from "@/components/calendar/CenterCalendar";
import CoachLayout from "@/components/coach/CoachLayout";

// Same view as the admin calendar (client request 2026-10-29), read only.
export default function CoachCalendar() {
  return <CenterCalendar Layout={CoachLayout} />;
}
