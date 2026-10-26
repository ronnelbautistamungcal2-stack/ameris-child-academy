import { otherPagesGroup } from "@/components/shell/navExtras";

const icons = {
  dashboard: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0">
      <path fillRule="evenodd" d="M9.293 2.293a1 1 0 011.414 0l7 7A1 1 0 0117 11h-1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-3a1 1 0 00-1-1H9a1 1 0 00-1 1v3a1 1 0 01-1 1H5a1 1 0 01-1-1v-6H3a1 1 0 01-.707-1.707l7-7z" clipRule="evenodd" />
    </svg>
  ),
  oversight: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0">
      <path d="M10 12.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" />
      <path fillRule="evenodd" d="M.664 10.59a1.651 1.651 0 010-1.186A10.004 10.004 0 0110 3c4.257 0 7.893 2.66 9.336 6.41.147.381.146.804 0 1.186A10.004 10.004 0 0110 17c-4.257 0-7.893-2.66-9.336-6.41zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
    </svg>
  ),
  staff: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0">
      <path d="M7 8a3 3 0 100-6 3 3 0 000 6zM14.5 9a2.5 2.5 0 100-5 2.5 2.5 0 000 5zM1.615 16.428a1.224 1.224 0 01-.569-1.175 6.002 6.002 0 0111.908 0c.058.467-.172.92-.57 1.174A9.953 9.953 0 017 17a9.953 9.953 0 01-5.385-1.572zM14.5 16h-.106c.07-.297.088-.611.048-.933a7.47 7.47 0 00-1.588-3.755 4.502 4.502 0 015.874 2.636.818.818 0 01-.36.98A7.465 7.465 0 0114.5 16z" />
    </svg>
  ),
  classroom: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0">
      <path fillRule="evenodd" d="M1 2.75A.75.75 0 011.75 2h10.5a.75.75 0 010 1.5H12v13.75a.75.75 0 01-.75.75h-1.5a.75.75 0 01-.75-.75v-2.5a.75.75 0 00-.75-.75h-2.5a.75.75 0 00-.75.75v2.5a.75.75 0 01-.75.75h-2.5a.75.75 0 010-1.5H2V3.5h-.25A.75.75 0 011 2.75zM4 5.5a.5.5 0 01.5-.5h1a.5.5 0 01.5.5v1a.5.5 0 01-.5.5h-1a.5.5 0 01-.5-.5v-1zM4.5 9a.5.5 0 00-.5.5v1a.5.5 0 00.5.5h1a.5.5 0 00.5-.5v-1a.5.5 0 00-.5-.5h-1zM8 5.5a.5.5 0 01.5-.5h1a.5.5 0 01.5.5v1a.5.5 0 01-.5.5h-1a.5.5 0 01-.5-.5v-1zM8.5 9a.5.5 0 00-.5.5v1a.5.5 0 00.5.5h1a.5.5 0 00.5-.5v-1a.5.5 0 00-.5-.5h-1zM14.25 6a.75.75 0 00-.75.75V17H18V6.75a.75.75 0 00-.75-.75h-3zM15 9.5a.5.5 0 01.5-.5h1a.5.5 0 01.5.5v1a.5.5 0 01-.5.5h-1a.5.5 0 01-.5-.5v-1zm.5 3.5a.5.5 0 00-.5.5v1a.5.5 0 00.5.5h1a.5.5 0 00.5-.5v-1a.5.5 0 00-.5-.5h-1z" clipRule="evenodd" />
    </svg>
  ),
  resources: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0">
      <path d="M10.75 16.82A7.462 7.462 0 0115 15.5c.71 0 1.396.098 2.046.282A.75.75 0 0018 15.06v-11a.75.75 0 00-.546-.721A9.006 9.006 0 0015 3a8.963 8.963 0 00-4.25 1.065V16.82zM9.25 4.065A8.963 8.963 0 005 3c-.85 0-1.673.118-2.454.339A.75.75 0 002 4.06v11a.75.75 0 00.954.721A7.506 7.506 0 015 15.5c1.579 0 3.042.487 4.25 1.32V4.065z" />
    </svg>
  ),
  messages: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0">
      <path fillRule="evenodd" d="M10 2c-2.236 0-4.43.18-6.57.524C1.993 2.755 1 4.014 1 5.426v5.148c0 1.413.993 2.67 2.43 2.902.848.137 1.705.248 2.57.331v3.443a.75.75 0 001.28.53l3.58-3.579a.78.78 0 01.527-.224 41.202 41.202 0 005.183-.5c1.437-.232 2.43-1.49 2.43-2.903V5.426c0-1.413-.993-2.67-2.43-2.902A41.289 41.289 0 0010 2zm0 7a1 1 0 100-2 1 1 0 000 2zM8 8a1 1 0 11-2 0 1 1 0 012 0zm5 1a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
    </svg>
  ),
};

