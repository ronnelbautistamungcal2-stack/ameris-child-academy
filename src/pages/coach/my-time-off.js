import CoachLayout from "@/components/coach/CoachLayout";
import EmployeeTimeOffPage from "@/components/timeoff/EmployeeTimeOffPage";

export default function CoachMyTimeOff() {
  return (
    <EmployeeTimeOffPage
      LayoutComponent={CoachLayout}
      title="My Time Off Request"
      description="Submit time-off requests and view your attendance summary."
      requestHelpText="Approvals are managed from Staff Management."
    />
  );
}
