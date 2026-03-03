export const ADMIN_NAV_ITEMS = [
  { href: "/admin/dashboard", label: "Dashboard" },
  {
    label: "People",
    children: [
      { href: "/admin/users", label: "Employee List" },
      { href: "/admin/teachers", label: "Teachers" },
      { href: "/admin/children", label: "Children List" },
      { href: "/admin/staff-management", label: "Staff Management" },
      { href: "/admin/data-import", label: "Data Import" },
    ],
  },
  {
    label: "Facilities",
    children: [
      { href: "/admin/centers", label: "Centers" },
      { href: "/admin/classes", label: "Classroom List" },
    ],
  },
  {
    label: "Curriculum & Progress",
    children: [
      { href: "/admin/lessons", label: "Curriculum List" },
      { href: "/admin/curriculum", label: "Curriculum Manager" },
      { href: "/admin/progress", label: "Progression Tracking" },
      { href: "/admin/checklists", label: "Checklists" },
      { href: "/admin/activity-overrides", label: "Activity Overrides" },
      { href: "/admin/supply-lists", label: "Supply Lists" },
      { href: "/admin/progress-archive", label: "Progress Archive" },
      { href: "/admin/data-archive", label: "Data Archive" },
    ],
  },
  {
    label: "Compliance & Reports",
    children: [
      { href: "/admin/teacher-logging-alerts", label: "Compliance Alerts" },
      { href: "/admin/form-renewals", label: "Form Renewals" },
      { href: "/admin/policies", label: "Policies & Procedures" },
      { href: "/admin/reports", label: "Reports" },
    ],
  },
  {
    label: "Calendar & Affiliates",
    children: [
      { href: "/admin/calendar", label: "Calendar" },
      { href: "/admin/shifts", label: "Shift Schedules" },
      { href: "/admin/affiliates", label: "Affiliates & Partners" },
    ],
  },
  { href: "/admin/messages", label: "Messages" },
];
