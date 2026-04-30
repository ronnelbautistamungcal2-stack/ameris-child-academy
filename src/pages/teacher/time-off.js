import TeacherLayout from "@/components/teacher/TeacherLayout";
import EmployeeTimeOffPage from "@/components/timeoff/EmployeeTimeOffPage";

export default function TeacherTimeOff() {
  return (
    <EmployeeTimeOffPage
      LayoutComponent={TeacherLayout}
      title="Time Off Request"
      description="Submit PTO requests here and keep your attendance summary in view."
      requestHelpText="Approvals are managed from the admin portal under Staff Management."
    />
  );
}
