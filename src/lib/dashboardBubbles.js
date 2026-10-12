// Dashboard stat bubbles use one colour per kind of number, whichever role is
// looking (client request 2026-10-02). Pass `kind` to a dashboard card to use
// these instead of the card's own tone. Class names are written out in full so
// Tailwind can see them.
export const DASHBOARD_BUBBLES = {
  // Messages: light green
  messages: {
    card: "bg-emerald-50 border-emerald-200 hover:bg-emerald-100/70 hover:border-emerald-300 dark:bg-emerald-900/20 dark:border-emerald-800",
    icon: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
    value: "text-emerald-900 dark:text-emerald-200",
    arrow: "group-hover:text-emerald-600",
  },
  // Students present / signed in: light blue
  studentsPresent: {
    card: "bg-sky-50 border-sky-200 hover:bg-sky-100/70 hover:border-sky-300 dark:bg-sky-900/20 dark:border-sky-800",
    icon: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300",
    value: "text-sky-900 dark:text-sky-200",
    arrow: "group-hover:text-sky-600",
  },
  // Red flags: light red
  redFlags: {
    card: "bg-red-50 border-red-200 hover:bg-red-100/70 hover:border-red-300 dark:bg-red-900/20 dark:border-red-800",
    icon: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
    value: "text-red-900 dark:text-red-200",
    arrow: "group-hover:text-red-600",
  },
  // Staff members signed in / present: light purple
  staffPresent: {
    card: "bg-violet-50 border-violet-200 hover:bg-violet-100/70 hover:border-violet-300 dark:bg-violet-900/20 dark:border-violet-800",
    icon: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
    value: "text-violet-900 dark:text-violet-200",
    arrow: "group-hover:text-violet-600",
  },
  // Pending time off requests: light yellow
  timeOffPending: {
    card: "bg-yellow-50 border-yellow-200 hover:bg-yellow-100/70 hover:border-yellow-300 dark:bg-yellow-900/20 dark:border-yellow-800",
    icon: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300",
    value: "text-yellow-900 dark:text-yellow-200",
    arrow: "group-hover:text-yellow-600",
  },
};
// Infant plan updates: light purple, same as staff present.
DASHBOARD_BUBBLES.infantPlanUpdates = DASHBOARD_BUBBLES.staffPresent;
