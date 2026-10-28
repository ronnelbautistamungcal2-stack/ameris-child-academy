import TeacherLayout from "@/components/teacher/TeacherLayout";
import EmployeeTimeOffPage from "@/components/timeoff/EmployeeTimeOffPage";

export default function TeacherTimeOff() {
  return (
    <EmployeeTimeOffPage
      LayoutComponent={TeacherLayout}
      title="My Time Off Request"
      description="Submit time-off requests and view your attendance summary."
      requestHelpText="Approvals are managed from Staff Management."
    />
  );
}
