export const TEACHER_NAV_ITEMS = [
  { href: "/teacher/dashboard", label: "Dashboard" },
  {
    label: "Classroom",
    children: [
      { href: "/teacher/classroom", label: "My Classroom" },
      { href: "/teacher/logs", label: "Log Activity" },
      { href: "/teacher/messages", label: "Messages" },
      { href: "/teacher/alerts", label: "Alerts" },
    ],
  },
  {
    label: "Child Progress",
    children: [
      { href: "/teacher/progress", label: "Progression Tracking" },
      { href: "/teacher/children", label: "Children" },
    ],
  },
  {
    label: "Planning",
    children: [
      { href: "/teacher/checklists", label: "Checklists" },
      { href: "/teacher/calendar", label: "Calendar" },
    ],
  },
  {
    label: "Performance & Training",
    children: [
      { href: "/teacher/training", label: "My Performance & Training" },
      { href: "/teacher/time-off", label: "Time Off Request" },
    ],
  },
  {
    label: "Resources",
    children: [
      { href: "/teacher/policies", label: "Policies & Procedures" },
      { href: "/teacher/reports", label: "Reports" },
    ],
  },
];
