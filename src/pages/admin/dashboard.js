import AdminLayout from "@/components/admin/AdminLayout";
import {
  CenterSelect,
  ClassroomsAtGlance,
  DashboardCalendar,
  DashboardWelcome,
  StatBubble,
  useDashboardCenters,
  useDashboardSummary,
  useUnreadMessages,
} from "@/components/dashboard/RoleDashboard";

// Admin Dashboard (client mockups 03-Dashboards 14/15): students and staff
// signed in, red flags (overdue compliance alerts), new messages, the
// calendar and Classrooms at a Glance.
export default function AdminDashboard() {
  const { centers, centerId, setCenterId } = useDashboardCenters();
  const { data, error } = useDashboardSummary("admin", centerId);
  const unread = useUnreadMessages();
  const q = centerId ? `?centerId=${encodeURIComponent(centerId)}` : "";

  return (
    <AdminLayout title="Dashboard" shellMaxWidthClassName="max-w-[1760px]" contentMaxWidthClassName="max-w-[1440px]">
      <div className="space-y-5">
        <DashboardWelcome controls={<CenterSelect centers={centers} centerId={centerId} onChange={setCenterId} />} />
        {error ? <div role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatBubble kind="studentsPresent" icon={"\u{1F46A}"} value={data ? `${data.students.in} / ${data.students.total}` : "…"} label="Students Signed In" href={`/admin/children${q}`} />
          <StatBubble kind="staffPresent" icon={"\u{1F465}"} value={data ? `${data.staff.in} / ${data.staff.total}` : "…"} label="Staff Members Signed In" href={`/admin/users${q}`} addOn="STAFF_MANAGEMENT" />
          <StatBubble kind="redFlags" icon={"\u{1F6A9}"} value={data ? data.redFlags : "…"} label="Red Flags" href={`/admin/compliance-alerts${q}`} />
          <StatBubble kind="messages" icon={"✉️"} value={unread} label="New Messages" href={`/admin/messages${q}`} />
        </div>
        {centerId ? (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.4fr_1fr]">
            <DashboardCalendar centerId={centerId} />
            <ClassroomsAtGlance rows={data?.classrooms || []} viewAllHref={`/coach/classes${q}`} />
          </div>
        ) : null}
      </div>
    </AdminLayout>
  );
}
