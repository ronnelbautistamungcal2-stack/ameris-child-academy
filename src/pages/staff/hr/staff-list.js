import StaffLayout from "@/components/staff/StaffLayout";
import StaffTimeSheetList from "@/components/timesheets/StaffTimeSheetList";

const ROLES = ["HR_STAFF"];

export default function StaffListPage() {
  return (
    <StaffLayout title="Staff List" roles={ROLES}>
      <StaffTimeSheetList />
    </StaffLayout>
  );
}
