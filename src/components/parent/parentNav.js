export const PARENT_NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard" },
  {
    label: "My Family",
    children: [
      { href: "/parent/children", label: "My Children" },
      { href: "/parent/progress", label: "Progress & Goals" },
      { href: "/parent/permissions", label: "Permissions" },
    ],
  },
  {
    label: "Account",
    children: [
      { href: "/parent/forms", label: "Enrollment Docs" },
      { href: "/parent/billing", label: "Billing" },
      { href: "/parent/notification-settings", label: "Notification Settings" },
      { href: "/settings", label: "Account Settings" },
    ],
  },
  { href: "/parent/messages", label: "Messages" },
  { href: "/parent/policies", label: "Policies" },
];
