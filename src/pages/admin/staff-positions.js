import AdminLayout from "@/components/admin/AdminLayout";
import StaffPositionsPage from "@/components/staff/StaffPositionsPage";

// Same page as the coach's, plus Coaching Team (client request 2026-10-29).
export default function AdminStaffPositions() {
  return <StaffPositionsPage Layout={AdminLayout} showTeam />;
}
