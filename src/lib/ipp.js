// Individual Progress Plans (client request 2026-10-02, IPP sheet). An IPP is
// a BehaviorPlan row with goals, each goal with strategies and supports, plus
// documents and an IPP log. Shared by the Student Support pages, the API and
// the read-only view parents and teachers get.

export const IPP_STATUSES = [
  { value: "ACTIVE", label: "Active", tone: "green" },
  { value: "UNDER_REVIEW", label: "Under Review", tone: "amber" },
  { value: "NEEDS_UPDATE", label: "Needs Update", tone: "red" },
  { value: "COMPLETED", label: "Completed", tone: "blue" },
  { value: "CLOSED", label: "Closed", tone: "gray" },
];
/** "View current" shows these; "View all" adds completed and closed plans. */
export const CURRENT_IPP_STATUSES = ["ACTIVE", "UNDER_REVIEW", "NEEDS_UPDATE"];

export const IPP_PLAN_TYPES = ["Individual", "Behavior Support"];

export const IPP_FOCUS_AREAS = [
  "Behavior",
  "Cognitive Development",
  "Communication",
  "Early Literacy",
  "Early Math",
  "Fine Motor",
  "Gross Motor",
  "Independence",
  "Self-Help Skills",
  "Social Skills",
  "Social-Emotional",
  "Speech & Language",
];

export const IPP_REVIEW_SCHEDULES = [
  { value: "MONTHLY", label: "Monthly", months: 1 },
  { value: "QUARTERLY", label: "Every 3 months", months: 3 },
  { value: "SEMIANNUAL", label: "Every 6 months", months: 6 },
  { value: "YEARLY", label: "Yearly", months: 12 },
];

export const IPP_STRATEGY_KINDS = [
  { value: "STRATEGY", label: "Strategy" },
  { value: "SUPPORT", label: "Support" },
];
export const IPP_ROLES = ["Teacher", "Parent", "Student Support", "Coach", "Administrator"];
export const IPP_FREQUENCIES = ["Daily", "Multiple times a day", "Weekly", "As needed"];

export const MAX_LONG_TEXT = 500;

export function statusLabel(value) {
  return IPP_STATUSES.find((s) => s.value === value)?.label || value || "";
}

export function scheduleLabel(value) {
  return IPP_REVIEW_SCHEDULES.find((s) => s.value === value)?.label || "";
}

function addMonths(date, months) {
  const d = new Date(date);
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + months);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, last));
  return d;
}

/**
 * The next review on or after `today`: the start date plus whole review
 * periods. Null without a start date or schedule.
 */
export function nextReviewDate(startDate, schedule, today = new Date()) {
  const months = IPP_REVIEW_SCHEDULES.find((s) => s.value === schedule)?.months;
  if (!startDate || !months) return null;
  const start = new Date(startDate);
  const floor = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  let n = 1;
  let next = addMonths(start, months);
  while (next < floor && n < 600) {
    n += 1;
    next = addMonths(start, months * n);
  }
  return next;
}

function text(value, max = 200) {
  const v = String(value ?? "").trim();
  return v ? v.slice(0, max) : null;
}

function dateOrNull(value) {
  if (!value) return null;
  const m = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return undefined;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? undefined : d;
}

function documentsOf(value) {
  return (Array.isArray(value) ? value : [])
    .map((d) => ({ name: text(d?.name, 200), url: text(d?.url, 2000) }))
    .filter((d) => d.name && d.url);
}

/**
 * Validates the New / Edit Progress Plan form. Returns { plan, goals } ready
 * for Prisma, or { error }.
 */
export function parseIppInput(body = {}) {
  const startDate = dateOrNull(body.startDate);
  if (!startDate) return { error: "Choose the plan start date" };
  if (!IPP_REVIEW_SCHEDULES.some((s) => s.value === body.reviewSchedule)) return { error: "Choose a review schedule" };
  if (!IPP_STATUSES.some((s) => s.value === body.status)) return { error: "Choose a status" };

  const plan = {
    startDate,
    reviewSchedule: body.reviewSchedule,
    status: body.status,
    planType: text(body.planType, 80),
    focusArea: text(body.focusArea, 80),
    description: text(body.purpose, MAX_LONG_TEXT),
    measurableOutcomes: text(body.measurableOutcomes, MAX_LONG_TEXT),
    disciplinaryAction: text(body.disciplinaryAction, MAX_LONG_TEXT),
  };

  const goalsIn = Array.isArray(body.goals) ? body.goals : [];
  if (!goalsIn.length) return { error: "Add at least one goal" };
  const goals = [];
  for (const [i, g] of goalsIn.entries()) {
    const title = text(g?.title, 300);
    if (!title) return { error: `Enter the focus of goal ${i + 1}` };
    const domain = text(g?.domain, 80);
    if (!domain) return { error: `Choose the goal area for goal ${i + 1}` };
    const targetDate = dateOrNull(g?.targetDate);
    if (targetDate === undefined) return { error: `Goal ${i + 1} has an invalid target date` };
    const progress = g?.progress === undefined || g?.progress === "" ? 0 : Number(g.progress);
    if (!Number.isInteger(progress) || progress < 0 || progress > 100) return { error: `Goal ${i + 1} progress must be 0 to 100` };

    const strategies = [];
    for (const [j, st] of (Array.isArray(g?.strategies) ? g.strategies : []).entries()) {
      const stText = text(st?.text, 500);
      if (!stText) {
        if ([st?.notes, st?.role, st?.frequency].some((v) => String(v || "").trim())) {
          return { error: `Describe strategy / support ${j + 1} of goal ${i + 1}` };
        }
        continue;
      }
      strategies.push({
        sortOrder: strategies.length,
        kind: IPP_STRATEGY_KINDS.some((k) => k.value === st?.kind) ? st.kind : "STRATEGY",
        text: stText,
        role: text(st?.role, 80),
        frequency: text(st?.frequency, 80),
        notes: text(st?.notes, 500),
        documents: documentsOf(st?.documents),
      });
    }
    goals.push({
      id: g?.id ? String(g.id) : null,
      sortOrder: goals.length,
      title,
      domain,
      targetDate,
      progress,
      strategies,
    });
  }
  return { plan, goals };
}

/** A person's display name for "by Ms. Lopez" style labels. */
export function displayName(user) {
  return user?.name || user?.email || "Staff";
}
