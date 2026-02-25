export const COACH_NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard" },
  {
    label: "Oversight",
    children: [
      { href: "/coach/compliance", label: "Compliance" },
      { href: "/coach/checklists", label: "Follow-ups" },
      { href: "/coach/training", label: "Training" },
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
