const iconClass = "h-5 w-5 shrink-0";

export const PARENT_NAV_ITEMS = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} className={iconClass}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 10.5 12 3l9 7.5" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 9.75V20a1 1 0 0 0 1 1H9.5v-5.25h5V21h3.25a1 1 0 0 0 1-1V9.75" />
      </svg>
    ),
  },
  {
    label: "Family Hub",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} className={iconClass}>
        <circle cx="9" cy="8" r="3.25" />
        <circle cx="17" cy="9.5" r="2.4" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 19a6 6 0 0 1 12 0" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 14.5A4.5 4.5 0 0 1 21 19" />
      </svg>
    ),
    children: [
      { href: "/parent/children", label: "My Children" },
      { href: "/parent/forms", label: "Forms & Renewals" },
      { href: "/parent/billing", label: "Billing" },
      { href: "/parent/involvement", label: "Parent Involvement" },
    ],
  },
  {
    href: "/parent/policies",
    label: "Policies and Procedures",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} className={iconClass}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M14 3H7a1.5 1.5 0 0 0-1.5 1.5v15A1.5 1.5 0 0 0 7 21h10a1.5 1.5 0 0 0 1.5-1.5V7.5z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M14 3v4.5h4.5M8.75 12.5h6.5M8.75 16h4.5" />
      </svg>
    ),
  },
  {
    href: "/settings",
    label: "Account Settings",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} className={iconClass}>
        <circle cx="12" cy="12" r="3.1" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.4 14.2a1.6 1.6 0 0 0 .32 1.77l.06.06a1.9 1.9 0 1 1-2.69 2.69l-.06-.06a1.6 1.6 0 0 0-1.77-.32 1.6 1.6 0 0 0-.97 1.47V20a1.9 1.9 0 1 1-3.8 0v-.1a1.6 1.6 0 0 0-1.05-1.46 1.6 1.6 0 0 0-1.77.32l-.06.06a1.9 1.9 0 1 1-2.69-2.69l.06-.06a1.6 1.6 0 0 0 .32-1.77 1.6 1.6 0 0 0-1.47-.97H4a1.9 1.9 0 1 1 0-3.8h.1a1.6 1.6 0 0 0 1.46-1.05 1.6 1.6 0 0 0-.32-1.77l-.06-.06a1.9 1.9 0 1 1 2.69-2.69l.06.06a1.6 1.6 0 0 0 1.77.32H9.8a1.6 1.6 0 0 0 .97-1.47V4a1.9 1.9 0 1 1 3.8 0v.1a1.6 1.6 0 0 0 .97 1.47 1.6 1.6 0 0 0 1.77-.32l.06-.06a1.9 1.9 0 1 1 2.69 2.69l-.06.06a1.6 1.6 0 0 0-.32 1.77v.08a1.6 1.6 0 0 0 1.47.97H20a1.9 1.9 0 1 1 0 3.8h-.1a1.6 1.6 0 0 0-1.47.97z" />
      </svg>
    ),
  },
  {
    label: "Resources",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} className={iconClass}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.5C10.3 5.2 8.3 4.6 6 4.6c-.9 0-1.8.1-2.6.3v13c.8-.2 1.7-.3 2.6-.3 2.3 0 4.3.6 6 1.9M12 6.5c1.7-1.3 3.7-1.9 6-1.9.9 0 1.8.1 2.6.3v13c-.8-.2-1.7-.3-2.6-.3-2.3 0-4.3.6-6 1.9M12 6.5v13" />
      </svg>
    ),
    children: [
      { href: "/parent/menus", label: "Menus" },
      { href: "/parent/resources", label: "Additional Resources" },
    ],
  },
  {
    href: "/parent/messages",
    label: "Messages",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} className={iconClass}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M20.5 12c0 3.9-3.8 7-8.5 7-.9 0-1.8-.1-2.6-.3L4.5 20.5l1.2-3.4C4.2 15.8 3.5 14 3.5 12c0-3.9 3.8-7 8.5-7s8.5 3.1 8.5 7z" />
      </svg>
    ),
  },
  {
    href: "/parent/contact",
    label: "Contact Us",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} className={iconClass}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 6.2c0-.9.7-1.7 1.6-1.7h1.8c.7 0 1.4.5 1.6 1.2l.7 2.5c.2.6 0 1.3-.5 1.7l-1.1.9a12.3 12.3 0 0 0 4.6 4.6l.9-1.1c.4-.5 1.1-.7 1.7-.5l2.5.7c.7.2 1.2.9 1.2 1.6v1.8c0 .9-.8 1.6-1.7 1.6A14.8 14.8 0 0 1 4.5 6.2z" />
      </svg>
    ),
  },
];
