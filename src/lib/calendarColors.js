// Every calendar uses these colours and legend labels (client request
// 2026-10-02: "Have the legend be the same colors for every calendar").
// Time off is coloured by status, so pending requests read yellow everywhere.
export const CALENDAR_KINDS = {
  event: { label: "Events", pill: "bg-indigo-100 text-indigo-700 border-indigo-200" },
  closure: { label: "Closures", pill: "bg-orange-100 text-orange-700 border-orange-200" },
  shift: { label: "Shifts", pill: "bg-blue-100 text-blue-700 border-blue-200" },
  timeOffApproved: { label: "Approved Time Off", pill: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  timeOffPending: { label: "Pending Time Off", pill: "bg-yellow-100 text-yellow-800 border-yellow-300" },
  timeOffUnexcused: { label: "Unexcused Time Off", pill: "bg-red-100 text-red-700 border-red-200" },
  birthday: { label: "Birthdays", pill: "bg-pink-100 text-pink-700 border-pink-200" },
};

// Time-off calendars show center events plus the three time-off statuses.
export const TIME_OFF_CALENDAR_KINDS = ["event", "closure", "timeOffApproved", "timeOffPending", "timeOffUnexcused"];

const FALLBACK = { label: "Other", pill: "bg-gray-100 text-gray-600 border-gray-200" };

/** Which CALENDAR_KINDS entry a MonthlyCalendar event (with `_source`) belongs to. */
export function calendarKindOf(event) {
  if (event?._source === "timeoff") {
    if (event.isUnexcused) return "timeOffUnexcused";
    const status = String(event.status || "").toUpperCase();
    if (status === "PENDING") return "timeOffPending";
    if (status === "APPROVED") return "timeOffApproved";
    return null; // denied / cancelled requests fall back to grey
  }
  if (event?._source === "event" && event.type === "HOLIDAY") return "closure";
  return CALENDAR_KINDS[event?._source] ? event._source : null;
}

export function calendarStyleOf(event) {
  return CALENDAR_KINDS[calendarKindOf(event)] || FALLBACK;
}
