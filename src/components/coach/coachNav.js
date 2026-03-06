export const COACH_NAV_ITEMS = [
  { href: "/coach/dashboard", label: "Dashboard" },
  {
    label: "Oversight",
    children: [
      { href: "/coach/compliance", label: "Compliance" },
      { href: "/coach/checklists", label: "Checklists" },
      { href: "/coach/observations", label: "Observations" },
      { href: "/coach/follow-ups", label: "Follow-ups" },
    ],
  },
  {
    label: "Resources",
    children: [
      { href: "/coach/reports", label: "Reports" },
      { href: "/coach/policies", label: "Policies" },
    ],
  },
  { href: "/coach/messages", label: "Messages" },
  { href: "/settings", label: "Account Settings" },
];
