export const ADMIN_NAV_ITEMS = [
  { href: "/admin/dashboard", label: "Dashboard" },
  {
    label: "People",
    children: [
      { href: "/admin/users", label: "Employee List" },
      { href: "/admin/teachers", label: "Teachers" },
      { href: "/admin/children", label: "Children List" },
      { href: "/admin/staff-management", label: "Staff Management" },
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
      { href: "/admin/progress-archive", label: "Progress Archive" },
    ],
  },
  {
    label: "Compliance & Reports",
    children: [
      { href: "/admin/teacher-logging-alerts", label: "Compliance Alerts" },
      { href: "/admin/reports", label: "Reports" },
    ],
  },
  { href: "/admin/messages", label: "Messages" },
];
