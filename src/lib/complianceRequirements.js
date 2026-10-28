// Compliance Alerts (client mockups 37-01/02): requirements by category, how
// often they repeat, when they are next due and their status. Shared by the
// page and the API.

export const COMPLIANCE_CATEGORIES = [
  { value: "Safety", icon: "🛡" },
  { value: "Nutrition", icon: "🍎" },
  { value: "Child Records", icon: "🧒" },
  { value: "Staff Training", icon: "👥" },
  { value: "Policy", icon: "📄" },
  { value: "Licensing", icon: "📜" },
  { value: "Facilities", icon: "⚙" },
];

export const FREQUENCIES = [
  { value: "WEEKLY", label: "Weekly", months: 0, days: 7 },
  { value: "MONTHLY", label: "Monthly", months: 1 },
  { value: "QUARTERLY", label: "Quarterly", months: 3 },
  { value: "SEMI_ANNUALLY", label: "Every 6 months", months: 6 },
  { value: "ANNUALLY", label: "Annually", months: 12 },
  { value: "ONCE", label: "One time", months: null },
];

export const STATUS_META = {
  OVERDUE: { label: "Overdue", dot: "bg-red-500", text: "text-red-600" },
  DUE_SOON: { label: "Due Soon", dot: "bg-amber-400", text: "text-amber-700" },
  UPCOMING: { label: "Upcoming", dot: "bg-blue-500", text: "text-blue-700" },
  COMPLETED: { label: "Completed", dot: "bg-emerald-500", text: "text-emerald-700" },
};

const pad = (n) => String(n).padStart(2, "0");
export const keyOf = (d) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
export const fromKey = (key) => new Date(`${String(key).slice(0, 10)}T00:00:00.000Z`);

/**
 * The due date one repeat after `from`. repeatOn is the day of the month
 * (1-31, clamped to the month's length) or, for weekly, the weekday (0 =
 * Sunday); without it the same day of the month / week is kept.
 */
export function nextDueAfter(frequency, from, repeatOn) {
  const meta = FREQUENCIES.find((f) => f.value === frequency);
  if (!meta || meta.months === null) return null;
  const d = fromKey(keyOf(from));
  if (meta.days) {
    d.setUTCDate(d.getUTCDate() + meta.days);
    if (Number.isInteger(repeatOn) && repeatOn >= 0 && repeatOn <= 6) {
      d.setUTCDate(d.getUTCDate() + ((repeatOn - d.getUTCDay() + 7) % 7));
    }
    return d;
  }
  const year = d.getUTCFullYear();
  const month = d.getUTCMonth() + meta.months;
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const day = Number.isInteger(repeatOn) && repeatOn >= 1 ? Math.min(repeatOn, lastDay) : Math.min(d.getUTCDate(), lastDay);
  return new Date(Date.UTC(year, month, day));
}

/** The start of the cycle that ends on nextDue (one repeat before it). */
function cycleStart(frequency, nextDue) {
  const meta = FREQUENCIES.find((f) => f.value === frequency);
  const d = fromKey(keyOf(nextDue));
  if (!meta || meta.months === null) return null;
  if (meta.days) d.setUTCDate(d.getUTCDate() - meta.days);
  else d.setUTCMonth(d.getUTCMonth() - meta.months);
  return d;
}

/**
 * COMPLETED when the cycle just finished was checked off (early or late) and
 * the next due date is not yet close: half a period away, at most 30 days
 * (so a monthly task stays done for two weeks). A done one-time requirement
 * stays COMPLETED. Otherwise OVERDUE past its due date, DUE_SOON within 30
 * days, else UPCOMING.
 */
export function requirementStatus(req, today = new Date()) {
  const todayKey = keyOf(new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())));
  const due = keyOf(new Date(req.nextDue));
  const days = (fromKey(due) - fromKey(todayKey)) / 86400000;
  if (req.lastCompletedAt) {
    if (req.frequency === "ONCE") return "COMPLETED";
    const previousDue = cycleStart(req.frequency, req.nextDue);
    const previousStart = previousDue && cycleStart(req.frequency, previousDue);
    const period = previousDue ? (fromKey(due) - previousDue) / 86400000 : 0;
    if (previousStart && new Date(req.lastCompletedAt) >= previousStart && days > Math.min(30, Math.floor(period / 2))) return "COMPLETED";
  }
  if (days < 0) return "OVERDUE";
  return days <= 30 ? "DUE_SOON" : "UPCOMING";
}

const text = (value, max) => String(value ?? "").trim().slice(0, max);

/** Add / Edit Requirement. Returns { data } or { error }. */
export function parseRequirement(body = {}) {
  const name = text(body.name, 200);
  if (!name) return { error: "Requirement name is required" };
  const category = text(body.category, 60);
  if (!category) return { error: "Choose a category" };
  if (!FREQUENCIES.some((f) => f.value === body.frequency)) return { error: "Choose how often it repeats" };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(body.nextDue || ""))) return { error: "Choose the next due date" };
  const repeatOn = body.repeatOn === "" || body.repeatOn === null || body.repeatOn === undefined ? null : Number(body.repeatOn);
  if (repeatOn !== null && (!Number.isInteger(repeatOn) || repeatOn < 0 || repeatOn > 31)) return { error: "Repeat On is invalid" };
  const list = (v) => (Array.isArray(v) ? [...new Set(v.map((x) => text(x, 60)).filter(Boolean))] : []);
  return {
    data: {
      name,
      description: text(body.description, 1000) || null,
      category,
      frequency: body.frequency,
      repeatOn,
      appliesToRoles: list(body.appliesToRoles),
      ageGroups: list(body.ageGroups),
      notes: text(body.notes, 1000) || null,
      nextDue: fromKey(body.nextDue),
    },
  };
}
