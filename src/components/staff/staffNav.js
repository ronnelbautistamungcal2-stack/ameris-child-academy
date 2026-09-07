const IconHome = (
  <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0">
    <path fillRule="evenodd" d="M9.293 2.293a1 1 0 011.414 0l7 7A1 1 0 0117 11h-1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-3a1 1 0 00-1-1H9a1 1 0 00-1 1v3a1 1 0 01-1 1H5a1 1 0 01-1-1v-6H3a1 1 0 01-.707-1.707l7-7z" clipRule="evenodd" />
  </svg>
);

const IconPerformance = (
  <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0">
    <path d="M15.5 2A1.5 1.5 0 0114 3.5v13a1.5 1.5 0 003 0v-13A1.5 1.5 0 0015.5 2zM10 6.5A1.5 1.5 0 008.5 8v8.5a1.5 1.5 0 003 0V8A1.5 1.5 0 0010 6.5zM4.5 11A1.5 1.5 0 003 12.5v4a1.5 1.5 0 003 0v-4A1.5 1.5 0 004.5 11z" />
  </svg>
);

const IconKitchen = (
  <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0">
    <path d="M3 2.75a.75.75 0 011.5 0v3.5a.75.75 0 001.5 0v-3.5a.75.75 0 011.5 0v3.5a2.75 2.75 0 01-2 2.646v7.354a.75.75 0 01-1.5 0V9.396A2.75 2.75 0 013 6.75v-4zM13.75 2c-1.243 0-2.25 1.79-2.25 4 0 1.79.663 3.305 1.578 3.82v6.93a.75.75 0 001.5 0V2.75a.75.75 0 00-.828-.746z" />
  </svg>
);

const IconResources = (
  <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0">
    <path d="M10.75 16.82A7.462 7.462 0 0115 15.5c.71 0 1.396.098 2.046.282A.75.75 0 0018 15.06v-11a.75.75 0 00-.546-.721A9.006 9.006 0 0015 3a8.963 8.963 0 00-4.25 1.065V16.82zM9.25 4.065A8.963 8.963 0 005 3c-.85 0-1.673.118-2.454.339A.75.75 0 002 4.06v11a.75.75 0 00.954.721A7.506 7.506 0 015 15.5c1.579 0 3.042.487 4.25 1.32V4.065z" />
  </svg>
);

const IconMessages = (
  <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0">
    <path fillRule="evenodd" d="M10 2c-2.236 0-4.43.18-6.57.524C1.993 2.755 1 4.014 1 5.426v5.148c0 1.413.993 2.67 2.43 2.902.848.137 1.705.248 2.57.331v3.443a.75.75 0 001.28.53l3.58-3.579a.78.78 0 01.527-.224 41.202 41.202 0 005.183-.5c1.437-.232 2.43-1.49 2.43-2.903V5.426c0-1.413-.993-2.67-2.43-2.902A41.289 41.289 0 0010 2z" clipRule="evenodd" />
  </svg>
);

/**
 * Left-side navigation for the Other Staff portal.
 * Kitchen is only shown to staff assigned to the Kitchen department.
 */
export function buildStaffNavItems({ isKitchenStaff = false } = {}) {
  return [
    {
      href: "/staff/dashboard",
      label: "Dashboard",
      icon: IconHome,
    },
    {
      label: "My Performance",
      icon: IconPerformance,
      children: [
        { href: "/staff/checklist", label: "Checklist" },
        { href: "/staff/performance", label: "Performance" },
        { href: "/staff/time-off", label: "Time Off" },
      ],
    },
    ...(isKitchenStaff
      ? [
          {
            label: "Kitchen",
            icon: IconKitchen,
            children: [{ href: "/staff/kitchen/menus", label: "Menus" }],
          },
        ]
      : []),
    {
      label: "Resources",
      icon: IconResources,
      children: [
        { href: "/staff/resources/policies", label: "Policies & Procedures" },
        { href: "/staff/resources/additional", label: "Additional Resources" },
      ],
    },
    {
      href: "/staff/messages",
      label: "Messages",
      icon: IconMessages,
    },
  ];
}

export const STAFF_NAV_ITEMS = buildStaffNavItems();
