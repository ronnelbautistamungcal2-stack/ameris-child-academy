import CoachLayout from "@/components/coach/CoachLayout";
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

// Coach Dashboard (client mockups 03-Dashboards 12/13): children and staff
// present, red flags (level 3+ course corrections, allergies, IPPs), pending
// time off, new messages, the calendar and Classrooms at a Glance.
export default function CoachDashboard() {
  const { centers, centerId, setCenterId } = useDashboardCenters();
  const { data, error } = useDashboardSummary("coach", centerId);
  const unread = useUnreadMessages();
  const q = centerId ? `?centerId=${encodeURIComponent(centerId)}` : "";

  return (
    <CoachLayout title="Dashboard" shellMaxWidthClassName="max-w-[1760px]" contentMaxWidthClassName="max-w-[1440px]">
      <div className="space-y-5">
        <DashboardWelcome controls={<CenterSelect centers={centers} centerId={centerId} onChange={setCenterId} />} />
        {error ? <div role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <StatBubble kind="studentsPresent" icon={"\u{1F46A}"} value={data ? data.students.in : "…"} label="# Children Present" href={`/coach/students${q}`} />
          <StatBubble kind="staffPresent" icon={"\u{1F465}"} value={data ? data.staff.in : "…"} label="Staff Members Present" href={`/coach/staff-attendance${q}`} />
          <StatBubble kind="redFlags" icon={"\u{1F6A9}"} value={data ? data.redFlags : "…"} label="Red Flags" href={`/coach/students${q}`} />
          <StatBubble kind="timeOffPending" icon={"⏳"} value={data ? data.pendingTimeOff : "…"} label="Pending Time Off Requests" href={`/coach/time-off${q}`} addOn="STAFF_MANAGEMENT" />
          <StatBubble kind="messages" icon={"✉️"} value={unread} label="New Messages" href={`/coach/messages${q}`} />
        </div>
        {centerId ? (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.4fr_1fr]">
            <DashboardCalendar centerId={centerId} />
            <ClassroomsAtGlance rows={data?.classrooms || []} />
          </div>
        ) : null}
      </div>
    </CoachLayout>
  );
}