const extraIcons = {
  performance: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0">
      <path d="M15.5 2A1.5 1.5 0 0014 3.5v13a1.5 1.5 0 003 0v-13A1.5 1.5 0 0015.5 2zM10 6.5A1.5 1.5 0 008.5 8v8.5a1.5 1.5 0 003 0V8A1.5 1.5 0 0010 6.5zM4.5 11A1.5 1.5 0 003 12.5v4a1.5 1.5 0 003 0v-4A1.5 1.5 0 004.5 11z" />
    </svg>
  ),
  students: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0">
      <path d="M10 9a3 3 0 100-6 3 3 0 000 6zM6 8a2 2 0 11-4 0 2 2 0 014 0zM1.49 15.326a.78.78 0 01-.358-.442 3 3 0 014.308-3.516 6.484 6.484 0 00-1.905 3.959c-.023.222-.014.442.025.654a4.97 4.97 0 01-2.07-.655zM16.44 15.98a4.97 4.97 0 002.07-.654.78.78 0 00.357-.442 3 3 0 00-4.308-3.517 6.484 6.484 0 011.907 3.96 2.32 2.32 0 01-.026.654zM18 8a2 2 0 11-4 0 2 2 0 014 0zM5.304 16.19a.844.844 0 01-.277-.71 5 5 0 019.947 0 .843.843 0 01-.277.71A6.975 6.975 0 0110 18a6.974 6.974 0 01-4.696-1.81z" />
    </svg>
  ),
  reports: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0">
      <path fillRule="evenodd" d="M4.5 2A1.5 1.5 0 003 3.5v13A1.5 1.5 0 004.5 18h11a1.5 1.5 0 001.5-1.5V7.621a1.5 1.5 0 00-.44-1.06l-4.12-4.122A1.5 1.5 0 0011.378 2H4.5zm2.25 8.5a.75.75 0 000 1.5h6.5a.75.75 0 000-1.5h-6.5zm0 3a.75.75 0 000 1.5h6.5a.75.75 0 000-1.5h-6.5z" clipRule="evenodd" />
    </svg>
  ),
  calendar: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0">
      <path fillRule="evenodd" d="M5.75 2a.75.75 0 01.75.75V4h7V2.75a.75.75 0 011.5 0V4h.25A2.75 2.75 0 0118 6.75v8.5A2.75 2.75 0 0115.25 18H4.75A2.75 2.75 0 012 15.25v-8.5A2.75 2.75 0 014.75 4H5V2.75A.75.75 0 015.75 2zm-1 5.5c-.69 0-1.25.56-1.25 1.25v6.5c0 .69.56 1.25 1.25 1.25h10.5c.69 0 1.25-.56 1.25-1.25v-6.5c0-.69-.56-1.25-1.25-1.25H4.75z" clipRule="evenodd" />
    </svg>
  ),
};

// Follows the client's Coach Navigation list (2026-10-02 requests).
export const COACH_NAV_ITEMS = [
  {
    href: "/coach/dashboard",
    label: "Dashboard",
    icon: icons.dashboard,
  },
  {
    label: "My Performance",
    icon: extraIcons.performance,
    children: [
      { href: "/coach/my-checklist", label: "Checklist" },
      { href: "/coach/my-performance", label: "Performance" },
      { href: "/coach/my-time-off", label: "My Time Off" },
    ],
  },
  {
    label: "Staff Management",
    icon: icons.staff,
    children: [
      { href: "/coach/staff-management", label: "Staff Daily Management" },
      { href: "/coach/checklist-review", label: "Checklist Review" },
      { href: "/coach/staff-attendance", label: "Attendance" },
      { href: "/coach/shifts", label: "Shift Schedules" },
        { href: "/coach/time-off", label: "Time Off" },
      { href: "/coach/evaluations", label: "Evaluations" },
      { href: "/coach/staff-performance", label: "Staff Performance" },
      { href: "/coach/training", label: "Staff Training" },
      { href: "/coach/professional-development", label: "Staff Professional Development" },
      { href: "/coach/teachers", label: "Staff Positions" },
    ],
  },
  {
    label: "Classroom Management",
    icon: icons.classroom,
    children: [
      { href: "/coach/classes", label: "Classroom List" },
      { href: "/coach/checklist-manager", label: "Checklist Manager" },
      { href: "/coach/supply-lists", label: "Supply Lists" },
      { href: "/coach/classroom-budgets", label: "Classroom Budgets" },
      { href: "/coach/class-performance", label: "Classroom Performance Report" },
    ],
  },
  {
    label: "Student Management",
    icon: extraIcons.students,
    children: [
      { href: "/coach/students", label: "Student List" },
      { href: "/coach/progress", label: "Progression Tracking" },
      { href: "/coach/activity-overrides", label: "Daily Log" },
      { href: "/coach/parent-fees", label: "Parent Fees" },
      { href: "/coach/student-performance", label: "Student Performance Report" },
    ],
  },
  {
    href: "/coach/reports",
    label: "Reports",
    icon: extraIcons.reports,
  },
  {
    label: "Resources",
    icon: icons.resources,
    children: [
      { href: "/coach/policies", label: "Policies & Procedures" },
      { href: "/coach/resources", label: "Additional Resources" },
    ],
  },
  {
    href: "/coach/calendar",
    label: "Calendar",
    icon: extraIcons.calendar,
  },
  {
    href: "/coach/messages",
    label: "Messages",
    icon: icons.messages,
  },
  otherPagesGroup([
    { href: "/coach/compliance", label: "Compliance" },
    { href: "/coach/observations", label: "Observations" },
    { href: "/coach/follow-ups", label: "Follow-ups" },
    { href: "/coach/permission-policies", label: "Family Permission Policies" },
    // Move into Reports.
    { href: "/coach/carpool-report", label: "Carpool Report" },
  ]),
];
